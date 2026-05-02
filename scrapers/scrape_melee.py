#!/usr/bin/env python3
"""
Scraper melee.gg → JSON pour le projet french-mtg-tracker.

Usage:
    python scrapers/scrape_melee.py --slug pt-tarkir-dragonstorm --tournament-id 271234
    python scrapers/scrape_melee.py --slug pt-tarkir-dragonstorm --tournament-id 271234 --dry-run
    python scrapers/scrape_melee.py --slug pt-tarkir-dragonstorm --tournament-id 271234 --round-id 62953

Différences avec scrape_event.py (magic.gg) :
- Source = melee.gg, ~10× plus rapide à actualiser (1-3 min après chaque ronde
  vs 10-30 min sur magic.gg).
- API JSON publique : POST /Standing/GetRoundStandings (DataTables server-side).
- Données plus riches : MatchRecord (W-L-D), GameRecord, 4 tiebreakers,
  decklists quand publiées, FormatName.
- L'identifiant melee = entier (TournamentId), différent du slug magic.gg.
- Round IDs scrapés depuis le HTML de /Tournament/View/{id} (boutons
  .round-selector avec data-id et data-is-completed).

Architecture :
1. GET /Tournament/View/{tournamentId} → parse HTML pour round IDs
2. POST /Standing/GetRoundStandings (form-encoded, paginé si besoin)
3. Croise avec scrapers/data/french_players.yaml
4. Merge avec public/data/{slug}.json existant (préserve enrichissements)
5. Écrit public/data/{slug}.json
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
EVENTS_FILE = ROOT / "public" / "data" / "events.json"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "FrenchMTGTracker/0.2 (+https://github.com/gbordes77/french-mtg-tracker)"
)
TIMEOUT = httpx.Timeout(20.0, connect=10.0)

MELEE_BASE = "https://melee.gg"
SLUG_REGEX = re.compile(r"^[a-z0-9][a-z0-9-]{2,80}$")

# Page size recommandé : melee répond bien jusqu'à 500. On reste à 250 pour
# être sage et paginer si > 250 (rare en PT, jamais en Worlds).
PAGE_SIZE = 250

logger = logging.getLogger("melee")


# ────────────────────────────────────────────────────────────
# Exceptions typées
# ────────────────────────────────────────────────────────────

class ScraperError(Exception):
    pass


class TournamentNotFound(ScraperError):
    """Le tournoi melee.gg n'existe pas ou est privé."""


class StandingsNotPublished(ScraperError):
    """Aucune ronde complétée n'est encore dispo."""


class ParseError(ScraperError):
    pass


# ────────────────────────────────────────────────────────────
# Normalisation des noms (matching FR robuste, partagée avec magic.gg)
# ────────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    nfc = unicodedata.normalize("NFC", name)
    collapsed = re.sub(r"\s*,\s*", ", ", nfc.strip())
    return collapsed.casefold()


# ────────────────────────────────────────────────────────────
# Helpers HTTP
# ────────────────────────────────────────────────────────────

def _get_with_retry(client: httpx.Client, url: str, max_retries: int = 3) -> httpx.Response:
    """GET avec retry exponentiel sur 5xx + ConnectError + ReadTimeout."""
    for attempt in range(max_retries):
        try:
            r = client.get(url, headers={"User-Agent": USER_AGENT})
        except (httpx.ConnectError, httpx.ReadTimeout) as e:
            if attempt == max_retries - 1:
                raise
            backoff = 2 ** attempt
            logger.warning("Erreur réseau %s, retry dans %ss", type(e).__name__, backoff)
            time.sleep(backoff)
            continue
        if r.status_code == 404:
            raise TournamentNotFound(f"404: {url}")
        if 500 <= r.status_code < 600 and attempt < max_retries - 1:
            backoff = 2 ** attempt
            logger.warning("HTTP %d, retry dans %ss", r.status_code, backoff)
            time.sleep(backoff)
            continue
        r.raise_for_status()
        r.encoding = "utf-8"
        return r
    raise ScraperError(f"Échec après {max_retries} tentatives: {url}")


# ────────────────────────────────────────────────────────────
# Tournament page parsing
# ────────────────────────────────────────────────────────────

