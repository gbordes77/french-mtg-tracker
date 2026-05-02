# Architecture

System overview of the French MTG Tracker. Read this first if you want to understand how data flows from a melee.gg tournament to the live site.

> French audience: read top-down — diagrams + tables; only English-as-needed for component names. The methodology bits are in [`METHODOLOGY.md`](METHODOLOGY.md).

---

## 1. High-level data flow

```
                                 ┌─────────────────────────────┐
                                 │  Source authorities         │
                                 │                             │
                                 │  - melee.gg/Standing/...    │  ← primary
                                 │  - melee.gg/Match/...       │  ← live pairings
                                 │  - magic.gg/news/...        │  ← fallback
                                 │  - magic.gg/standings/      │  ← AMP cumulative
                                 │      pro-tour-adjusted...   │
                                 └──────────────┬──────────────┘
                                                │
                                                │  HTTPS GET / POST
                                                ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  GitHub Actions cron — .github/workflows/scrape.yml                      │
   │                                                                          │
   │  schedule: */5 * * * *  (every 5 min, no-op if no live event)            │
   │                                                                          │
   │  Steps :                                                                 │
   │    1. checkout main                                                      │
   │    2. setup python 3.12 + cache                                          │
   │    3. read public/data/events.json → filter status=live                  │
   │    4. for each live event:                                               │
   │         scrape_melee.py --slug X --tournament-id N    (primary)          │
   │         scrape_event.py  --slug X --auto              (fallback magic)   │
   │    5. (separately, manually) scrape_amp.py for season AMP                │
   │    6. git commit "chore: refresh standings <ISO>"                        │
   │    7. git push origin main                                               │
   └──────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │  git push to main
                                                ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  GitHub repo (gbordes77/french-mtg-tracker)                              │
   │                                                                          │
   │  public/data/                                                            │
   │    ├── events.json                       ← index of all events          │
   │    ├── pt-secrets-of-strixhaven.json     ← per-event scraped data       │
   │    ├── pt-lorwyn-eclipsed.json                                           │
   │    ├── worlds-31.json                                                   │
   │    ├── magic-spotlight-secrets-london.json                               │
   │    └── amp.json                          ← season AMP cumulative        │
   │                                                                          │
   │  scrapers/data/                                                          │
   │    └── french_players.yaml               ← source of truth, manual      │
   └──────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │  Vercel webhook on push
                                                ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  Vercel (frontend hosting)                                               │
   │                                                                          │
   │  Build: pnpm install && pnpm build (Vite SPA)                            │
   │  Output: dist/ — static files                                            │
   │  CDN: edge cache, immutable assets                                       │
   │                                                                          │
   │  https://french-mtg-tracker.vercel.app                                   │
   └──────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │  HTTPS GET
                                                ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  Browser (React SPA)                                                     │
   │                                                                          │
   │  1. Boot: fetch("/data/events.json")                                     │
   │  2. Pick event.status === "live" (or fallback to first)                  │
   │  3. fetch(`/data/${slug}.json`) and render                               │
   │  4. (optionally) fetch("/data/amp.json") for season race                 │
   │                                                                          │
   │  No backend, no DB, no auth. The JSON files ARE the API.                 │
   └──────────────────────────────────────────────────────────────────────────┘
```

End-to-end latency from a melee.gg round publish to the live site: **~5–7 min** typical.

- melee.gg publishes round results: T0
- GitHub Actions next cron tick: T0 + 0–5 min
- Scrape + commit + push: ~30 s
- Vercel build + deploy: ~60 s
- → user sees the new data: T0 + 90 s to 7 min

---

## 2. Source-of-truth matrix

