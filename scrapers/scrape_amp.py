#!/usr/bin/env python3
"""
Scraper magic.gg/standings/pro-tour-adjusted-match-points → JSON.

Parse le payload __NUXT__ minifié (3000+ variables encodées) pour extraire
le tableau AMP cumulé par joueur après chaque PT de la saison.

Usage:
    python scrapers/scrape_amp.py
    python scrapers/scrape_amp.py --dry-run

Output : public/data/amp.json avec :
    {
      "lastUpdated": "March 5, 2026",
      "season": "2026",
      "ptsTracked": ["ECL", "MSH", "SOS", ...],
      "players": [
        {"first": "...", "last": "...", "postPtEclTotal": 18, "postPtMshTotal": 24, ...},
        ...
      ]
    }
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
DATA_OUT = ROOT / "public" / "data" / "amp.json"
URL = "https://magic.gg/standings/pro-tour-adjusted-match-points"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "FrenchMTGTracker/0.2 (+https://github.com/gbordes77/french-mtg-tracker)"
)

logger = logging.getLogger("amp")


def fetch_page() -> str:
    """Récupère le HTML brut (le payload __NUXT__ est SSR-rendered, pas besoin de JS)."""
    with httpx.Client(timeout=20.0, follow_redirects=True) as c:
        r = c.get(URL, headers={"User-Agent": USER_AGENT})
        r.raise_for_status()
        r.encoding = "utf-8"
        return r.text


def parse_call_values(s: str) -> list[str]:
    """Tokenize les valeurs passées en arguments à la function __NUXT__.

    Format JS : "string", number, true/false/null, void 0, [...], {...}, ref_name
    Retourne la liste de tokens (strings raw, à interpréter selon leur forme).
    """
    values: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        while i < n and s[i] in " \t\n\r":
            i += 1
        if i >= n:
            break
        c = s[i]
        if c == '"':
            j = i + 1
            while j < n:
                if s[j] == "\\":
                    j += 2
                elif s[j] == '"':
                    j += 1
                    break
                else:
                    j += 1
            values.append(s[i:j])
            i = j
        elif c.isdigit() or (c == "-" and i + 1 < n and s[i + 1].isdigit()):
            j = i
            if c == "-":
                j += 1
            while j < n and (s[j].isdigit() or s[j] in ".eE+-"):
                j += 1
            values.append(s[i:j])
            i = j
        elif s[i:i + 4] == "true":
            values.append("true")
            i += 4
        elif s[i:i + 5] == "false":
            values.append("false")
            i += 5
        elif s[i:i + 4] == "null":
            values.append("null")
            i += 4
        elif s[i:i + 6] == "void 0":
            values.append("null")
            i += 6
        elif c == "[":
            depth = 1
            j = i + 1
            while j < n and depth:
                if s[j] == "[":
                    depth += 1
                elif s[j] == "]":
                    depth -= 1
                elif s[j] == '"':
                    j += 1
                    while j < n and s[j] != '"':
                        if s[j] == "\\":
                            j += 1
                        j += 1
                j += 1
            values.append(s[i:j])
            i = j
        elif c == "{":
            depth = 1
            j = i + 1
            while j < n and depth:
                if s[j] == "{":
                    depth += 1
                elif s[j] == "}":
                    depth -= 1
                elif s[j] == '"':
                    j += 1
                    while j < n and s[j] != '"':
                        if s[j] == "\\":
                            j += 1
                        j += 1
                j += 1
            values.append(s[i:j])
            i = j
        elif c == ",":
            i += 1
        else:
            # variable name (a, xL, $0, etc.)
            j = i
            while j < n and (s[j].isalnum() or s[j] in "_$"):
                j += 1
            if j == i:
                j += 1  # safety
            values.append(s[i:j])
            i = j
    return values


def resolve_value(token: str, mapping: dict[str, str], depth: int = 0):
    """Résout récursivement un token vers sa valeur Python."""
    if depth > 5:
        return token  # safety
    if not token:
        return None
    if token.startswith('"') and token.endswith('"'):
        # JS string with escaping
        try:
            return json.loads(token)
        except json.JSONDecodeError:
            return token[1:-1]
    if token in ("true", "false"):
        return token == "true"
    if token == "null":
        return None
    # number
    try:
        if "." in token or "e" in token or "E" in token:
            return float(token)
        return int(token)
    except ValueError:
        pass
    # variable reference
    if token in mapping:
        return resolve_value(mapping[token], mapping, depth + 1)
    return token


def extract_amp_data(html: str) -> dict:
    # 1. Args + values du __NUXT__
    args_match = re.search(r"window\.__NUXT__=\(function\(([^)]+)\)\{", html)
    if not args_match:
        raise RuntimeError("__NUXT__ function signature non trouvée")
    args = args_match.group(1).split(",")

    # Le call est tout à la fin avant </script>. Format : }(value1,value2,...))
    # On cherche la dernière occurrence de }( ... )) avant </script>
    call_match = re.search(r"\}\(([^<]+?)\)\)\s*;?\s*</script>", html)
    if not call_match:
        raise RuntimeError("__NUXT__ call values non trouvés")
    values = parse_call_values(call_match.group(1))
    if len(values) != len(args):
        logger.warning(
            "args/values mismatch : %d args, %d values — résolution best-effort",
            len(args), len(values),
        )
    mapping = dict(zip(args, values))

    # 2. Last Updated
    last_updated_match = re.search(r"Last Updated:\s*([A-Z][a-z]+\s+\d{1,2},\s*\d{4})", html)
    last_updated = last_updated_match.group(1) if last_updated_match else None

    # 3. Trouve le bloc jsonObject
    block_match = re.search(r'jsonObject:\[(\{"Last Name"[^]]+)\]', html)
    if not block_match:
        raise RuntimeError("jsonObject AMP block non trouvé")
    block = block_match.group(1)

    # Parse les records (objets) un par un
    records_raw = []
    depth = 0
    start = 0
    for i, c in enumerate(block):
        if c == "{":
            if depth == 0:
                start = i
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                records_raw.append(block[start:i + 1])

    logger.info("%d records bruts dans jsonObject", len(records_raw))

    # 4. Résoudre chaque record. Format :
    # {"Last Name":xL,"First Name":ks,"WC 32 Invited":m,...}
    pair_re = re.compile(r'"([^"]+)":\s*([a-zA-Z_$][a-zA-Z0-9_$]*|-?\d+(?:\.\d+)?|"[^"]*")')

    players = []
    for rec in records_raw:
        resolved = {}
        for m in pair_re.finditer(rec):
            key = m.group(1)
            raw = m.group(2)
            resolved[key] = resolve_value(raw, mapping)
        if resolved:
            players.append(resolved)

    # 5. Détecte les colonnes "Post PT XXX Total"
    pt_columns = []
    if players:
        pt_columns = [k for k in players[0].keys() if k.startswith("Post PT")]

    return {
        "lastUpdated": last_updated,
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "ptColumns": pt_columns,
        "players": players,
    }


def _setup_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        stream=sys.stderr,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                       help="N'écrit pas, affiche un résumé")
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--input", type=Path,
                       help="Lire depuis un fichier HTML local au lieu de fetch")
    args = parser.parse_args()
    _setup_logging(args.verbose)

    if args.input:
        html = args.input.read_text(encoding="utf-8")
        logger.info("Lu depuis %s (%d chars)", args.input, len(html))
    else:
        logger.info("Fetch %s", URL)
        html = fetch_page()
        logger.info("HTML récupéré (%d chars)", len(html))

    data = extract_amp_data(html)
    logger.info("Last Updated: %s", data["lastUpdated"])
    logger.info("PT colonnes : %s", data["ptColumns"])
    logger.info("Joueurs extraits : %d", len(data["players"]))

    if data["players"]:
        first = data["players"][0]
        logger.info("Premier record : %s", first)

    if args.dry_run:
        print(json.dumps(
            {
                "lastUpdated": data["lastUpdated"],
                "ptColumns": data["ptColumns"],
                "playerCount": len(data["players"]),
                "first3": data["players"][:3],
            },
            indent=2, ensure_ascii=False,
        ))
    else:
        DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
        DATA_OUT.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        logger.info("Écrit dans %s (%d KB)",
                  DATA_OUT, DATA_OUT.stat().st_size // 1024)

    return 0


if __name__ == "__main__":
    sys.exit(main())
