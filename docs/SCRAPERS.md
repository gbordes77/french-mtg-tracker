# Scrapers Guide

Operational guide for the three Python scrapers. Read this if you need to debug a failure during a live Pro Tour, evolve the parsing logic, or recover when an upstream API breaks.

> Architectural overview: [`ARCHITECTURE.md`](ARCHITECTURE.md). Output schemas: [`API.md`](API.md). FR identification logic: [`METHODOLOGY.md`](METHODOLOGY.md).

---

## 1. The three scrapers

| File | Source | Role | Used by |
|---|---|---|---|
| `scrapers/scrape_melee.py` | melee.gg DataTables JSON | **Primary** standings + pairings + decklists | GHA cron (every 5 min when live) |
| `scrapers/scrape_event.py` | magic.gg HTML standings | **Fallback** when melee fails or no `meleeId` | GHA cron fallback step |
| `scrapers/scrape_amp.py` | magic.gg AMP standings page | Cumulative season AMP (post-PT batch) | Manual run after each PT |

All three:

- Read [`scrapers/data/french_players.yaml`](../scrapers/data/french_players.yaml) for the FR roster.
- Write to `public/data/`.
- Apply the **defensive `verified: true` filter** (see [`METHODOLOGY.md`](METHODOLOGY.md) §5).
- Use `httpx` (HTTP client) and `pyyaml` (YAML loader). melee + event also use `bs4` + `lxml`.
- Log to stderr; output JSON on stdout in `--dry-run`.

Common dependencies (`requirements.txt`):

```
httpx>=0.27.0
beautifulsoup4>=4.12.0
lxml>=5.0.0
pyyaml>=6.0
```

---

## 2. `scrape_melee.py` — primary scraper

### 2.1 Endpoints used

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/Tournament/View/{tournamentId}` | HTML page → parse round selector buttons (`#standings-round-selector-container`, `#pairings-round-selector-container`) for round IDs and live state | None |
| `POST` | `/Standing/GetRoundStandings` | DataTables-style server-side endpoint, returns standings as JSON | None (CSRF token NOT required) |
| `POST` | `/Match/GetRoundMatches/{roundId}` | DataTables endpoint, returns pairings + game scores + decklist refs | None |

Base: `https://melee.gg`

### 2.2 Round resolution logic

```
fetch_tournament_meta(tournament_id)
  → soup.select("#standings-round-selector-container .round-selector")
  → for each: data-id, data-name, data-is-completed
  → soup.select("#pairings-round-selector-container .round-selector")
  → augment each with data-is-started

pick_latest_completed_round(rounds)
  → return last where completed=True (for standings)

pick_in_progress_round(rounds)
  → if any started=True && completed=False → that's the live round
  → else last completed round (post-round retro view)
  → else None (very early, no rounds yet)
```

### 2.3 DataTables payload format

`/Standing/GetRoundStandings` accepts a form-encoded payload with **all DataTables 1.10+ keys**:

```python
{
    "draw": "1",
    "start": "0",            # offset
    "length": "250",         # page size (we use 250, melee accepts up to 500)
    "search[value]": "",
    "search[regex]": "false",
    "order[0][column]": "0",
    "order[0][dir]": "asc",
    "roundId": "62953",      # ← the key

    # 11 columns × 6 sub-fields each (data, name, searchable, orderable, search.value, search.regex)
    "columns[0][data]": "Rank",
    "columns[0][searchable]": "true",
    # ... etc for Team, Decklists, MatchRecord, GameRecord, Points,
    #     OpponentMatchWinPercentage, TeamGameWinPercentage,
    #     OpponentGameWinPercentage, FinalTiebreaker, OpponentCount
}
```

**Headers required** :

```python
{
    "User-Agent": "Mozilla/5.0 ... FrenchMTGTracker/0.2 (+https://github.com/gbordes77/french-mtg-tracker)",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": f"https://melee.gg/Tournament/View/{tournament_id}",
}
```

`Referer` is **required** — without it, melee returns 403 or empty data.

### 2.4 Pagination

Standings are paginated; `recordsTotal` in the response tells you the total. Loop with `start += PAGE_SIZE` until `len(all_rows) >= total`.

In practice : PT field is 250–350, so 1 or 2 page fetches per round. Worlds is 128, single page.

### 2.5 Player name extraction

