# PROMPTS.md — Prompts à copier-coller dans Claude Code

> Tous ces prompts supposent que tu as ouvert Claude Code dans le dossier `french-mtg-tracker/`. Le `CLAUDE.md` à la racine sera lu automatiquement.

## ────────────────────────────────────────────
## PHASE 0 — Bootstrap initial (à faire une fois)
## ────────────────────────────────────────────

### Prompt 0.1 — Vérifier l'environnement

```
Lis CLAUDE.md, puis :
1. Vérifie que Node.js >= 20 est installé (node --version)
2. Vérifie que pnpm est dispo (sinon, propose une install via corepack)
3. Vérifie que Python >= 3.11 est installé (python3 --version)
4. Vérifie que git est configuré avec mon username gbordes77
5. Donne-moi un statut clair de ce qui manque, sans rien installer sans me demander
```

### Prompt 0.2 — Installation

```
Installe les dépendances :
- pnpm install (frontend)
- pip install -r scrapers/requirements.txt (Python)
Puis vérifie que le build TypeScript passe : pnpm tsc --noEmit
Et que le scraper en mode dry-run marche : python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --dry-run
Si erreurs, corrige-les sans me demander.
```

## ────────────────────────────────────────────
## PHASE 1 — Vérification du design system intégré
## ────────────────────────────────────────────

> Le design system ManaTuner est **déjà intégré** dans `design-system/`. Cette phase vérifie qu'il s'applique correctement, pas qu'il faut le synchroniser.

### Prompt 1.1 — Audit du DS intégré

```
Lis design-system/BRANDBOOK.md et DESIGN-SYSTEM.md en entier.

Puis vérifie que :
1. tailwind.config.ts utilise bien le preset (presets: [manaTunerPreset])
2. src/index.css importe tokens.css ET components.css depuis design-system/
3. index.html charge bien les 3 polices (Cinzel + Inter + JetBrains Mono)
4. index.html charge bien mana-font via CDN
5. Aucun composant src/components/* ne hardcode des hexcodes au lieu d'utiliser var(--*)
6. Aucun composant n'utilise une police hors canon (pas de Fraunces, Roboto, etc.)

Donne-moi un rapport bref des conformités/non-conformités. Corrige les non-conformités sans demander si elles concernent uniquement les hexcodes ou les polices. Si tu trouves un problème structurel (preset cassé, import circulaire), demande validation avant de toucher.
```

### Prompt 1.2 — (optionnel) Resync depuis manatuner-pro

```
Si manatuner-pro a évolué depuis le snapshot embarqué :

1. Localise le repo ManaTuner Pro localement (find ~/ -name "manatuner-pro" -type d)
2. Compare le contenu de manatuner-pro/design-system/ avec notre design-system/
3. Si différences mineures (valeurs de tokens) → propose le diff
4. Si différences majeures (nouveau composant, nouveau gradient) → demande validation avant de copier
5. Bump tokens.json $version selon semver après resync
```

## ────────────────────────────────────────────
## PHASE 2 — Test local
## ────────────────────────────────────────────

### Prompt 2.1 — Lancement dev

```
Lance pnpm dev en arrière-plan, attends que le serveur soit up, puis :
1. Curl http://localhost:5173 et vérifie que la page rend sans erreur 500
2. Lance un check accessibilité rapide via @axe-core/cli si dispo (sinon skip)
3. Liste les warnings TypeScript éventuels
4. Donne-moi l'URL pour que je puisse tester visuellement
```

### Prompt 2.2 — Smoke test du scraper

```
Lance le scraper en mode debug sur le PT en cours :

python scrapers/scrape_event.py --slug pt-secrets-of-strixhaven --round 8 --output /tmp/test.json

Compare /tmp/test.json avec public/data/pt-secrets-of-strixhaven.json :
- Mêmes joueurs FR identifiés ?
- Mêmes scores ?
- Si différence, est-ce dû à une mise à jour officielle ou à un bug du scraper ?
```

## ────────────────────────────────────────────
## PHASE 3 — Déploiement Vercel
## ────────────────────────────────────────────

### Prompt 3.1 — Préparation déploiement

```
Avant de déployer sur Vercel :
1. Vérifie que .env.example liste toutes les variables nécessaires (aucune secret n'est requise pour la v1)
2. Crée un vercel.json minimal qui force le framework Vite et le build command pnpm build
3. Vérifie que le .gitignore ignore bien node_modules, dist, .DS_Store, .env
4. Crée un commit "feat: initial bootstrap" si pas déjà fait
5. Pousse sur github.com/gbordes77/french-mtg-tracker (crée le repo si besoin via gh repo create)
```

### Prompt 3.2 — Déploiement

```
Déploie sur Vercel :
1. vercel link (associer au compte gbordes77)
2. vercel --prod
3. Vérifie le statut du build et donne-moi l'URL publique
4. Pas de domaine custom pour la v1 — on restera sur french-mtg-tracker.vercel.app
```

## ────────────────────────────────────────────
## PHASE 4 — Activation du cron scraper
## ────────────────────────────────────────────

### Prompt 4.1 — Test workflow GitHub Actions

```
1. Vérifie que .github/workflows/scrape.yml est correct
2. Pousse-le sur main
3. Déclenche-le manuellement via gh workflow run scrape.yml
4. Surveille l'exécution avec gh run watch
5. Si succès, vérifie qu'il y a bien un commit auto "chore: refresh standings ..." avec un fichier JSON modifié
6. Si échec, debug et corrige
```

### Prompt 4.2 — Activation cron live

```
On entre dans la phase active : un PT démarre dans X heures.
1. Édite scrape.yml pour activer le cron */30 * * * * (déjà fait normalement)
2. Vérifie que le slug du PT en cours est dans events.json avec status="live"
3. Préviens-moi quand le premier scrape automatique réussit
```

## ────────────────────────────────────────────
## PHASE 5 — Mises à jour récurrentes (à chaque nouveau PT)
## ────────────────────────────────────────────

### Prompt 5.1 — Préparation pré-PT

```
Un nouveau PT démarre : {NOM_DU_PT}, slug {SLUG}, dates {DATES}, à {LIEU}.
Format : {FORMAT}, prize pool {USD}.

1. Ajoute l'événement dans public/data/events.json (status="upcoming")
2. Crée public/data/{SLUG}.json vide avec la structure attendue
3. Récupère la liste d'invitation officielle :
   https://magic.gg/events/{SLUG}-invitation-list
4. Filtre les Français potentiels selon la méthode dans CLAUDE.md (RC EMEA + Spotlight Lyon principalement)
5. Propose-moi une mise à jour de scrapers/data/french_players.yaml avec les nouveaux entrants
6. ATTENDS MA VALIDATION avant de commit le YAML
```

### Prompt 5.2 — Bascule en mode live

```
Le PT a démarré. Bascule events.json : status="upcoming" → "live", ajoute currentRound=1.
Lance un premier scrape manuel pour valider que le pipeline marche en réel.
```

### Prompt 5.3 — Post-PT cleanup

```
Le PT est terminé. Pour {SLUG} :
1. Bascule status="live" → "ended" dans events.json
2. Vérifie que finalRecord est bien rempli pour chaque joueur FR
3. Génère un mini-récap textuel des perfs FR (Top 8 atteints, requalifs obtenues, AMP gagnés)
4. Commit final avec message "feat: archive {SLUG}"
```
