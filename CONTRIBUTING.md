# Contribuer à French MTG Tracker

Merci de l'intérêt porté au projet. Ce document décrit comment contribuer concrètement, avec un focus sur les deux types de contributions les plus fréquentes :

1. **Mettre à jour la liste des joueurs FR** (`scrapers/data/french_players.yaml`) — c'est la contribution la plus impactante.
2. **Améliorer le code** (frontend, scrapers, doc).

> Pour la méthodologie d'identification des Français, lis d'abord [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md). C'est la base de tout, et ça évite les rejets de PR.

---

## TL;DR

```bash
# 1. Fork + clone
git clone https://github.com/<ton-user>/french-mtg-tracker.git
cd french-mtg-tracker

# 2. Crée une branche
git checkout -b fix/add-fr-player-johndoe

# 3. Édite scrapers/data/french_players.yaml (suis le format ci-dessous)

# 4. Smoke test : le scraper doit toujours passer en dry-run
python scrapers/scrape_melee.py --slug pt-secrets-of-strixhaven \
    --tournament-id 415628 --dry-run

# 5. Commit avec un message clair
git commit -m "chore: add John Doe to FR roster (RC EMEA Lyon 2025)"

# 6. Push + ouvre une Pull Request sur main
git push origin fix/add-fr-player-johndoe
```

---

## 1. Ajouter / modifier un joueur FR

### 1.1 Format YAML attendu

Le fichier [`scrapers/data/french_players.yaml`](scrapers/data/french_players.yaml) a deux sections :

- `players:` — joueurs identifiés comme français
- `excluded:` — joueurs explicitement exclus (Canadiens, autres francophones non-FR)

#### Entrée dans `players:`

```yaml
- name: "Depraz, Jean-Emmanuel"     # OBLIGATOIRE — format "Last, First" tel que magic.gg
  twitter: "@JEDepraz"               # optionnel, null si pas de compte public
  verified: true                     # OBLIGATOIRE — true si confirmé, sinon le joueur est ignoré par le scraper
  notes: "Champion du monde 2023"    # optionnel — contexte court (1 ligne max)
```

**Règles strictes** :

- `name` doit matcher l'orthographe **magic.gg / melee.gg exacte** (case-sensitive, diacritiques préservés). Exemple : `Verdierre` (deux R sur magic.gg) et pas `Verdiere`.
- Format obligatoire `Last, First` (avec virgule + espace). Pas de surnom.
- `verified: true` n'est posé qu'après avoir une **evidence externe** (cf. §1.3).
- Préserver les caractères accentués (`é`, `è`, `ô`, `î`) — pas de normalisation Unicode.

#### Entrée dans `excluded:`

```yaml
- name: "Offman, Noé"                                    # même format
  nationality: "CA (Québec)"                              # code ISO entre parenthèses
  reason: "RC Montréal mai 2025 + RC F2F Ottawa Fév 2024" # justification concrète
  sources:                                                # OBLIGATOIRE pour les exclusions
    - "https://www.mtgtop8.com/event?e=69256&f=ST"
    - "https://mtgtop8.com/event?e=52172&f=MO"
```

Une exclusion sans `sources:` sera refusée. Les exclusions sont **publiques et visibles** dans le repo — la transparence est une feature, pas un bug.

### 1.2 Workflow d'ajout d'un nouveau joueur

À faire avant **chaque nouveau Pro Tour** (15-30 min de boulot, idéalement par un mainteneur ayant accès au Discord MTGTools FR) :

1. **Récupère la liste d'invitation** : `https://magic.gg/events/{slug}-invitation-list`
2. **Filtre** sur `Regional Championship - EMEA` + `Magic Spotlight Lyon` → candidats français potentiels.
3. **Pour chaque candidat**, vérifie 2 sources sur 3 (cf. §1.3).
4. **Décide** : `players:` (avec `verified: true`) ou `excluded:` (avec `sources:`).
5. **Commit** : `chore: update FR roster for {slug}`

Voir aussi [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) pour les biais connus et les pièges classiques (Québécois avec prénoms français, etc.).

### 1.3 Sources d'evidence acceptables

Une PR qui ajoute / déplace un joueur **doit citer au moins une source vérifiable** dans la description de la PR. Sources reconnues, par ordre de fiabilité :

| Source | Comment vérifier | Fiabilité |
|---|---|---|
| **mtgtop8.com** | Drapeau pays sur la fiche joueur (`/player?p=Nom%20Prenom`) | ★★★ |
| **Historique RC** | Ses RC sont systématiquement EMEA (Antwerp/Lyon/Turin) → probable FR. Toronto/Montréal/Ottawa → Canadien | ★★★ |
| **Twitter/X** | Bio explicite "🇫🇷", relayé par @MTGFrance / @JEDepraz / @TerredeMagic | ★★ |
| **Discord MTGTools FR** | Le joueur est dans le serveur ou est confirmé par les modérateurs | ★★ |
| **Coverage officielle** | magic.gg / Wizards mentionne explicitement la nationalité | ★★★ |

**Le prénom francophone n'est PAS une evidence.** Cf. liste des exclus : Noé Offman, Max Dore, Ha Pham, Eleanor Dubreuil sont tous canadiens malgré des prénoms 100% français. Voir [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) §3 pour la liste complète.

### 1.4 Cas litigieux

