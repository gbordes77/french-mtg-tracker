# Public Data API (de facto)

The French MTG Tracker has **no formal API server**. Instead, the static JSON files committed to `public/data/` and served by Vercel CDN constitute a **de facto API** that any third party can consume.

This document describes the endpoints, schemas, and usage patterns, plus the (informal) versioning policy.

---

## Base URL

```
Production : https://french-mtg-tracker.vercel.app/data/
Mirror (raw)
GitHub      : https://raw.githubusercontent.com/gbordes77/french-mtg-tracker/main/public/data/
```

The Vercel URL is the canonical source. The GitHub raw URL works as a mirror but does not benefit from CDN caching.

---

## Endpoints

### `GET /data/events.json`

Returns the list of all tracked events (past, live, upcoming).

**Response shape** : `MTGEvent[]`

**Example** :

```bash
curl https://french-mtg-tracker.vercel.app/data/events.json
```

```json
[
  {
    "slug": "pt-secrets-of-strixhaven",
    "name": "Pro Tour Secrets of Strixhaven",
    "shortName": "PT Strixhaven",
    "location": "Las Vegas, USA",
    "dates": "1–3 mai 2026",
    "status": "live",
    "currentRound": 8,
    "totalRounds": 16,
    "formats": "Strixhaven Draft + Standard",
    "field": 325,
    "purse": 500000,
    "meleeId": 415628,
    "sourceUrl": "https://magic.gg/events/pro-tour-secrets-of-strixhaven"
  },
  {
    "slug": "worlds-31",
    "name": "Magic World Championship 31",
    "shortName": "Worlds 31",
    "location": "Atlanta, USA",
    "dates": "5–7 décembre 2025",
    "status": "ended",
    "currentRound": 16,
    "totalRounds": 16,
    "formats": "Standard",
    "field": 128,
    "purse": 1000000,
    "meleeId": null,
    "sourceUrl": "https://magic.gg/events/magic-world-championship-31"
  }
]
```

#### `MTGEvent` schema

| Field | Type | Notes |
|---|---|---|
| `slug` | `string` | Stable identifier (`pt-secrets-of-strixhaven`, `worlds-31`, `magic-spotlight-secrets-london`). Matches `{slug}.json` filename. |
| `name` | `string` | Full official event name |
| `shortName` | `string` | Abbreviated for compact UI |
| `location` | `string` | Free-text city + country |
| `dates` | `string` | French human format (`1–3 mai 2026`). NOT ISO. |
| `status` | `"upcoming" \| "live" \| "ended"` | Drives whether the scraper polls |
| `currentRound` | `number` | 0 if upcoming, `totalRounds` if ended |
| `totalRounds` | `number` | Usually 16 (PT). Worlds = 14. Spotlight varies. |
| `formats` | `string` | `"Standard"`, `"{Set} Draft + Standard"`, etc. |
| `field` | `number \| null` | Total registered players (null pre-event) |
| `purse` | `number` | USD prize pool |
| `meleeId` | `number \| null` | melee.gg `TournamentId`. `null` for Worlds (magic.gg only). |
| `sourceUrl` | `string` | Canonical event URL on magic.gg |

---

### `GET /data/{slug}.json`

Returns standings, French players, and (when live) current-round pairings for one event.

**Response shape** : `EventData`

**Example** :

```bash
curl https://french-mtg-tracker.vercel.app/data/pt-secrets-of-strixhaven.json
```