Individual tournaments (PT, Worlds): one player per `Team`, accessible at `Team.Players[0].DisplayNameLastFirst` → format `"Last, First"`.

Team tournaments (rare in PT): concatenate all players with " / ".

### 2.6 Decklist resolution

**Key gotcha** : standings response does NOT include decklist IDs. Pairings response does. So:

1. Fetch standings for round N.
2. Fetch pairings for the live round (in-progress or last completed).
3. Build a `decklist_index : normalized_name → DecklistId` from pairings.
4. Inject `decklist_id` and `decklist_url` into the standings rows during the FR identification step.

This means the very first scrape of a tournament (round 1, before any pairings published) might have null decklists. Resolved on the next tick.

### 2.7 Merge with existing JSON

The scraper preserves these manual-curation fields across runs (cf. `PRESERVED_FIELDS`):

```python
("draftD1", "standardD1", "draftD2", "standardD2",
 "finalRecord", "archetype", "source", "rcOrigin", "flag", "noLimited")
```

Logic in `build_event_data()`:

```python
if prev:
    for field in PRESERVED_FIELDS:
        if (
            field in prev
            and prev[field] is not None
            and prev[field] not in ("Inconnu", "À vérifier")
        ):
            new_entry[field] = prev[field]
```

So if a contributor hand-edits `archetype: "Izzet Prowess"` and pushes, the next auto-scrape **won't overwrite** it back to `"Inconnu"`. This is the contract — break it at your peril.

### 2.8 CLI usage

```bash
# Latest completed round (default)
python scrapers/scrape_melee.py --slug pt-secrets-of-strixhaven --tournament-id 415628

# Specific round ID (e.g. retroactive scrape of an older round)
python scrapers/scrape_melee.py --slug pt-secrets-of-strixhaven --tournament-id 415628 --round-id 62953

# Dry run: prints JSON to stdout, doesn't write
python scrapers/scrape_melee.py --slug pt-secrets-of-strixhaven --tournament-id 415628 --dry-run

# Verbose logging
python scrapers/scrape_melee.py --slug pt-secrets-of-strixhaven --tournament-id 415628 -v

# Custom output path
python scrapers/scrape_melee.py --slug pt-secrets-of-strixhaven --tournament-id 415628 --output /tmp/foo.json

# Override total rounds (default 16 for PT, 14 for Worlds)
python scrapers/scrape_melee.py --slug worlds-32 --tournament-id 999999 --total-rounds 14
```

If `--tournament-id` omitted, the scraper reads `meleeId` from `public/data/events.json` matching `--slug`.

### 2.9 Common errors

| Exception | Meaning | Recovery |
|---|---|---|
| `TournamentNotFound` | 404 on `/Tournament/View/{id}` — the meleeId is wrong or tournament is private | Verify the meleeId on melee.gg directly, update `events.json` |
| `StandingsNotPublished` | No `#standings-round-selector-container` found, or empty | Wait for round 1 to publish; for `--dry-run`, exits cleanly |
| `ParseError` | melee API returned `{"Error": true, "Message": "..."}` | Likely API change — check melee response shape, file an issue |
| `httpx.ReadTimeout` | melee slow, cron retries with exponential backoff | Self-heals usually |
| `httpx.ConnectError` | network / DNS issue | Self-heals on next tick |

---

## 3. `scrape_event.py` — magic.gg fallback

Older scraper, kept for:

- Worlds Championship (no melee instance).
- PTs where `meleeId` is unknown or the melee instance is gated.
- Failover when melee.gg is down.

Slower (10–30 min latency vs 1–3 min on melee), HTML-based, brittle to layout changes.

Source pages :

- `https://magic.gg/news/{slug}-round-{N}-standings` — round-N standings as a static blog post
- Selector: standings table inside `<table>` rows under the article body

### Strategy

Beautifulsoup parses the `<table>` rows, maps columns by header text (`Rank`, `Player`, `Match Points`, `OMW%`, etc.), normalizes player names, then the same FR matching logic as melee.

### CLI

```bash
python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --auto       # latest available round
python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --round 8    # specific round
python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --dry-run
```

### Caveats

