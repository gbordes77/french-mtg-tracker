#!/usr/bin/env python3
"""
Scraper magic.gg → JSON pour le projet french-mtg-tracker.

Usage:
    python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --round 8
    python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --auto
    python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --dry-run

Le mode --auto détecte la dernière ronde publiée disponible.
Le mode --dry-run n'écrit pas de fichier, affiche juste le résultat.

Architecture :
1. Fetch magic.gg/news/{slug}-round-{N}-standings → parse table HTML
2. Croise avec scrapers/data/french_players.yaml
3. Écrit public/data/{slug}.json

Hypothèses :
- Le HTML de magic.gg contient un <table> standard avec colonnes
  Rank | Player | Points | OMW% (les noms peuvent varier).
- Si la structure HTML change, ajuster `_parse_standings_table`.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA_OUT = ROOT / "public" / "data"
FRENCH_FILE = ROOT / "scrapers" / "data" / "french_players.yaml"

USER_AGENT = "FrenchMTGTracker/0.1 (+https://github.com/gbordes77/french-mtg-tracker)"
TIMEOUT = httpx.Timeout(15.0, connect=10.0)


def _fetch_html(url: str) -> str:
    """Récupère une page HTML magic.gg avec User-Agent identifié."""
    with httpx.Client(timeout=TIMEOUT, follow_redirects=True) as client:
        r = client.get(url, headers={"User-Agent": USER_AGENT})
        r.raise_for_status()
        return r.text


def _parse_standings_table(html: str) -> list[dict[str, Any]]:
    """Parse le tableau de standings depuis le HTML magic.gg.

    Retourne une liste de dicts {rank, player, points, omw}.
    """
    soup = BeautifulSoup(html, "lxml")
    rows = []

    for table in soup.find_all("table"):
        # Heuristique : le bon tableau a au moins 100 lignes pour un PT
        body_rows = table.select("tbody tr")
        if len(body_rows) < 50:
            continue

        for tr in body_rows:
            cells = [td.get_text(strip=True) for td in tr.find_all("td")]
            if len(cells) < 4:
                continue
            try:
                rank = int(cells[0])
                player = cells[1]
                points = int(cells[2])
                # OMW peut être au format "0.5821" ou "58.21%"
                omw_raw = cells[3].rstrip("%").strip()
                omw = float(omw_raw)
                if omw > 1.5:  # format pourcent
                    omw = omw / 100
                rows.append({
                    "rank": rank,
                    "player": player,
                    "points": points,
                    "omw": round(omw, 4),
                })
            except (ValueError, IndexError):
                continue

        if rows:
            break  # premier tableau valide trouvé

    return rows


def fetch_standings(slug: str, round_n: int) -> list[dict[str, Any]]:
    """Récupère et parse les standings d'une ronde donnée."""
    url = f"https://magic.gg/news/{slug}-round-{round_n}-standings"
    html = _fetch_html(url)
    standings = _parse_standings_table(html)
    if not standings:
        raise ValueError(f"Aucune standing trouvée pour {slug} R{round_n}")
    return standings


def detect_latest_round(slug: str, max_round: int = 16) -> int:
    """Cherche la ronde la plus récente disponible (de R16 vers R1)."""
    for n in range(max_round, 0, -1):
        try:
            fetch_standings(slug, n)
            return n
        except (httpx.HTTPError, ValueError):
            continue
    raise ValueError(f"Aucune ronde trouvée pour {slug}")


def load_french_config() -> dict[str, Any]:
    """Charge la config YAML des joueurs FR."""
    return yaml.safe_load(FRENCH_FILE.read_text(encoding="utf-8"))


def identify_french(
    standings: list[dict[str, Any]],
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    """Croise les standings avec la liste des joueurs FR."""
    fr_index = {p["name"]: p for p in config.get("players", [])}
    excluded_names = {p["name"] for p in config.get("excluded", [])}

    result = []
    for row in standings:
        if row["player"] in excluded_names:
            continue
        fr_meta = fr_index.get(row["player"])
        if fr_meta is None:
            continue
        result.append({
            **row,
            "twitter": fr_meta.get("twitter"),
            "verified": fr_meta.get("verified", False),
            "notes": fr_meta.get("notes"),
        })
    return result


def build_event_data(
    slug: str,
    round_n: int,
    total_rounds: int,
    standings: list[dict[str, Any]],
    french: list[dict[str, Any]],
) -> dict[str, Any]:
    """Construit la structure JSON finale pour un événement."""
    return {
        "slug": slug,
        "round": round_n,
        "totalRounds": total_rounds,
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "fieldSize": len(standings),
        "frenchPlayers": [
            {
                "rank": p["rank"],
                "first": p["player"].split(", ")[1] if ", " in p["player"] else "",
                "last": p["player"].split(", ")[0] if ", " in p["player"] else p["player"],
                "points": p["points"],
                "omw": p["omw"],
                # Les champs draftD1, standardD1, etc. seraient idéalement scrappés
                # depuis melee.gg ou parsés des standings ronde-par-ronde, mais c'est
                # un travail plus complexe. Pour la v1 : valeurs placeholder.
                "draftD1": None,
                "standardD1": None,
                "draftD2": None,
                "standardD2": None,
                "finalRecord": None,
                "archetype": "Inconnu",  # à enrichir avec la decklist
                "source": "À vérifier",  # à enrichir avec invitation list
                "rcOrigin": "EMEA",
                "twitter": p.get("twitter"),
                "notes": p.get("notes"),
            }
            for p in french
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", required=True, help="Slug de l'événement (ex: pt-secrets-of-strixhaven)")
    parser.add_argument("--round", type=int, help="Numéro de ronde précis")
    parser.add_argument("--auto", action="store_true", help="Détecte automatiquement la dernière ronde dispo")
    parser.add_argument("--total-rounds", type=int, default=16, help="Nombre total de rondes (défaut: 16)")
    parser.add_argument("--dry-run", action="store_true", help="N'écrit pas de fichier, affiche stdout")
    parser.add_argument("--output", type=Path, help="Fichier de sortie alternatif")
    args = parser.parse_args()

    if not args.round and not args.auto:
        if args.dry_run:
            args.auto = True  # dry-run sans round explicite = auto-détection
        else:
            parser.error("Spécifier --round N ou --auto")

    print(f"→ Slug: {args.slug}", file=sys.stderr)

    if args.auto:
        print("→ Détection automatique de la dernière ronde…", file=sys.stderr)
        try:
            round_n = detect_latest_round(args.slug, max_round=args.total_rounds)
        except ValueError as e:
            if args.dry_run:
                print(f"⚠️  {e} (dry-run: validation config uniquement)", file=sys.stderr)
                config = load_french_config()
                n_players = len(config.get("players", []))
                n_excluded = len(config.get("excluded", []))
                print(f"✓ french_players.yaml chargé : {n_players} joueurs FR, {n_excluded} exclus", file=sys.stderr)
                return 0
            raise
    else:
        round_n = args.round
    print(f"→ Ronde: {round_n}", file=sys.stderr)

    standings = fetch_standings(args.slug, round_n)
    print(f"→ {len(standings)} joueurs dans le standings", file=sys.stderr)

    config = load_french_config()
    french = identify_french(standings, config)
    print(f"→ {len(french)} Français identifiés", file=sys.stderr)

    event_data = build_event_data(args.slug, round_n, args.total_rounds, standings, french)

    output_path = args.output or DATA_OUT / f"{args.slug}.json"

    if args.dry_run:
        print(json.dumps(event_data, indent=2, ensure_ascii=False))
    else:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(event_data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"✓ Écrit dans {output_path}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
