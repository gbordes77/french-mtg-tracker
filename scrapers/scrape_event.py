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
3. Merge avec public/data/{slug}.json existant (préserve archetype/source/splits enrichis main)
4. Écrit public/data/{slug}.json

Hypothèses :
- Le HTML de magic.gg contient un <table> standard avec colonnes
  Rank | Player | Points | OMW% (les noms peuvent varier).
- La détection de la "bonne" table se fait par les headers (Rank/Player/Points/OMW),
  pas par le nombre de lignes — ce qui permet le scrape de Worlds (16 joueurs).
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
import unicodedata
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

# Slug strict : lowercase alphanum + tirets, 3–80 chars, doit commencer par alphanum.
# Évite SSRF (`../../evil.com`) et path traversal sur le fichier de sortie.
SLUG_REGEX = re.compile(r"^[a-z0-9][a-z0-9-]{2,80}$")

# Headers attendus dans la table de standings (matching insensible à la casse).
EXPECTED_HEADERS = {"rank", "player", "match points", "points", "omw"}

logger = logging.getLogger("scraper")


# ────────────────────────────────────────────────────────────
# Exceptions typées
# ────────────────────────────────────────────────────────────

class ScraperError(Exception):
    """Base exception pour le scraper."""


class StandingsNotPublished(ScraperError):
    """La page magic.gg pour cette ronde n'existe pas encore (404 attendu)."""


class ParseError(ScraperError):
    """Le HTML a été récupéré mais le parsing a échoué (structure inattendue)."""


# ────────────────────────────────────────────────────────────
# Normalisation des noms (matching FR robuste)
# ────────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    """Normalise un nom de joueur pour le matching tolérant aux variations.

    - NFC pour merger les diacritiques composés (é = U+00E9 vs U+0065+U+0301)
    - casefold pour ignorer les variations de casse
    - Espaces normalisés autour des virgules ("Last,First" et "Last, First" matchent)
    """
    nfc = unicodedata.normalize("NFC", name)
    # Normaliser les espaces autour des virgules
    collapsed = re.sub(r"\s*,\s*", ", ", nfc.strip())
    return collapsed.casefold()


# ────────────────────────────────────────────────────────────
# Fetch HTTP avec retry/backoff
# ────────────────────────────────────────────────────────────

def _fetch_html(client: httpx.Client, url: str, max_retries: int = 3) -> str:
    """Récupère une page HTML magic.gg.

    - Retry exponentiel sur erreurs transient (5xx, ConnectError, ReadTimeout)
    - 404 → StandingsNotPublished (pas de retry, comportement attendu)
    - Autre 4xx → raise direct
    - Force l'encoding UTF-8 (défensif si magic.gg omet le charset)
    """
    for attempt in range(max_retries):
        try:
            r = client.get(url, headers={"User-Agent": USER_AGENT})
        except (httpx.ConnectError, httpx.ReadTimeout) as e:
            if attempt == max_retries - 1:
                raise
            backoff = 2 ** attempt
            logger.warning("Erreur réseau %s, retry dans %ss (tentative %d/%d)",
                          type(e).__name__, backoff, attempt + 1, max_retries)
            time.sleep(backoff)
            continue

        if r.status_code == 404:
            raise StandingsNotPublished(f"404: {url}")
        if 500 <= r.status_code < 600:
            if attempt == max_retries - 1:
                r.raise_for_status()
            backoff = 2 ** attempt
            logger.warning("HTTP %d, retry dans %ss (tentative %d/%d)",
                          r.status_code, backoff, attempt + 1, max_retries)
            time.sleep(backoff)
            continue

        r.raise_for_status()
        # Force UTF-8 si le serveur ne précise pas le charset (sinon Latin-1 = casse les é)
        r.encoding = "utf-8"
        return r.text

    raise ScraperError(f"Échec après {max_retries} tentatives: {url}")


# ────────────────────────────────────────────────────────────
# Parsing du HTML standings
# ────────────────────────────────────────────────────────────

def _table_has_standings_headers(table: Any) -> bool:
    """Vérifie qu'un <table> a les headers attendus (Rank/Player/Points/OMW)."""
    headers = [
        th.get_text(strip=True).casefold()
        for th in table.select("thead th, tr:first-child th")
    ]
    if not headers:
        return False
    found = sum(1 for h in headers if any(exp in h for exp in EXPECTED_HEADERS))
    return found >= 3  # au moins 3 headers attendus parmi Rank/Player/Points/OMW


