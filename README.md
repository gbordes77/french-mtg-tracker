# French MTG Tracker

> Suivi en temps réel des performances des joueurs français aux Pro Tours, Worlds et événements compétitifs Magic: The Gathering majeurs.

🌐 **Live** : [french-mtg-tracker.vercel.app](https://french-mtg-tracker.vercel.app)
🐦 **Suivez** : [@MTGTools_FR](https://twitter.com/) sur X
💬 **Communauté** : Discord MTGTools

## Pourquoi

Aucun site existant ne suit les Français exclusivement aux Pro Tours. magic.gg liste les standings globaux, mtgtop8 archive les decklists, mais personne ne synthétise « combien de Français en course pour Top 8 / requalif sur ce PT en cours ».

Ce projet comble ce trou en :
- Identifiant rigoureusement les joueurs français (vs québécois, belges, suisses)
- Affichant leurs performances détaillées (split Limited vs Construit)
- Calculant les projections live (combien de victoires pour Top 8 / requalif)
- Archivant l'historique pour suivre l'évolution de l'élite FR

## Stack

- **Frontend** : Vite + React 18 + TypeScript + Tailwind CSS
- **Données** : JSON statiques générés par scraper Python
- **Scraper** : Python + httpx + BeautifulSoup
- **CI/CD** : GitHub Actions cron (toutes les 30 min pendant un PT)
- **Hosting** : Vercel (frontend) + GitHub (data + actions)

## Démarrage rapide

```bash
# 1. Cloner
git clone https://github.com/gbordes77/french-mtg-tracker.git
cd french-mtg-tracker

# 2. Installer
pnpm install
pip install -r scrapers/requirements.txt

# 3. Lancer le dev server
pnpm dev
# → http://localhost:5173

# 4. (Optionnel) Lancer un scrape manuel
python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --auto
```

## Méthodologie

L'identification des Français est documentée en détail dans [`CLAUDE.md`](./CLAUDE.md). En résumé :

- **Le prénom français n'est pas un indicateur fiable** (7M+ Québécois francophones)
- Le vrai discriminant est le **circuit Regional Championship d'origine**
- Les joueurs sont validés via croisement magic.gg invitation list + mtgtop8 historique RC + Twitter/X

## Contribuer

Un joueur FR manque ? Une erreur ? Ouvrez une issue ou une PR.

Le fichier source de vérité est [`scrapers/data/french_players.yaml`](./scrapers/data/french_players.yaml).

## Licence

MIT — projet communautaire indépendant, non affilié à Wizards of the Coast.

> *Magic: The Gathering, Pro Tour, Magic Spotlight Series sont des marques déposées de Wizards of the Coast LLC.*