def fetch_tournament_meta(client: httpx.Client, tournament_id: int) -> dict[str, Any]:
    """Récupère les métadonnées d'un tournoi melee + ses rondes.

    Retourne :
        {
            "tournament_id": 13520,
            "tournament_guid": "cb798c34-...",
            "name": "...",
            "rounds": [
                {"id": 62951, "name": "Round 1", "completed": True},
                ...
            ],
        }
    """
    url = f"{MELEE_BASE}/Tournament/View/{tournament_id}"
    r = _get_with_retry(client, url)
    soup = BeautifulSoup(r.text, "lxml")

    # Standings selector → "completed" flag
    standings_container = soup.select_one("#standings-round-selector-container")
    if not standings_container:
        raise StandingsNotPublished(
            f"#standings-round-selector-container introuvable pour tournoi {tournament_id}"
        )

    rounds_by_id: dict[int, dict[str, Any]] = {}
    for btn in standings_container.select(".round-selector"):
        rid = btn.get("data-id")
        if not rid:
            continue
        rounds_by_id[int(rid)] = {
            "id": int(rid),
            "name": btn.get("data-name", "").strip(),
            "completed": btn.get("data-is-completed", "").strip().lower() == "true",
            "started": False,  # défaut, surchargé par pairings selector
        }

    # Pairings selector → "started" flag (round en cours = started=True && completed=False)
    pairings_container = soup.select_one("#pairings-round-selector-container")
    if pairings_container:
        for btn in pairings_container.select(".round-selector"):
            rid = btn.get("data-id")
            if not rid:
                continue
            rid_int = int(rid)
            if rid_int in rounds_by_id:
                rounds_by_id[rid_int]["started"] = (
                    btn.get("data-is-started", "").strip().lower() == "true"
                )

    rounds = list(rounds_by_id.values())

    if not rounds:
        raise StandingsNotPublished(f"Aucune ronde trouvée pour tournoi {tournament_id}")

    # Tournament GUID + nom
    guid_input = soup.select_one("input#TournamentGuid")
    title_meta = soup.select_one('meta[property="og:title"]')

    return {
        "tournament_id": tournament_id,
        "tournament_guid": guid_input.get("value") if guid_input else None,
        "name": title_meta.get("content") if title_meta else None,
        "rounds": rounds,
    }


def pick_latest_completed_round(rounds: list[dict[str, Any]]) -> dict[str, Any]:
    """Sélectionne la ronde complétée la plus récente."""
    completed = [r for r in rounds if r["completed"]]
    if not completed:
        raise StandingsNotPublished("Aucune ronde complétée")
    return completed[-1]


# ────────────────────────────────────────────────────────────
# Standings API call
# ────────────────────────────────────────────────────────────

def _build_datatables_payload(round_id: int, start: int, length: int) -> dict[str, str]:
    """Construit le payload form-encoded attendu par /Standing/GetRoundStandings.

    Toutes les clés sont uniques (columns[0][data], columns[0][name], ...),
    donc dict suffit (httpx encode mieux que liste de tuples).
    """
    cols = [
        "Rank", "Team", "Decklists", "MatchRecord", "GameRecord", "Points",
        "OpponentMatchWinPercentage", "TeamGameWinPercentage",
        "OpponentGameWinPercentage", "FinalTiebreaker", "OpponentCount",
    ]
    payload: dict[str, str] = {
        "draw": "1",
        "start": str(start),
        "length": str(length),
        "search[value]": "",
        "search[regex]": "false",
        "order[0][column]": "0",
        "order[0][dir]": "asc",
        "roundId": str(round_id),
    }
    for i, name in enumerate(cols):
        payload.update({
            f"columns[{i}][data]": name,
            f"columns[{i}][name]": "",
            f"columns[{i}][searchable]": "true",
            f"columns[{i}][orderable]": "true",
            f"columns[{i}][search][value]": "",
            f"columns[{i}][search][regex]": "false",
        })
    return payload