def _parse_standings_table(html: str) -> list[dict[str, Any]]:
    """Parse le tableau de standings depuis le HTML magic.gg.

    Détection par les headers (Rank/Player/Match Points/OMW), pas par taille.
    Retourne une liste de dicts {rank, player, points, omw}.
    """
    soup = BeautifulSoup(html, "lxml")

    candidate_tables = [t for t in soup.find_all("table") if _table_has_standings_headers(t)]
    if not candidate_tables:
        raise ParseError("Aucun tableau avec headers Rank/Player/Points/OMW trouvé")

    rows: list[dict[str, Any]] = []
    for table in candidate_tables:
        body_rows = table.select("tbody tr") or table.select("tr")[1:]  # fallback si pas de tbody
        for tr in body_rows:
            cells = [td.get_text(strip=True) for td in tr.find_all("td")]
            if len(cells) < 4:
                continue
            try:
                rank = int(cells[0])
                player = cells[1]
                points = int(cells[2])
                # OMW peut être "0.5821", "58.21%", "58.21"
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

    if not rows:
        raise ParseError("Tableau trouvé mais aucune ligne parsable")

    return rows


def fetch_standings(client: httpx.Client, slug: str, round_n: int) -> list[dict[str, Any]]:
    """Récupère et parse les standings d'une ronde donnée."""
    url = f"https://magic.gg/news/{slug}-round-{round_n}-standings"
    html = _fetch_html(client, url)
    return _parse_standings_table(html)


def detect_latest_round(client: httpx.Client, slug: str, max_round: int = 16,
                        start_from: int | None = None) -> int:
    """Cherche la ronde la plus récente disponible.

    Si `start_from` est fourni (typiquement la dernière ronde scrappée connue),
    on tente d'abord les rondes suivantes en ordre croissant — bien plus efficace
    qu'un balayage R16→R1 quand le PT est encore en cours.
    Sinon: balayage descendant R{max_round}→R1.
    """
    if start_from is not None and start_from < max_round:
        # Tente les rondes >= start_from en ordre croissant, puis fallback
        for n in range(start_from, max_round + 1):
            try:
                fetch_standings(client, slug, n)
                latest = n
            except StandingsNotPublished:
                # On a trouvé la première ronde non-publiée → la ronde précédente est la dernière dispo
                if n > start_from:
                    return n - 1
                break  # rien depuis start_from, fallback descendant
        else:
            return max_round  # toutes les rondes existent, on est en fin de PT

    # Fallback: balayage descendant
    for n in range(max_round, 0, -1):
        try:
            fetch_standings(client, slug, n)
            return n
        except StandingsNotPublished:
            continue
        except (httpx.HTTPError, ParseError) as e:
            logger.error("Erreur durable sur %s R%d: %s", slug, n, e)
            raise

    raise StandingsNotPublished(f"Aucune ronde publiée pour {slug}")


# ────────────────────────────────────────────────────────────
# Identification des Français
# ────────────────────────────────────────────────────────────

def load_french_config() -> dict[str, Any]:
    """Charge la config YAML des joueurs FR. Lève ValueError si entrée mal formée."""
    config = yaml.safe_load(FRENCH_FILE.read_text(encoding="utf-8"))
    for section in ("players", "excluded"):
        for entry in config.get(section, []):
            if not isinstance(entry, dict) or "name" not in entry:
                raise ValueError(f"Entrée invalide dans {section}: {entry!r} (manque 'name')")
    return config