Si un joueur est ambigu (double nationalité, expat de longue date, peu d'historique RC) :

- Pose-le en `players:` avec `verified: false` + `notes:` détaillées + lance une discussion en issue.
- Le filtre défensif du scraper **ignore** tout joueur non-`verified: true` — donc rien ne fuite publiquement tant que le débat n'est pas tranché.
- Tag `@gbordes77` dans la PR pour arbitrage.

---

## 2. Contribuer au code

### 2.1 Setup local

```bash
# Frontend
pnpm install
pnpm dev          # http://localhost:5173
pnpm lint         # tsc --noEmit
pnpm build        # tsc -b && vite build

# Scrapers
python -m venv scrapers/.venv && source scrapers/.venv/bin/activate
pip install -r scrapers/requirements.txt

# Smoke tests
python scrapers/scrape_melee.py --slug pt-secrets-of-strixhaven --tournament-id 415628 --dry-run
python scrapers/scrape_amp.py --dry-run
```

### 2.2 Conventions

- **Code en anglais**, **UI en français**.
- TypeScript strict, pas de `any` non motivé.
- Préférer les classes `.ds-*` (`ds-card`, `ds-btn`, `ds-chip`) aux composants custom — voir [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md).
- CSS variables (`var(--text-primary)`, `var(--mana-blue)`) plutôt que hexcodes hardcodés.
- Ne **pas modifier** les fichiers dans `design-system/` (snapshot upstream ManaTuner).

### 2.3 Commits

Convention type "Conventional Commits" allégée :

| Préfixe | Pour |
|---|---|
| `feat:` | Nouvelle fonctionnalité utilisateur |
| `fix:` | Bug corrigé |
| `chore:` | Maintenance (YAML roster, configs) |
| `docs:` | Doc uniquement |
| `refactor:` | Refacto sans changement comportemental |
| `perf:` | Optimisation perf |
| `style:` | Format, indentation (pas de logique) |
| `test:` | Tests |

Exemples :
```
chore: add Mike Boulinguiez to FR roster (RC EMEA Antwerp 2025)
fix: handle empty Decklists array in melee scraper
docs: clarify projection thresholds in METHODOLOGY.md
feat: add live matches block on mobile
```

Le bot de scraping commit avec `frenchmtg-bot <bot@frenchmtg.app>` et le message `chore: refresh standings <ISO date>` — ne pas le perturber.

### 2.4 Pull requests

- 1 PR = 1 sujet. Une PR qui ajoute 5 joueurs + refactor un composant sera scindée.
- Description claire avec :
  - **Quoi** : ce qui change
  - **Pourquoi** : motivation (issue liée si applicable)
  - **Sources** (pour les ajouts FR) : URLs de vérification
- Le CI doit passer (build TS + scrapers --dry-run sur les events `live`).
- Review : `@gbordes77` (mainteneur unique pour l'instant).

---

## 3. Modifications **interdites** sans validation préalable

Ces zones touchent à la véracité publique du tracker. Toute PR les modifiant sans discussion en issue sera refusée :

- **Seuils numériques** dans `src/lib/helpers.ts` (`THRESHOLDS.DAY_2 = 12`, `REQUALIF_PT = 30`, `TOP_8 = 36`, `AMP_BONUS = 39`) — ces chiffres viennent de Wizards.
- **Logique d'identification FR** dans `scrape_melee.py > identify_french()` ou `> filter_french_pairings()`.
- **Liste `excluded:`** sans `sources:` ni discussion.
- **Architecture** (passer à Next.js, ajouter une DB, etc.).

---

## 4. Code of conduct

Règles de base :

- Respect mutuel. Pas d'attaque ad hominem dans les issues / PRs.
- Le projet documente publiquement les exclusions (Canadiens) avec justification. Ce n'est pas un jugement sur la personne, c'est une description objective de leur appartenance à un autre Regional Championship.
- En cas de désaccord avec une classification (FR / non-FR), apporter une evidence neuve, pas un coup de gueule.

Si problème : DM Discord à [@GuillaumeB](https://discord.com/users/310382567323074561).

---

## 5. Questions fréquentes

**Q : Je suis un joueur français qui n'apparaît pas dans la liste, comment me faire ajouter ?**
A : Ouvre une issue avec ton nom (format `Last, First` magic.gg), ton compte X/Twitter si public, et un lien vers ta fiche mtgtop8 ou un RC EMEA récent. Le projet n'ajoute pas de joueurs sans qu'ils soient invités à un événement supporté (PT, Worlds, Spotlight, RC EMEA podium).

**Q : Pourquoi tel Québécois avec un prénom français est-il exclu alors qu'il est francophone ?**
A : Le projet suit les **joueurs français** (FR), pas les francophones. Lire [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) §1 pour le rationale. Un site jumeau pour les Québécois serait bienvenu et le tracker linkerait dessus volontiers.

**Q : Le scraper a planté pendant un PT, comment aider ?**
A : Voir [`docs/SCRAPERS.md`](docs/SCRAPERS.md) §6 (debug + recovery). Les logs GitHub Actions sont publics : [Actions tab](https://github.com/gbordes77/french-mtg-tracker/actions).

**Q : Puis-je proposer un nouveau type d'événement à tracker ?**
A : Oui, ouvre une issue avec : nom de l'événement, fréquence, source de standings (URL), volumétrie attendue de FR. Le projet vise ~15 événements/an max pour rester maintenable.