```json
{
  "slug": "pt-secrets-of-strixhaven",
  "round": 8,
  "totalRounds": 16,
  "scrapedAt": "2026-05-02T17:28:43.283494+00:00",
  "fieldSize": 325,
  "source": "melee.gg",
  "tournamentId": 415628,
  "frenchPlayers": [
    {
      "rank": 5,
      "first": "Thierry",
      "last": "Ramboa",
      "points": 21,
      "omw": 0.6198,
      "gw": 0.8235,
      "ogw": 0.5656,
      "matchRecord": "7-1-0",
      "gameRecord": "14-3-0",
      "decklistId": null,
      "decklistUrl": null,
      "draftD1": "3-0",
      "standardD1": "4-1",
      "draftD2": null,
      "standardD2": null,
      "finalRecord": null,
      "archetype": "Izzet Prowess",
      "source": "39+ AMP",
      "rcOrigin": "EMEA",
      "twitter": "@Triphop_MTG"
    }
  ],
  "liveRound": {
    "name": "Round 9",
    "number": 9,
    "started": true
  },
  "liveMatches": [
    {
      "table": 12,
      "round": 9,
      "hasResult": false,
      "featured": true,
      "podNumber": null,
      "fr": {
        "name": "Depraz, Jean-Emmanuel",
        "last": "Depraz",
        "first": "Jean-Emmanuel",
        "gameWins": 1,
        "archetype": "Izzet Prowess",
        "decklistId": "abc123-…",
        "decklistUrl": "https://melee.gg/Decklist/View/abc123-…"
      },
      "opponent": {
        "name": "Steuer, Nathan",
        "last": "Steuer",
        "first": "Nathan",
        "gameWins": 1,
        "archetype": "Selesnya Landfall",
        "decklistId": "def456-…",
        "decklistUrl": "https://melee.gg/Decklist/View/def456-…"
      },
      "frVsFr": false
    }
  ],
  "fieldArchetypes": {
    "Izzet Prowess": 41,
    "Mono-Green Landfall": 28,
    "Bant Rhythm": 19
  }
}
```

#### `EventData` schema

| Field | Type | Notes |
|---|---|---|
| `slug` | `string` | Echoes the event slug |
| `round` | `number` | Round number of the standings (latest completed) |
| `totalRounds` | `number` | Echoes `MTGEvent.totalRounds` |
| `scrapedAt` | `string` (ISO 8601 UTC) | When the data was fetched |
| `fieldSize` | `number` | Total players in standings |
| `source` | `"melee.gg" \| "magic.gg"` | Which scraper produced this |
| `tournamentId` | `number` (optional) | melee `TournamentId` if `source === "melee.gg"` |
| `frenchPlayers` | `FrenchPlayer[]` | Filtered to verified FR only |
| `liveRound` | `LiveRound` (optional) | Current in-progress round if any |
| `liveMatches` | `LiveMatch[]` (optional) | Matches with at least one FR (only if `liveRound` set) |
| `fieldArchetypes` | `Record<string, number>` (optional) | Archetype → count over the entire field (deduped by TeamId) |

#### `FrenchPlayer` schema

| Field | Type | Notes |
|---|---|---|
| `rank` | `number` | Position in standings |
| `first`, `last` | `string` | Display fields, accents preserved |
| `points` | `number` | Match points |
| `omw` | `number` | Opponent Match Win % (0..1, NOT 0..100) |
| `gw` | `number` (optional) | Team Game Win % (melee only) |
| `ogw` | `number` (optional) | Opponent Game Win % (melee only) |
| `matchRecord` | `string` (optional) | `"7-1-0"` (W-L-D, melee only) |
| `gameRecord` | `string` (optional) | `"14-3-0"` (melee only) |
| `decklistId` | `string \| null` | melee GUID |
| `decklistUrl` | `string \| null` | full URL to melee.gg decklist |
| `draftD1`, `standardD1`, `draftD2`, `standardD2` | `string \| null` | Per-format sub-records (`"3-0"`, `"4-1"`, `"DROP"`, `null`) |
| `finalRecord` | `string \| null` | Final record after the event |
| `archetype` | `string` | Deck name (`"Izzet Prowess"`); fallback `"Inconnu"` |
| `source` | `string` | Invitation source (`"39+ AMP"`, `"RC EMEA"`, `"Worlds 31 Top 8"`, `"Spotlight Lyon"`, `"Deferred PT ECL"`…) |
| `rcOrigin` | `string` | RC region (`"EMEA"`, `"FR"`, `"FR (champion)"`) |
| `flag` | `string` (optional) | Emoji decoration (`"👑"` for the world champion) |
| `noLimited` | `boolean` (optional) | True for Worlds (Standard-only, no Draft) |
| `twitter` | `string \| null` (optional) | `"@JEDepraz"` |

#### `LiveRound` schema

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | `"Round 9"` |
| `number` | `number \| null` | Parsed numeric, null if name has no digits |
| `started` | `boolean` | Whether matches have been seated/started |

#### `LiveMatch` schema