def identify_french(
    standings: list[dict[str, Any]],
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    """Croise les standings avec la liste des joueurs FR (matching normalisé)."""
    fr_index = {normalize_name(p["name"]): p for p in config.get("players", [])}
    excluded_norm = {normalize_name(p["name"]) for p in config.get("excluded", [])}

    result = []
    for row in standings:
        norm_player = normalize_name(row["player"])
        if norm_player in excluded_norm:
            continue
        fr_meta = fr_index.get(norm_player)
        if fr_meta is None:
            continue
        result.append({
            **row,
            "twitter": fr_meta.get("twitter"),
            "verified": fr_meta.get("verified", False),
            # NB: champ 'notes' du YAML n'est PAS exposé au JSON public (notes internes)
        })
    return result


# ────────────────────────────────────────────────────────────
# Build & merge
# ────────────────────────────────────────────────────────────

# Champs préservés depuis le JSON existant (enrichissement manuel non scrappable)
PRESERVED_FIELDS = (
    "draftD1", "standardD1", "draftD2", "standardD2",
    "finalRecord", "archetype", "source", "rcOrigin", "flag", "noLimited",
)


def _split_player_name(player: str) -> tuple[str, str]:
    """Sépare 'Last, First' en (last, first) avec gestion des cas edge."""
    last, sep, first = player.partition(",")
    if not sep:
        return player.strip(), ""
    return last.strip(), first.strip()


def _player_key(p: dict[str, Any]) -> str:
    """Clé stable pour matcher un joueur entre 2 versions du JSON."""
    return f"{normalize_name(p.get('last', ''))}|{normalize_name(p.get('first', ''))}"


def load_existing_event_data(slug: str) -> dict[str, Any] | None:
    """Charge le JSON existant pour ce slug, ou None si absent / illisible."""
    path = DATA_OUT / f"{slug}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("JSON existant illisible pour %s: %s — repart de zéro", slug, e)
        return None


def build_event_data(
    slug: str,
    round_n: int,
    total_rounds: int,
    standings: list[dict[str, Any]],
    french: list[dict[str, Any]],
    existing: dict[str, Any] | None,
) -> dict[str, Any]:
    """Construit le JSON final, en préservant les champs enrichis manuellement.

    Les champs PRESERVED_FIELDS (archetype, source, draftD1/standardD1/...)
    sont copiés depuis l'entrée correspondante du JSON existant si elle existe.
    """
    existing_index: dict[str, dict[str, Any]] = {}
    if existing:
        for ep in existing.get("frenchPlayers", []):
            existing_index[_player_key(ep)] = ep

    players_out = []
    for p in french:
        last, first = _split_player_name(p["player"])
        new_entry: dict[str, Any] = {
            "rank": p["rank"],
            "first": first,
            "last": last,
            "points": p["points"],
            "omw": p["omw"],
            # Defaults — surchargés par les valeurs préservées si dispos
            "draftD1": None,
            "standardD1": None,
            "draftD2": None,
            "standardD2": None,
            "finalRecord": None,
            "archetype": "Inconnu",
            "source": "À vérifier",
            "rcOrigin": "EMEA",
            "twitter": p.get("twitter"),
        }
        key = _player_key(new_entry)
        prev = existing_index.get(key)
        if prev:
            for field in PRESERVED_FIELDS:
                if field in prev and prev[field] is not None and prev[field] != "Inconnu" and prev[field] != "À vérifier":
                    new_entry[field] = prev[field]
        players_out.append(new_entry)

    return {
        "slug": slug,
        "round": round_n,
        "totalRounds": total_rounds,
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "fieldSize": len(standings),
        "frenchPlayers": players_out,
    }


# ────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────

def _setup_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        stream=sys.stderr,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", required=True, help="Slug de l'événement (ex: pt-secrets-of-strixhaven)")
    parser.add_argument("--round", type=int, help="Numéro de ronde précis")
    parser.add_argument("--auto", action="store_true", help="Détecte automatiquement la dernière ronde dispo")
    parser.add_argument("--total-rounds", type=int, default=16, help="Nombre total de rondes (défaut: 16)")
    parser.add_argument("--dry-run", action="store_true", help="N'écrit pas de fichier, affiche stdout")
    parser.add_argument("--output", type=Path, help="Fichier de sortie alternatif")
    parser.add_argument("--verbose", "-v", action="store_true", help="Logs debug")
    args = parser.parse_args()

    _setup_logging(args.verbose)

    # Validation stricte du slug (anti-SSRF + anti-path-traversal)
    if not SLUG_REGEX.fullmatch(args.slug):
        parser.error(f"Slug invalide: {args.slug!r} (attendu: ^[a-z0-9][a-z0-9-]{{2,80}}$)")

    if not args.round and not args.auto:
        if args.dry_run:
            args.auto = True
        else:
            parser.error("Spécifier --round N ou --auto")

    logger.info("Slug: %s", args.slug)

    existing = load_existing_event_data(args.slug)
    start_from = existing.get("round") if existing else None

    with httpx.Client(timeout=TIMEOUT, follow_redirects=True) as client:
        if args.auto:
            logger.info("Détection automatique de la dernière ronde (start_from=%s)", start_from)
            try:
                round_n = detect_latest_round(
                    client, args.slug,
                    max_round=args.total_rounds,
                    start_from=start_from,
                )
            except StandingsNotPublished as e:
                if args.dry_run:
                    logger.warning("%s — dry-run: validation config uniquement", e)
                    config = load_french_config()
                    logger.info("french_players.yaml chargé: %d joueurs FR, %d exclus",
                                len(config.get("players", [])), len(config.get("excluded", [])))
                    return 0
                raise
        else:
            round_n = args.round
        logger.info("Ronde: %d", round_n)

        standings = fetch_standings(client, args.slug, round_n)
        logger.info("%d joueurs dans le standings", len(standings))

    config = load_french_config()
    french = identify_french(standings, config)
    logger.info("%d Français identifiés", len(french))

    event_data = build_event_data(
        args.slug, round_n, args.total_rounds, standings, french, existing,
    )

    output_path = args.output or DATA_OUT / f"{args.slug}.json"

    if args.dry_run:
        print(json.dumps(event_data, indent=2, ensure_ascii=False))
    else:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(event_data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        logger.info("Écrit dans %s", output_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