| Data | Source | Owner / Maintainer | Editable how |
|---|---|---|---|
| FR roster (who is French) | `scrapers/data/french_players.yaml` | Manual (PR) | Edit YAML, follow [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Event list | `public/data/events.json` | Manual (PR) | Edit JSON when a new PT is announced |
| Standings + records | `public/data/{slug}.json` | **Auto** (scrape) | DO NOT edit by hand — overwritten every 5 min during live |
| Season AMP | `public/data/amp.json` | **Auto** (scrape) | DO NOT edit by hand |
| Design tokens | `design-system/*` | Snapshot upstream (ManaTuner Pro) | Resync from upstream, do not edit in-place |
| Method doc | `docs/METHODOLOGY.md` | Manual (PR + issue discussion) | Versioned, requires discussion |

**Hard rule** : anything in `public/data/` other than `events.json` is autogenerated. Never commit a hand-edit on `pt-*.json`. The scraper has a merge logic that **preserves manual enrichment fields** (archetype, source, draftD1, etc.) across runs — that's where contributors put hand-curated data, not in the auto-overwritten fields.

Preserved fields (from `scrape_melee.py > PRESERVED_FIELDS`):

```python
("draftD1", "standardD1", "draftD2", "standardD2",
 "finalRecord", "archetype", "source", "rcOrigin", "flag", "noLimited")
```

---

## 3. Component responsibilities

### Frontend (`src/`)

```
src/
├── App.tsx                 — root, fetches events.json + active {slug}.json
├── main.tsx                — Vite entry, mounts <App/>
├── index.css               — imports tokens.css + components.css
├── lib/
│   ├── types.ts            — MTGEvent, FrenchPlayer, EventData, AmpData, …
│   ├── helpers.ts          — projection math, archetypeColor, THRESHOLDS
│   └── useMediaQuery.ts    — responsive switch table↔card at 768px
└── components/
    ├── Header.tsx                — site nav, theme/locale (none for v1)
    ├── MarketingHero.tsx         — homepage hero block (h1)
    ├── EventCard.tsx             — upcoming events grid item
    ├── StatBlock.tsx             — single KPI (engagés, day2, top8 pace…)
    ├── PerformanceRow.tsx        — desktop table row per FR player
    ├── PerformanceCard.tsx       — mobile card per FR player
    ├── FormatSplit.tsx           — "3-0 / 4-1" Limited+Construit subtable
    ├── ArchetypeChip.tsx         — chip with mana symbols + decklist link
    ├── StatusPill.tsx            — small live status indicator
    ├── ThresholdsBlock.tsx       — official thresholds 12/30/36/39 footer
    ├── AmpRaceBlock.tsx          — season AMP race towards 39+
    ├── LiveMatchesBlock.tsx      — current round pairings (FR-only)
    ├── ExportCsvButton.tsx       — CSV export of current view
    ├── MethodologyFooter.tsx     — link to METHODOLOGY.md
    └── ErrorBoundary.tsx         — React error boundary fallback
```

The frontend is **stateless and read-only** : no auth, no DB, no API calls beyond `/data/*.json`. All state is derived from JSON.

### Scrapers (`scrapers/`)

```
scrapers/
├── scrape_melee.py         — primary scraper, melee.gg DataTables JSON API
├── scrape_event.py         — legacy scraper, magic.gg HTML standings (fallback)
├── scrape_amp.py           — magic.gg AMP standings (parses __NUXT__ payload)
├── requirements.txt        — httpx + bs4 + lxml + pyyaml (4 deps)
└── data/
    └── french_players.yaml — FR roster (manual)
```

| Scraper | Source | Trigger | Frequency |
|---|---|---|---|
| `scrape_melee.py` | melee.gg | GHA cron + manual | every 5 min during live PT |
| `scrape_event.py` | magic.gg | GHA cron fallback + manual | only if melee fails |
| `scrape_amp.py` | magic.gg AMP standings | manual (no cron) | post-PT, when WotC publishes new totals |

### CI (`/.github/workflows/scrape.yml`)

- Cron `*/5 * * * *` (every 5 min).
- Reads `public/data/events.json`, keeps only `status: "live"` events with a `meleeId`.
- Loops, tries melee first, falls back to magic.gg.
- Commits with `frenchmtg-bot <bot@frenchmtg.app>` + message `chore: refresh standings <ISO>`.
- Pushes to `main`.

If no live event, the job runs but exits early after the filter step (cheap, no HTTP requests to upstream).

### Hosting (Vercel)

- Vite SPA build (`pnpm build`), output in `dist/`.
- Static assets served from edge CDN.
- Auto-deploy on push to `main`.
- No server-side rendering, no Vercel functions, no cron on Vercel side.
- Cost: $0 (free tier) + ~$15/year if a custom domain is purchased.

---

## 4. Data shapes (quick reference)

For full schemas with examples, see [`API.md`](API.md).

### `events.json`

Array of `MTGEvent` objects (slug, name, dates, location, format, status, currentRound, totalRounds, meleeId, sourceUrl).

### `{slug}.json` (per-event)

Object with `slug`, `round`, `totalRounds`, `scrapedAt`, `fieldSize`, `source` (`"melee.gg" | "magic.gg"`), `frenchPlayers[]`, optionally `liveRound` and `liveMatches[]` and `fieldArchetypes`.

### `amp.json`

Object with `lastUpdated`, `scrapedAt`, `ptColumns[]` (`"Post PT ECL Total"`, `"Post PT MSH Total"`, …), `players[]` (raw rows from magic.gg AMP table including FR + worldwide).

---

## 5. Key non-functional choices

### Why static JSON instead of a DB ?

- Read-heavy, low write rate (few hundred reads/min during a live PT, ~12 writes/h max).
- Simpler ops: no DB to backup, no schema migrations, no ORM.
- Free hosting (Vercel + GitHub Actions) — cost ~$0/month.
- Git history = audit trail for free. Every standings update is a commit, queryable forever.
- Easy to fork / mirror — anyone can clone the repo and have a working tracker offline.

Trade-off: no per-user features (favorites, alerts), no high write QPS. Acceptable given the use case.

### Why melee.gg as primary, magic.gg as fallback ?

- **melee.gg latency** : 1–3 min after a round closes. **magic.gg latency** : 10–30 min.
- melee provides **richer data** : MatchRecord (W-L-D), GameRecord, 4 tiebreakers, decklists when published, archetype names, format name, pod numbers (for drafts).
- magic.gg has **better archival** (older PTs) but slower live updates.
- Worlds Championship is on magic.gg only (no melee instance since 2024).

The fallback chain in `scrape.yml` makes melee the default and magic.gg the safety net. If melee changes their API, the project keeps working via magic.gg, just with worse latency.

### Why cron `*/5` and not webhook ?

- melee.gg has no webhook for round results.
- 5 min is the GitHub Actions cron minimum that doesn't burn the free tier (288 runs/day vs ~1000-run cap).
- No-op when no live event (cheap).
- Round publish window during a PT is ~50 min (round duration + tiebreaker computation). 5 min cron = 10 attempts per round, plenty of margin.

### Why no caching layer ?

- Vercel CDN already caches static JSON aggressively.
- Browser fetch is cached by `Cache-Control` headers from Vercel.
- Adding Redis / KV would add ops without measurable benefit at current scale (~few thousand uniques/PT day).

---

## 6. Failure modes & recovery

| Failure | Symptom | Recovery |
|---|---|---|
| melee.gg DataTables API change | scraper returns 0 standings or raises `ParseError` | Run `scrape_event.py` (magic.gg fallback) manually; investigate API change in [`SCRAPERS.md`](SCRAPERS.md) |
| magic.gg HTML structure change | fallback also fails | Manual scrape via browser devtools, hand-write JSON, commit; fix scraper later |
| GHA cron skipped (GitHub outage) | site shows stale round | Manual `gh workflow run scrape.yml` once GitHub is back |
| Vercel build fails | site stuck on previous version | Check Vercel dashboard, fix build error, push fix commit |
| `french_players.yaml` corrupted (bad YAML) | scraper raises `ValueError` | Revert offending commit, fix YAML, re-run |
| New player added but `verified: false` | player ignored by scraper, won't appear on site | This is **intentional** — defensive filter (cf. `METHODOLOGY.md` §5) |

Logs are public on GitHub Actions: https://github.com/gbordes77/french-mtg-tracker/actions

---

## 7. Future evolutions (non-binding)

Possibilities discussed but not committed:

- Migration to Next.js for SSR + per-event SEO meta tags (probably not needed at current scale).
- Aggregated multi-PT view (FR season ranking) — deferred until 2-3 full seasons of data.
- Public REST API with versioning headers — only if 3rd-party consumers ask.
- Discord bot pushing notifications when a FR hits Day 2 / Top 8 — possible, low effort.
- French language toggle (currently FR-only UI).
- Custom domain `frenchmtg.app` — pending purchase.

None of these are in scope for v1. Open an issue if you want to push one.

---

## 8. Glossary

| Term | Meaning |
|---|---|
| **PT** | Pro Tour (4/year, 2-day, 16 rounds, ~250-350 players) |
| **Worlds** | Magic World Championship (1/year, December, 14 rounds Standard, 128 players) |
| **MSS** | Magic Spotlight Series (4-5/year, ~10K USD, biased local) |
| **AMP** | Adjusted Match Points (cumulative across last 3 PT, ≥39 = re-qualif PT) |
| **OMW** | Opponent Match Win % (tiebreaker 1, higher is better) |
| **GW**  | Game Win % (tiebreaker 2) |
| **OGW** | Opponent Game Win % (tiebreaker 3) |
| **Day 2 cut** | Threshold to advance to PT day 2 — usually 12 pts, sometimes 10 (event-specific) |
| **Cut Top 8** | Threshold for Top 8 — usually 36 pts (12-4), occasionally 13-3 |
| **Featured match** | Match covered by official stream / pairings table |
| **Pod** | Group of 8 players for a Booster Draft — 3 rounds inside the pod |
| **Archetype** | Deck identity (Izzet Prowess, Mono-Green Landfall, Bant Rhythm, etc.) |