- magic.gg articles for round-N may publish 10–30 min late.
- If WotC restructures the news URL pattern, this scraper breaks. Fix forward.
- No live pairings (magic.gg doesn't expose them on the news pages). So `liveMatches` is always absent in the magic.gg-produced JSON.

---

## 4. `scrape_amp.py` — magic.gg AMP standings

The hardest scraper. Parses the **minified `__NUXT__` payload** of `https://magic.gg/standings/pro-tour-adjusted-match-points`.

### 4.1 Why it's tricky

Magic.gg uses Nuxt SSR. The page ships:

```html
<script>window.__NUXT__=(function(a,b,c,...){...return {...,jsonObject:[{"Last Name":xL,"First Name":ks,...},...]}}(value1,value2,value3,...));</script>
```

`xL` / `ks` are minified variable references that resolve to the actual values via the IIFE arguments. So you can't just regex out the `jsonObject`; you need to **resolve each variable** through the args↔values mapping.

### 4.2 Algorithm

```
1. Fetch HTML.
2. Regex-match the function signature to get the arg list (a, b, c, ...).
3. Regex-match the call site (the trailing `}(...))` before </script>) to get the
   value list — but this is JS source, so we can't json.loads(); we tokenize manually.
4. parse_call_values(s) — a small JS-value tokenizer that handles:
   - "string"
   - numbers (-12, 3.14, 1e5)
   - true / false / null / void 0
   - [arrays] (skipped, kept as raw)
   - {objects} (skipped, kept as raw)
   - variable names (alpha + $ + _)
5. mapping = dict(zip(args, values))
6. Find the jsonObject:[...] block, parse out individual {...} records.
7. For each record, resolve every `"Key": <token>` pair via the mapping.
8. Detect "Post PT XXX Total" columns dynamically.
9. Output AmpData JSON.
```

### 4.3 Resolution depth limit

`resolve_value()` has a `depth=5` recursion limit to avoid infinite loops if the mapping references itself (Nuxt sometimes does this with recursive object refs). 5 is empirically enough.

### 4.4 What can break it

| Symptom | Cause | Fix |
|---|---|---|
| `__NUXT__ function signature non trouvée` | Nuxt switched to a different SSR pattern (e.g. `__NEXT__`) | Re-implement the parser around the new pattern |
| `jsonObject AMP block non trouvé` | WotC renamed the JSON key (`jsonObject` → something else) | Find the new key in HTML, update the regex |
| Players parsed but values are unresolved variable names (`"xL"`, `"ks"`) | The args/values mismatch — `parse_call_values` skipped a token | Run with `--input` on a saved HTML, dump tokens, find the offending one |
| New column `Post PT TDS Total` not detected | Auto-detection works (see `pt_columns = [k for k in players[0].keys() if k.startswith("Post PT")]`) — should just appear | If not, check the column key starts exactly with `"Post PT "` |

### 4.5 CLI

```bash
python scrapers/scrape_amp.py            # fetch live + write public/data/amp.json
python scrapers/scrape_amp.py --dry-run  # fetch live + print summary
python scrapers/scrape_amp.py --input /tmp/saved.html  # parse a saved HTML (debug)
python scrapers/scrape_amp.py -v         # verbose
```

### 4.6 Why not run on cron?

magic.gg only updates the AMP standings ~24–48 h after each PT ends. Cron would burn requests for nothing 99% of the time. Better to run manually post-PT.

---

## 5. Recovery playbooks

### 5.1 melee.gg API breaks during a live PT

Symptom: GHA cron fails with `ParseError` or `httpx.HTTPStatusError 4xx`.

**Steps** :

1. Check melee.gg in browser — is the tournament still live?
2. Run `python scrapers/scrape_melee.py --slug X --tournament-id N -v` locally to see the error.
3. Inspect the response body with `httpx` directly:
   ```python
   import httpx
   r = httpx.post(
       "https://melee.gg/Standing/GetRoundStandings",
       data={"draw": "1", "roundId": "62953", "start": "0", "length": "10"},
       headers={"X-Requested-With": "XMLHttpRequest", "Referer": "https://melee.gg/Tournament/View/415628"}
   )
   print(r.status_code, r.text[:1000])
   ```
4. If melee changed payload or auth, **temporarily disable** the melee step in `scrape.yml` (just rely on magic.gg fallback) and push.
5. Open an issue with the diff. Fix forward.

### 5.2 magic.gg fallback also broken

Symptom: both scrapers fail on the same event.

**Steps** :