| Field | Type | Notes |
|---|---|---|
| `table` | `number` | Table number (1 = featured / table de coverage) |
| `round` | `number` | Round number |
| `hasResult` | `boolean` | `false` while in progress, `true` once submitted |
| `featured` | `boolean` | Stream-covered featured match |
| `podNumber` | `number \| null` | For Booster Draft rounds |
| `fr` | `LiveMatchCompetitor` | The French player (always present) |
| `opponent` | `LiveMatchCompetitor` | The other player |
| `frVsFr` | `boolean` | Both players are FR (rare but possible) |

#### `LiveMatchCompetitor` schema

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | `"Last, First"` or username |
| `last`, `first` | `string` | Split |
| `gameWins` | `number` | 0/1/2 typically |
| `archetype` | `string \| null` | From decklist |
| `decklistId` | `string \| null` | melee GUID |
| `decklistUrl` | `string \| null` | full URL |

---

### `GET /data/amp.json`

Cumulative AMP standings across the season's PTs (raw rows from magic.gg AMP page).

**Response shape** : `AmpData`

**Example** :

```bash
curl https://french-mtg-tracker.vercel.app/data/amp.json
```

```json
{
  "lastUpdated": "March 5, 2026",
  "scrapedAt": "2026-05-02T16:15:53.234051+00:00",
  "ptColumns": [
    "Post PT ECL Total",
    "Post PT MSH Total",
    "Post PT SOS Total"
  ],
  "players": [
    {
      "Last Name": "Sánchez",
      "First Name": "Francisco",
      "WC 32 Invited": "Yes",
      "PT MSH Invited": "Yes",
      "PT SOS Invited": "Yes",
      "PT1 2027 Invited": "Yes",
      "Post PT ECL Total": 103,
      "Post PT MSH Total": 45,
      "Post PT SOS Total": 85
    }
  ]
}
```

#### `AmpData` schema

| Field | Type | Notes |
|---|---|---|
| `lastUpdated` | `string \| null` | Free-text date as printed on magic.gg (`"March 5, 2026"`). NOT ISO. |
| `scrapedAt` | `string` (ISO 8601 UTC) | When the scrape ran |
| `ptColumns` | `string[]` | Detected `"Post PT XXX Total"` columns |
| `players` | `AmpPlayer[]` | Full worldwide list (NOT filtered to FR — consumer filters as needed) |

#### `AmpPlayer` schema

Schema is *loose* because it mirrors the upstream HTML table columns and Wizards adds new ones each PT. Stable keys:

| Field | Type | Notes |
|---|---|---|
| `"Last Name"` | `string` | Diacritics preserved |
| `"First Name"` | `string` | |
| `"Post PT XXX Total"` | `number \| null` | Cumulative AMP after PT XXX (where XXX ∈ ECL/MSH/SOS/...) |
| `"WC NN Invited"` | `"Yes" \| ""` | Worlds NN invitation status |
| `"PT XXX Invited"` | `"Yes" \| ""` | PT invitation status |
| `[other keys]` | `unknown` | Forward-compatible — consumers should ignore unknown keys |

> The frontend extracts the latest `"Post PT XXX Total"` column dynamically, so adding a PT mid-season doesn't require a code change.

---

## Usage examples

### JavaScript (browser)

```javascript
async function fetchLiveEvent() {
  const events = await fetch("/data/events.json").then(r => r.json());
  const live = events.find(e => e.status === "live");
  if (!live) return null;
  const data = await fetch(`/data/${live.slug}.json`).then(r => r.json());
  return data;
}
```

### curl

```bash
# Liste des events
curl -s https://french-mtg-tracker.vercel.app/data/events.json | jq '.[].slug'

# Détail d'un PT
curl -s https://french-mtg-tracker.vercel.app/data/pt-secrets-of-strixhaven.json | jq '.frenchPlayers[] | {rank, last, points, archetype}'

# Top FR à AMP, dernière colonne PT
curl -s https://french-mtg-tracker.vercel.app/data/amp.json | jq '
  .ptColumns[-1] as $col |
  .players
  | map(select(.[$col] != null))
  | sort_by(.[$col]) | reverse
  | .[0:10]
'
```

### Python + requests + pandas

