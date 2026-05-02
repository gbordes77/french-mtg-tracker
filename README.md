# French MTG Tracker

> Suivi quasi temps réel des performances des **joueurs français** aux Pro Tours et événements compétitifs Magic: The Gathering majeurs.

**Live** : [french-mtg-tracker.vercel.app](https://french-mtg-tracker.vercel.app)
**Stack** : Vite + React 18 + TypeScript + Tailwind 3 · Scrapers Python · GitHub Actions cron · Vercel
**Sources** : melee.gg (primaire) · magic.gg (fallback + AMP standings)
**Refresh** : toutes les 5 min pendant un PT actif (commit auto sur `main`)

---

## Pourquoi

Aucun site existant ne suit les Français exclusivement aux Pro Tours. `magic.gg` liste les standings globaux, `mtgtop8` archive les decklists, mais personne ne synthétise « combien de Français en course pour Top 8 / requalif sur ce PT en cours ». Ce site comble ce trou pour la communauté MTGTools FR.

Concrètement, le tracker :
- **Identifie rigoureusement** les joueurs français (vs québécois, belges francophones, suisses romands) — voir [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md)
- **Affiche** leurs performances détaillées (split Limited / Construit, OMW, archétype, decklist)
- **Calcule** les projections live (combien de victoires sur les rondes restantes pour Top 8 / requalif)
- **Trace** la course aux 39+ AMP sur la saison

## Démarrage rapide

```bash
git clone https://github.com/gbordes77/french-mtg-tracker.git
cd french-mtg-tracker

# Frontend
pnpm install
pnpm dev          # → http://localhost:5173

# Scrapers (Python 3.11+)
python -m venv scrapers/.venv && source scrapers/.venv/bin/activate
pip install -r scrapers/requirements.txt

# Smoke test sur le PT en cours
python scrapers/scrape_melee.py --slug pt-secrets-of-strixhaven --tournament-id 415628 --dry-run
```

## Documentation

| Doc | Pour qui |
|-----|---|
| [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) | Auditeurs externes, presse, communauté — comment on identifie un FR |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Devs qui veulent comprendre le pipeline data |
| [`docs/API.md`](docs/API.md) | Devs qui veulent consommer les JSON publics |
| [`docs/SCRAPERS.md`](docs/SCRAPERS.md) | Mainteneurs des scrapers (debug, évolution) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Tout contributeur (ajout joueur FR, PR, conventions) |
| [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) | Designers / front-end (intégration ManaTuner) |
| `CLAUDE.md` | Brief Claude Code (interne) |

## Contribuer

Un Français manque dans la roster ? Une erreur de classement ? **Ouvre une issue ou une PR.**

- Source de vérité : [`scrapers/data/french_players.yaml`](scrapers/data/french_players.yaml)
- Format attendu, evidence requise, conventions de commit : [`CONTRIBUTING.md`](CONTRIBUTING.md)

Maintainer : Guillaume Bordes — DM Discord [@GuillaumeB](https://discord.com/users/310382567323074561)

## Licence

[MIT](LICENSE) — projet communautaire indépendant, non affilié à Wizards of the Coast.

> *Magic: The Gathering, Pro Tour, Magic Spotlight Series sont des marques déposées de Wizards of the Coast LLC. Les standings et noms de joueurs sont issus de sources publiques (melee.gg, magic.gg).*