1. Open browser → load `https://magic.gg/news/{slug}-round-{N}-standings`.
2. Inspect the standings table HTML.
3. Hand-write a JSON for the round using the same shape as the existing `pt-*.json` files (cf. [`API.md`](API.md)).
4. Commit with `chore: manual standings refresh for {slug} round {N}` so the site updates.
5. Fix the scraper later, push the fix, verify the next auto-scrape produces the same data.

### 5.3 GitHub Actions cron is silent

Symptom: site shows stale round, no new commits from `frenchmtg-bot`.

**Steps** :

1. Check https://github.com/gbordes77/french-mtg-tracker/actions — are runs happening?
2. Check https://www.githubstatus.com/ for outages.
3. If the runs are failing silently:
   ```bash
   gh run list --workflow=scrape.yml --limit 5
   gh run view <RUN_ID> --log
   ```
4. If GitHub is fine but cron isn't firing, manually trigger:
   ```bash
   gh workflow run scrape.yml -f slug=pt-secrets-of-strixhaven
   gh run watch
   ```

### 5.4 `french_players.yaml` corrupted

Symptom: scraper raises `ValueError("Entrée invalide dans players: ...")` or a `yaml.YAMLError`.

**Steps** :

1. `git log --oneline scrapers/data/french_players.yaml | head` to find the last good commit.
2. `git show <BAD_COMMIT>:scrapers/data/french_players.yaml | yamllint -` to see the diff that broke it.
3. Revert or fix the offending line, re-run the scraper locally to validate, push.

### 5.5 Vercel build fails

Symptom: site stuck on previous version, Vercel dashboard shows red build.

**Steps** :

1. Check Vercel dashboard logs — usually a TypeScript error from a fresh JSON shape change.
2. Reproduce locally: `pnpm build`. Fix the type error.
3. Push the fix.

If the JSON shape changed in an incompatible way (e.g. melee added a required field), update `src/lib/types.ts` to make it optional, ship.

---

## 6. Adding a new event type

If WotC introduces a new format (say, "Pro Tour Plus" with 18 rounds and 64 player cap):

1. Add an entry to `public/data/events.json` with the new `slug`, `totalRounds`, `meleeId` if known, `status: "upcoming"`.
2. If the format breaks an assumption (e.g. no Draft):
   - Set `noLimited: true` on each FR player entry post-scrape (manual). Worlds-style.
   - Or extend `FrenchPlayer.draftD1/D2` semantics; document in [`API.md`](API.md).
3. Test the scraper end-to-end on the first published round.
4. Open a PR with the diff; ping `@gbordes77`.

---

## 7. Security & rate-limit hygiene

- The scrapers use a **named User-Agent** with the project URL — be a good citizen, don't masquerade as a browser.
- No login / cookies / API keys are needed for any source.
- Polite retry: max 3 attempts, exponential backoff `2^attempt` seconds.
- Cron interval (5 min) keeps total requests well under 300/h per source.
- Don't add concurrent fetches to multiple events in parallel — sequential is fine and avoids triggering rate limits.

If you're testing locally, prefer `--dry-run` and `--input` modes when possible to avoid hammering upstream.

---

## 8. Testing scrapers locally

There's no formal test suite (yet). Manual checks before pushing scraper changes:

```bash
# 1. Dry-run on the current live event
python scrapers/scrape_melee.py --slug pt-secrets-of-strixhaven --tournament-id 415628 --dry-run | jq '.frenchPlayers | length'

# 2. Same with magic.gg fallback
python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --auto --dry-run

# 3. AMP scraper on a saved page (preferred to avoid re-fetching)
curl -s https://magic.gg/standings/pro-tour-adjusted-match-points > /tmp/amp.html
python scrapers/scrape_amp.py --input /tmp/amp.html --dry-run | jq '{lastUpdated, ptColumns, playerCount}'

# 4. Verify YAML validity
python -c "import yaml; yaml.safe_load(open('scrapers/data/french_players.yaml'))"

# 5. Quick lint
pyflakes scrapers/*.py
```

When in doubt, compare the diff between the dry-run output and the existing `public/data/{slug}.json` :

```bash
python scrapers/scrape_melee.py --slug ... --dry-run > /tmp/new.json
diff <(jq -S . /tmp/new.json) <(jq -S . public/data/pt-secrets-of-strixhaven.json) | head -50
```

If the diff is only the `scrapedAt` timestamp + a couple of stat updates, you're good.