def fetch_pairings(
    client: httpx.Client,
    tournament_id: int,
    round_id: int,
) -> list[dict[str, Any]]:
    """Récupère les pairings/résultats d'une ronde via /Match/GetRoundMatches/{roundId}.

    Pendant une ronde en cours : HasResult=false, GameWins se met à jour en
    temps réel à chaque game soumise. À la fin : HasResult=true.

    Retourne la liste brute des matchs (chaque entrée a Competitors[2] avec
    Team.Players, GameWins, Decklists, etc.).
    """
    url = f"{MELEE_BASE}/Match/GetRoundMatches/{round_id}"
    referer = f"{MELEE_BASE}/Tournament/View/{tournament_id}"

    payload = {
        "draw": "1",
        "start": "0",
        "length": str(PAGE_SIZE),
        "order[0][column]": "0",
        "order[0][dir]": "asc",
        "columns[0][data]": "TableNumber",
        "columns[1][data]": "Teams",
        "columns[2][data]": "ResultString",
    }
    all_rows: list[dict[str, Any]] = []
    start = 0
    while True:
        payload["start"] = str(start)
        r = client.post(
            url,
            data=payload,
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": referer,
            },
        )
        r.raise_for_status()
        data = r.json()
        if data.get("Error"):
            raise ParseError(f"melee API error pairings: {data.get('Message')}")
        rows = data.get("data", [])
        all_rows.extend(rows)
        total = data.get("recordsTotal", 0)
        if len(all_rows) >= total or not rows:
            break
        start += PAGE_SIZE
    return all_rows