```python
import requests
import pandas as pd

BASE = "https://french-mtg-tracker.vercel.app/data"

# Events
events = requests.get(f"{BASE}/events.json").json()
events_df = pd.DataFrame(events)

# Live PT
live = next((e for e in events if e["status"] == "live"), None)
if live:
    pt = requests.get(f"{BASE}/{live['slug']}.json").json()
    fr_df = pd.DataFrame(pt["frenchPlayers"])
    print(fr_df[["rank", "last", "first", "points", "archetype"]].head(10))

# AMP race
amp = requests.get(f"{BASE}/amp.json").json()
amp_df = pd.DataFrame(amp["players"])
last_col = amp["ptColumns"][-1]
top10_amp = amp_df.dropna(subset=[last_col]).nlargest(10, last_col)
print(top10_amp[["First Name", "Last Name", last_col]])
```

### Python + httpx (async)

```python
import asyncio
import httpx

async def fetch_all():
    async with httpx.AsyncClient(base_url="https://french-mtg-tracker.vercel.app") as c:
        events, amp = await asyncio.gather(
            c.get("/data/events.json"),
            c.get("/data/amp.json"),
        )
        events = events.json()
        live = [e for e in events if e["status"] == "live"]
        slugs = await asyncio.gather(*[c.get(f"/data/{e['slug']}.json") for e in live])
        return events, [s.json() for s in slugs], amp.json()

events, pts, amp = asyncio.run(fetch_all())
```

---

## CORS, caching, and rate limits

- **CORS** : `Access-Control-Allow-Origin: *` (Vercel default for static assets). Browser fetches from any origin work.
- **Cache headers** : Vercel returns `cache-control: public, max-age=0, must-revalidate` by default for HTML, but JSON files in `/public/data/` typically come back with edge caching ~1 min. Don't rely on this; use `?ts=…` query param if you need to bust the cache.
- **Rate limits** : none enforced. Be polite — if you poll, do it every 60 s minimum (the data refreshes at most every 5 min upstream). Hammering wastes Vercel bandwidth and gives you no fresher data.

---

## Versioning policy (informal)

The project is **pre-1.0** and there's no formal API versioning. However:

### What WILL stay stable

- Endpoint paths: `/data/events.json`, `/data/{slug}.json`, `/data/amp.json`.
- Core fields documented above (`slug`, `rank`, `points`, `last`, `first`, `archetype`, `source`, `omw`).
- `omw` / `gw` / `ogw` will always be 0..1 floats, not 0..100 percentages.

### What MIGHT change

- New optional fields can be added anytime (the schema is open). Consumers MUST ignore unknown keys.
- `AmpPlayer` columns evolve every PT (`Post PT SOS Total` → `Post PT MSH Total` → …). Don't hardcode column names; iterate over `ptColumns[]`.
- `liveMatches[]` and `fieldArchetypes` are **only present when populated**. Treat them as optional.
- Field types may switch from `null` to omitted (or vice versa) for "no data" states.

### What will trigger a major version bump (if/when v1.0)

- Removing a documented field.
- Changing a unit (e.g. `omw` from float to percentage).
- Renaming an endpoint.

When v1.0 lands, this section will be replaced with a proper SemVer policy and a `/data/version.json` endpoint with the schema version.

---

## Permissive use

Consumers are welcome:

- Personal scripts, dashboards, Discord bots → go for it, no key needed.
- Aggregation in third-party MTG sites → please credit `french-mtg-tracker.vercel.app` and link back.
- Scraping at high frequency → please don't, the upstream data updates every 5 min max. Cache locally.

If you build something cool on top, ping `@gbordes77` or open a PR adding it to the README.

---

## Reporting data issues

If you spot incorrect data:

| Issue type | Where to report |
|---|---|
| Wrong FR classification (missing FR / non-FR included) | GitHub issue with evidence (cf. [`METHODOLOGY.md`](METHODOLOGY.md)) |
| Stale standings during a live PT | Check [GitHub Actions](https://github.com/gbordes77/french-mtg-tracker/actions) — the cron may have failed |
| Wrong archetype / source field | PR on `public/data/{slug}.json` is fine for these (manually-curated fields, see [`ARCHITECTURE.md`](ARCHITECTURE.md) §2) |
| Schema regression vs this doc | High-priority, ping `@gbordes77` |