def pick_in_progress_round(rounds: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Trouve la ronde "active" = en cours (started && !completed) ou juste finie.

    Logique :
    1. Si une ronde a started=True && completed=False → c'est la ronde live, on la prend
    2. Sinon, on retourne la dernière ronde COMPLÉTÉE (rétrospective : "Round X
       résultats") — utile entre 2 rondes ou en fin de Day 1
    3. En tout début de tournoi (aucune ronde started), on retourne None
    """
    in_progress = [r for r in rounds if r.get("started") and not r["completed"]]
    if in_progress:
        return in_progress[0]
    completed = [r for r in rounds if r["completed"]]
    return completed[-1] if completed else None


def pick_previous_completed_round(
    rounds: list[dict[str, Any]],
    live_round: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Retourne la dernière ronde complétée DIFFÉRENTE de live_round.

    Use case : quand live_round = ronde en cours (R9 en train de jouer), on veut
    afficher en plus la R8 finalisée juste avant, sans protection spoiler.
    Si live_round est déjà la dernière complétée (entre 2 rondes), on retourne
    None pour éviter le doublon.
    """
    if not live_round:
        return None
    completed = [r for r in rounds if r["completed"] and r["id"] != live_round["id"]]
    if not completed:
        return None
    # Si live_round n'est pas en progress (= il est lui-même completed), pas de précédent
    if live_round["completed"]:
        return None
    return completed[-1]


def filter_french_pairings(
    pairings: list[dict[str, Any]],
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    """Garde uniquement les matchs où au moins un Français joue.

    Format de sortie compact, prêt pour le frontend :
        {
            "table": 12,
            "round": 8,
            "hasResult": true|false,
            "featured": true,
            "fr": {"name": "Depraz, Jean-Emmanuel", "first": "Jean-Emmanuel",
                   "last": "Depraz", "gameWins": 2, "archetype": "Izzet Prowess"},
            "opponent": {"name": "Steuer, Nathan", "first": "Nathan",
                         "last": "Steuer", "gameWins": 1, "archetype": "Selesnya Landfall"},
        }
    """
    # Même filtre défensif que identify_french : verified=true uniquement.
    fr_index = {
        normalize_name(p["name"]): p
        for p in config.get("players", [])
        if p.get("verified") is True
    }
    excluded_norm = {normalize_name(p["name"]) for p in config.get("excluded", [])}

    def _competitor_to_compact(c: dict[str, Any]) -> dict[str, Any]:
        team = c.get("Team") or {}
        players = team.get("Players") or []
        if not players:
            name = ""
        elif len(players) == 1:
            name = (players[0].get("DisplayNameLastFirst") or "").strip()
        else:
            name = " / ".join(p.get("DisplayNameLastFirst", "") for p in players)
        last, sep, first = name.partition(",")
        decklists = c.get("Decklists") or []
        archetype = decklists[0].get("DecklistName") if decklists else None
        decklist_id = decklists[0].get("DecklistId") if decklists else None
        return {
            "name": name,
            "last": last.strip(),
            "first": first.strip() if sep else "",
            "gameWins": c.get("GameWins") or 0,
            "archetype": archetype,
            "decklistId": decklist_id,
            "decklistUrl": (
                f"{MELEE_BASE}/Decklist/View/{decklist_id}" if decklist_id else None
            ),
        }

    out = []
    for match in pairings:
        competitors = match.get("Competitors") or []
        if len(competitors) < 2:
            continue
        c1, c2 = competitors[0], competitors[1]
        n1 = normalize_name(_competitor_to_compact(c1)["name"])
        n2 = normalize_name(_competitor_to_compact(c2)["name"])

        # Skip si l'un des deux est dans la liste excluded (Canadiens etc.)
        if n1 in excluded_norm or n2 in excluded_norm:
            # Note : on pourrait quand même afficher si l'autre est FR.
            # Mais pour rester clean : si un excluded joue contre un FR, on garde.
            pass

        c1_is_fr = n1 in fr_index
        c2_is_fr = n2 in fr_index
        if not c1_is_fr and not c2_is_fr:
            continue

        if c1_is_fr:
            fr_compact, opp_compact = _competitor_to_compact(c1), _competitor_to_compact(c2)
        else:
            fr_compact, opp_compact = _competitor_to_compact(c2), _competitor_to_compact(c1)

        out.append({
            "table": match.get("TableNumber"),
            "round": match.get("RoundNumber"),
            "hasResult": match.get("HasResult", False),
            "featured": match.get("FeatureMatch", False),
            "podNumber": match.get("PodNumber"),  # pour les drafts
            "fr": fr_compact,
            "opponent": opp_compact,
            "frVsFr": c1_is_fr and c2_is_fr,
        })
    return out


def fetch_standings(
    client: httpx.Client,
    tournament_id: int,
    round_id: int,
) -> list[dict[str, Any]]:
    """Récupère TOUTES les standings d'une ronde (paginé si besoin)."""
    url = f"{MELEE_BASE}/Standing/GetRoundStandings"
    referer = f"{MELEE_BASE}/Tournament/View/{tournament_id}"

    all_rows: list[dict[str, Any]] = []
    start = 0
    while True:
        payload = _build_datatables_payload(round_id, start, PAGE_SIZE)
        r = client.post(
            url,
            data=payload,
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": referer,
            },
        )
        r.raise_for_status()
        data = r.json()

        if data.get("Error"):
            raise ParseError(f"melee API error: {data.get('Message')}")

        rows = data.get("data", [])
        all_rows.extend(rows)

        total = data.get("recordsTotal", 0)
        if len(all_rows) >= total or not rows:
            break
        start += PAGE_SIZE

    return all_rows


# ────────────────────────────────────────────────────────────
# Identification des Français
# ────────────────────────────────────────────────────────────

def load_french_config() -> dict[str, Any]:
    config = yaml.safe_load(FRENCH_FILE.read_text(encoding="utf-8"))
    for section in ("players", "excluded"):
        for entry in config.get(section, []):
            if not isinstance(entry, dict) or "name" not in entry:
                raise ValueError(f"Entrée invalide dans {section}: {entry!r} (manque 'name')")
    return config


def _melee_player_name(row: dict[str, Any]) -> str:
    """Extrait le nom 'Last, First' depuis un row melee (équivalent format magic.gg).

    Pour les tournois individuels : Team.Players[0].DisplayNameLastFirst.
    Pour les tournois par équipes : on concatène (rare en PT).
    """
    team = row.get("Team") or {}
    players = team.get("Players") or []
    if not players:
        return ""
    if len(players) == 1:
        return (players[0].get("DisplayNameLastFirst") or "").strip()
    return " / ".join(p.get("DisplayNameLastFirst", "") for p in players)


def build_field_archetypes(
    pairings: list[dict[str, Any]],
) -> dict[str, int]:
    """Map archetype name → count à partir des pairings.

    Permet de calculer la méta-share globale du tournoi (toutes nationalités).
    On dédupe par TeamId pour ne pas compter un joueur plusieurs fois s'il
    apparaît dans plusieurs matchs (impossible dans une ronde, mais défensif).
    """
    seen_teams: set[int] = set()
    counts: dict[str, int] = {}
    for match in pairings:
        for c in match.get("Competitors") or []:
            team_id = c.get("TeamId")
            if team_id is None or team_id in seen_teams:
                continue
            seen_teams.add(team_id)
            decklists = c.get("Decklists") or []
            if not decklists:
                continue
            archetype = (decklists[0].get("DecklistName") or "").strip()
            if not archetype:
                continue
            counts[archetype] = counts.get(archetype, 0) + 1
    return counts


def build_decklist_index(
    pairings: list[dict[str, Any]],
) -> dict[str, str]:
    """Map nom_normalisé → DecklistId à partir des pairings d'une ronde.

    Les standings melee n'incluent pas les decklists, mais les pairings oui.
    On utilise les pairings de la dernière ronde pour récupérer les ID.
    """
    index: dict[str, str] = {}
    for match in pairings:
        for c in match.get("Competitors") or []:
            team = c.get("Team") or {}
            players = team.get("Players") or []
            if not players:
                continue
            name = (players[0].get("DisplayNameLastFirst") or "").strip()
            if not name:
                continue
            decklists = c.get("Decklists") or []
            if not decklists:
                continue
            decklist_id = decklists[0].get("DecklistId")
            if decklist_id:
                index[normalize_name(name)] = decklist_id
    return index


def identify_french(
    standings: list[dict[str, Any]],
    config: dict[str, Any],
    decklist_index: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Croise les standings melee avec la liste FR (matching normalisé).

    Filtre défensif : on n'inclut QUE les joueurs verified=true. Les
    candidats non-vérifiés (verified=false ou absent) ne fuitent jamais
    publiquement, même s'ils sont accidentellement laissés dans players:.
    """
    fr_index = {
        normalize_name(p["name"]): p
        for p in config.get("players", [])
        if p.get("verified") is True
    }
    excluded_norm = {normalize_name(p["name"]) for p in config.get("excluded", [])}

    n_pending = sum(
        1 for p in config.get("players", []) if p.get("verified") is not True
    )
    if n_pending:
        logger.warning("%d joueurs non-vérifiés ignorés (verified != true)", n_pending)

    result = []
    for row in standings:
        player_name = _melee_player_name(row)
        if not player_name:
            continue
        norm = normalize_name(player_name)
        if norm in excluded_norm:
            continue
        fr_meta = fr_index.get(norm)
        if fr_meta is None:
            continue
        result.append({
            "rank": row.get("Rank"),
            "player_name": player_name,
            "points": row.get("Points"),
            "match_record": row.get("MatchRecord"),
            "game_record": row.get("GameRecord"),
            "omw": row.get("OpponentMatchWinPercentage"),
            "gw": row.get("TeamGameWinPercentage"),
            "ogw": row.get("OpponentGameWinPercentage"),
            "decklist_id": (decklist_index or {}).get(norm),
            "twitter": fr_meta.get("twitter"),
            "verified": True,
        })
    return result


# ────────────────────────────────────────────────────────────
# Build & merge (compat avec le format magic.gg pour le frontend)
# ────────────────────────────────────────────────────────────

PRESERVED_FIELDS = (
    "draftD1", "standardD1", "draftD2", "standardD2",
    "finalRecord", "archetype", "source", "rcOrigin", "flag", "noLimited",
)


def _split_player_name(player: str) -> tuple[str, str]:
    last, sep, first = player.partition(",")
    if not sep:
        return player.strip(), ""
    return last.strip(), first.strip()


def _player_key(p: dict[str, Any]) -> str:
    return f"{normalize_name(p.get('last', ''))}|{normalize_name(p.get('first', ''))}"


def load_existing_event_data(slug: str) -> dict[str, Any] | None:
    path = DATA_OUT / f"{slug}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("JSON existant illisible pour %s: %s", slug, e)
        return None


def build_event_data(
    slug: str,
    tournament_meta: dict[str, Any],
    round_info: dict[str, Any],
    total_rounds: int,
    standings: list[dict[str, Any]],
    french: list[dict[str, Any]],
    existing: dict[str, Any] | None,
    live_round: dict[str, Any] | None = None,
    live_matches: list[dict[str, Any]] | None = None,
    previous_round: dict[str, Any] | None = None,
    previous_matches: list[dict[str, Any]] | None = None,
    field_archetypes: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Construit le JSON final compatible avec le frontend."""
    # Extrait le numéro de ronde depuis "Round 8" → 8
    round_num_match = re.search(r"\d+", round_info["name"])
    round_n = int(round_num_match.group(0)) if round_num_match else 0

    existing_index: dict[str, dict[str, Any]] = {}
    if existing:
        for ep in existing.get("frenchPlayers", []):
            existing_index[_player_key(ep)] = ep

    players_out = []
    for p in french:
        last, first = _split_player_name(p["player_name"])
        new_entry: dict[str, Any] = {
            "rank": p["rank"],
            "first": first,
            "last": last,
            "points": p["points"],
            "omw": round(p["omw"], 4) if p["omw"] is not None else None,
            "gw": round(p["gw"], 4) if p["gw"] is not None else None,
            "ogw": round(p["ogw"], 4) if p["ogw"] is not None else None,
            "matchRecord": p["match_record"],
            "gameRecord": p["game_record"],
            "decklistId": p.get("decklist_id"),
            "decklistUrl": (
                f"{MELEE_BASE}/Decklist/View/{p['decklist_id']}"
                if p.get("decklist_id") else None
            ),
            # Champs enrichis manuellement, défaults si pas de JSON existant
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
                if (
                    field in prev
                    and prev[field] is not None
                    and prev[field] not in ("Inconnu", "À vérifier")
                ):
                    new_entry[field] = prev[field]
        players_out.append(new_entry)

    out: dict[str, Any] = {
        "slug": slug,
        "round": round_n,
        "totalRounds": total_rounds,
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "fieldSize": len(standings),
        "source": "melee.gg",
        "tournamentId": tournament_meta["tournament_id"],
        "frenchPlayers": players_out,
    }
    if live_round and live_matches is not None:
        live_round_num_match = re.search(r"\d+", live_round.get("name", ""))
        out["liveRound"] = {
            "name": live_round["name"],
            "number": int(live_round_num_match.group(0)) if live_round_num_match else None,
            "started": live_round.get("started", False),
        }
        out["liveMatches"] = live_matches
    if previous_round and previous_matches is not None:
        prev_num = re.search(r"\d+", previous_round.get("name", ""))
        out["previousRound"] = {
            "name": previous_round["name"],
            "number": int(prev_num.group(0)) if prev_num else None,
            "started": True,
        }
        out["previousMatches"] = previous_matches
    if field_archetypes:
        out["fieldArchetypes"] = field_archetypes
    return out


# ────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────

def _resolve_tournament_id(slug: str) -> int | None:
    """Récupère meleeId depuis events.json pour un slug donné."""
    if not EVENTS_FILE.exists():
        return None
    events = json.loads(EVENTS_FILE.read_text(encoding="utf-8"))
    for e in events:
        if e.get("slug") == slug:
            return e.get("meleeId")
    return None


def _setup_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        stream=sys.stderr,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", required=True, help="Slug événement (matche events.json)")
    parser.add_argument("--tournament-id", type=int,
                       help="ID melee.gg (sinon résolu depuis events.json)")
    parser.add_argument("--round-id", type=int,
                       help="Round ID melee précis (sinon dernière ronde complétée)")
    parser.add_argument("--total-rounds", type=int, default=16,
                       help="Total rondes prévues (défaut: 16, Worlds: 14)")
    parser.add_argument("--dry-run", action="store_true",
                       help="N'écrit pas, affiche stdout")
    parser.add_argument("--output", type=Path, help="Fichier sortie alternatif")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    _setup_logging(args.verbose)

    if not SLUG_REGEX.fullmatch(args.slug):
        parser.error(f"Slug invalide: {args.slug!r}")

    # Résolution tournament_id
    tournament_id = args.tournament_id or _resolve_tournament_id(args.slug)
    if not tournament_id:
        parser.error(
            f"Pas de --tournament-id et pas de meleeId dans events.json pour {args.slug}"
        )
    if tournament_id < 1 or tournament_id > 99_999_999:
        parser.error(f"tournament_id hors range: {tournament_id}")

    logger.info("Slug: %s, tournament: %d", args.slug, tournament_id)

    existing = load_existing_event_data(args.slug)

    with httpx.Client(timeout=TIMEOUT, follow_redirects=True) as client:
        # 1. Métadonnées + round IDs
        try:
            meta = fetch_tournament_meta(client, tournament_id)
        except (TournamentNotFound, StandingsNotPublished) as e:
            if args.dry_run:
                logger.warning("%s — dry-run: validation config", e)
                config = load_french_config()
                logger.info("french_players.yaml chargé: %d FR, %d exclus",
                          len(config.get("players", [])),
                          len(config.get("excluded", [])))
                return 0
            raise
        logger.info("Tournoi: %s (%d rondes annoncées)",
                   meta.get("name"), len(meta["rounds"]))

        # 2. Sélection de la ronde
        if args.round_id:
            round_info = next((r for r in meta["rounds"] if r["id"] == args.round_id), None)
            if not round_info:
                parser.error(f"Round ID {args.round_id} introuvable dans le tournoi")
        else:
            try:
                round_info = pick_latest_completed_round(meta["rounds"])
            except StandingsNotPublished as e:
                if args.dry_run:
                    logger.warning("%s — dry-run: validation config", e)
                    return 0
                raise
        logger.info("Ronde: %s (id=%d, completed=%s)",
                   round_info["name"], round_info["id"], round_info["completed"])

        # 3. Standings via API
        standings = fetch_standings(client, tournament_id, round_info["id"])
        logger.info("%d joueurs dans le standings", len(standings))

        # 4. Pairings de la ronde active (en cours OU dernière complétée)
        # Sert AUSSI à extraire les DecklistId pour les standings (qui ne les
        # exposent pas directement).
        config = load_french_config()
        live_round = pick_in_progress_round(meta["rounds"])
        live_matches: list[dict[str, Any]] = []
        decklist_index: dict[str, str] = {}
        field_archetypes: dict[str, int] = {}
        previous_round = None
        previous_matches: list[dict[str, Any]] = []
        if live_round:
            try:
                pairings = fetch_pairings(client, tournament_id, live_round["id"])
                live_state = (
                    "en cours"
                    if live_round.get("started") and not live_round["completed"]
                    else "complétée"
                )
                logger.info("%d matchs sur %s (%s)",
                          len(pairings), live_round["name"], live_state)
                decklist_index = build_decklist_index(pairings)
                field_archetypes = build_field_archetypes(pairings)
                logger.info("%d decklists indexées, %d archétypes uniques",
                          len(decklist_index), len(field_archetypes))
                live_matches = filter_french_pairings(pairings, config)
                logger.info("%d matchs avec au moins un Français",
                          len(live_matches))
            except (httpx.HTTPError, ParseError) as e:
                logger.warning("Pairings indisponibles: %s", e)
                live_round = None

        # Si live_round est en progress (started && !completed), on récupère
        # AUSSI la dernière ronde complétée différente — affichée sans spoiler
        # comme bloc rétrospectif "Round X-1 résultats".
        previous_round = pick_previous_completed_round(meta["rounds"], live_round)
        if previous_round:
            try:
                prev_pairings = fetch_pairings(client, tournament_id, previous_round["id"])
                logger.info("%d matchs sur ronde précédente %s (sans spoiler)",
                          len(prev_pairings), previous_round["name"])
                # Enrichit l'index decklist au passage (les FR jouent souvent les mêmes decks)
                prev_index = build_decklist_index(prev_pairings)
                for k, v in prev_index.items():
                    decklist_index.setdefault(k, v)
                previous_matches = filter_french_pairings(prev_pairings, config)
                logger.info("%d matchs FR sur la ronde précédente",
                          len(previous_matches))
            except (httpx.HTTPError, ParseError) as e:
                logger.warning("Pairings ronde précédente indisponibles: %s", e)
                previous_round = None

    # 5. Identification FR (standings) avec injection des decklist IDs
    french = identify_french(standings, config, decklist_index)
    logger.info("%d Français identifiés (standings)", len(french))

    # 6. Build + merge
    event_data = build_event_data(
        args.slug, meta, round_info, args.total_rounds,
        standings, french, existing,
        live_round=live_round, live_matches=live_matches,
        previous_round=previous_round, previous_matches=previous_matches,
        field_archetypes=field_archetypes if field_archetypes else None,
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
