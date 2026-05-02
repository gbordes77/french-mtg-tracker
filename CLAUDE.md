# CLAUDE.md — Brief Claude Code

> Ce fichier est lu automatiquement par Claude Code à chaque session. Il contient le contexte projet, les conventions, et les pièges connus. **Ne pas supprimer**.

## Identité du projet

**Nom** : French MTG Tracker
**Auteur** : Guillaume Bordes (`@gbordes77`)
**Url cible** : `frenchmtg.app` (à acheter) ou `french-mtg-tracker.vercel.app`
**Stack** : Vite + React 18 + TypeScript + Tailwind CSS 3
**Hébergement** : Vercel (frontend) + GitHub Actions (cron scraper)
**Coût mensuel** : ~$1.25 (juste le domaine si acheté)

## Mission

Tracker en quasi-temps réel les performances des **joueurs français** aux événements compétitifs MTG majeurs : Pro Tours, World Championship, Magic Spotlight Series, Arena Championship, Regional Championships EMEA. Cible : ~15 événements par an.

## Pourquoi ce projet existe

Aucun site existant ne suit les Français exclusivement. magic.gg liste les standings globaux, mtgtop8 archive les decklists, mais personne ne synthétise « combien de Français en course pour Top 8 / requalif sur ce PT en cours ». Ce site comble ce trou pour la communauté MTGTools FR (Discord + X/Twitter).

## Architecture

```
french-mtg-tracker/
├── src/
│   ├── App.tsx                   # Composant racine — table des Français
│   ├── main.tsx                  # Entry point Vite
│   ├── index.css                 # Tailwind imports + reset minimal
│   ├── lib/
│   │   ├── types.ts              # Types Player, Event, Projection
│   │   └── helpers.ts            # computeTotalRecord, projectionToGoal, archetypeColor
│   └── components/
│       ├── Header.tsx
│       ├── EventCard.tsx
│       ├── PerformanceRow.tsx
│       ├── FormatSplit.tsx       # Split D1/D2 dans les colonnes Limited/Construit
│       ├── StatBlock.tsx
│       ├── StatusPill.tsx
│       ├── ArchetypeChip.tsx
│       ├── ThresholdsBlock.tsx   # Bloc seuils officiels en footer
│       └── MethodologyFooter.tsx
├── public/
│   └── data/                     # ⚠️ Généré par le scraper Python — à ne jamais éditer à la main
│       ├── events.json           # Liste des événements indexés
│       ├── pt-secrets-of-strixhaven.json
│       ├── worlds-31.json
│       └── …
├── scrapers/
│   ├── scrape_event.py           # Pipeline de scraping magic.gg
│   ├── identify_french.py        # Croise standings ↔ french_players.yaml
│   ├── requirements.txt
│   └── data/
│       └── french_players.yaml   # Source de vérité manuelle des joueurs FR
└── .github/workflows/
    └── scrape.yml                # Cron toutes les 30 min pendant les PT actifs
```

## Source de vérité : `scrapers/data/french_players.yaml`

C'est le fichier le plus important du projet. Il contient :
- La **liste positive** des joueurs identifiés comme français
- La **liste négative** des joueurs explicitement EXCLUS (Québécois, Belges francophones, etc.) avec justification

**À chaque nouveau Pro Tour**, mettre à jour cette liste avant de lancer le scraper. Maintenance estimée : 15-30 minutes par PT.

## Méthodologie d'identification des Français

⚠️ **CRITICAL** — c'est l'erreur classique du projet : confondre prénom francophone avec nationalité française. Il y a 7M+ Québécois francophones, plus des Belges/Suisses romands. Le prénom français n'est PAS un indicateur fiable.

### Le vrai discriminant : le circuit Regional Championship d'origine

| Code invitation `magic.gg` | Région | Inclut FR ? |
|---|---|---|
| `RC - CA` (F2F Tour : Toronto/Ottawa/Montréal/Calgary/Vancouver) | Canada | ❌ |
| `RC - EMEA` (Fanfinity : Antwerp/Lyon/Turin/Madrid/Prague/…) | Europe | ✅ inclut FR + UK + DE + IT + ES + … |
| `RC - US #1/#2` (SCG CON) | États-Unis | ❌ |
| `RC - SA` (Magicsur Chile) | Amérique du Sud | ❌ |
| `RC - MCC` | Mexico/Central America/Caribbean | ❌ |
| `RC - JPK`, `RC - SEA`, `RC - CN`, `RC - ANZ`, `RC - CT` | Japon/Asie/Océanie | ❌ |
| `Magic Spotlight: Avatar (Lyon)` | Événement FR — biais français fort | ✅ probable |
| `Deferred PT X` / `39+ AMP` / `PT X 30+ MP` / `Worlds Top 8` / `MTGO Champions Showcase` | Hérité — résoudre récursivement | À vérifier individuellement |

### Workflow de mise à jour de `french_players.yaml`

1. Ouvrir la liste d'invitation officielle : `https://magic.gg/events/{event-slug}-invitation-list`
2. Filtrer sur `Regional Championship - EMEA` + `Magic Spotlight Lyon` → candidats français potentiels
3. Pour chaque candidat, vérifier sur :
   - **mtgtop8.com** : le drapeau pays sur la page joueur. Si absent, regarder son historique RC (uniquement EMEA Antwerp/Lyon/Turin = probable FR ; Toronto/Ottawa/Montréal = Canadien)
   - **Twitter/X** : @MTGFrance, @JEDepraz, @TerredeMagic relaient les Français présents
   - **Discord MTGTools** : confirmation communautaire si profil incertain
4. Ajouter dans `players:` ou dans `excluded:` avec justification
5. Commit avec message : `chore: update FR roster for {event-slug}`

### Joueurs explicitement EXCLUS (Canadiens vérifiés)

Cette liste est dans `excluded:` du YAML. À ne **jamais** réintégrer :
- Noé Offman (RC Montréal + F2F Ottawa + Team Trios Montréal)
- Max Dore (RC Montréal)
- Ha Pham (Team Baguette Sirop d'Érable QC)
- Remi Roudier (Team Baguette Sirop d'Érable QC)
- Eleanor Dubreuil (RC Montréal)
- Clément Harvey (F2F Tour)

## Seuils officiels Pro Tour (à connaître par cœur)

Source : `magic.gg/events/{slug}-fact-sheet-for-competitors`

Sur **16 rondes** (3 Draft + 5 Standard par jour, x2 jours) :

| Bilan | Match points | Récompense |
|---|---|---|
| 4-4 (à R8) | 12 | **Day 2 acquis** — passage au lendemain |
| 10-6 | 30 | **Re-qualif PT** : invitation auto au prochain Pro Tour |
| 12-4 | 36 | **Top 8 / Worlds** (cut variable, parfois 13-3) |
| 39+ AMP | — | Voie alternative requalif via *Adjusted Match Points* sur 3 PT |

Pour Worlds Championship : 14 rondes Standard (pas de Draft), cut Top 8 à 36+ pts.

## Liste des événements supportés (~15/an)

Maintenir `public/data/events.json` synchronisé avec :

| Type | Fréquence | Cible |
|---|---|---|
| Pro Tour | 4/an | OBLIGATOIRE |
| World Championship | 1/an (décembre) | OBLIGATOIRE |
| Magic Spotlight Series | 4-5/an (dont 1-2 en Europe) | OBLIGATOIRE |
| Arena Championship | 2-3/an | OBLIGATOIRE |
| Regional Championship EMEA | 3/an | OPTIONNEL (gros volume) |

## Conventions de nommage

- **Slug événement** : `{type}-{set-name-kebab}` ou `{type}-{number}`
  - `pt-secrets-of-strixhaven`
  - `pt-marvel-super-heroes`
  - `worlds-31`, `worlds-32`
  - `magic-spotlight-secrets-london`
- **Fichier JSON** : `public/data/{slug}.json`
- **Format date** : ISO 8601 dans les fichiers, format français (`5 mai 2026`) en UI
- **Code en anglais**, **UI en français**

## Pipeline de données

```
GitHub Actions cron (*/30 * * * *)
   ↓
scrapers/scrape_event.py --slug {slug} --auto
   ↓ (fetch magic.gg/news/{slug}-round-{N}-standings)
parse HTML standings table
   ↓
scrapers/identify_french.py (croise avec french_players.yaml)
   ↓
public/data/{slug}.json (committed automatiquement)
   ↓
git push → Vercel rebuild auto
   ↓
site live mis à jour (~5 min de latence end-to-end)
```

## Pièges connus

1. **OMW dans les standings magic.gg est un float entre 0 et 1**, pas un %. Diviser/multiplier par 100 pour l'affichage.
2. **Les rondes ne sont pas publiées en temps réel** — magic.gg publie les standings après chaque ronde avec un délai de 10-30 min.
3. **Format des noms varie** : `magic.gg` utilise `Last, First` mais `melee.gg` utilise `First Last`. Le YAML doit matcher le format `magic.gg` strictement.
4. **Les caractères diacritiques** (é, è, ô, î) doivent être préservés tels quels — pas de normalisation Unicode.
5. **`Verdierre` avec deux R** sur magic.gg, alors que la presse FR écrit souvent `Verdiere`. Toujours utiliser l'orthographe magic.gg.
6. **Day 2 cut variable** : généralement 12+ pts mais parfois ajusté. Toujours vérifier la fact sheet de chaque PT.

## Design system

Le design system **est intégré nativement** dans `design-system/`. Il vient directement de ManaTuner Pro v1.0.0 — c'est le même brandbook, les mêmes tokens, les mêmes composants signature.

**Référence obligatoire** : `design-system/BRANDBOOK.md` (règles de marque). Et `DESIGN-SYSTEM.md` à la racine pour le mode d'emploi appliqué à ce projet.

### Points clés
- **Polices** : Cinzel (display H1-H4) + Inter (body) + JetBrains Mono (techTerm/data)
- **Palette mana canon** : Plains `#F8F6D8`, Island `#0E68AB`, Swamp `#150B00`, Mountain `#D3202A`, Forest `#00733E`
- **Accents FR** : `#0055a4` bleu drapeau + `#ef4135` rouge drapeau (cohabitent avec le canon mana via les overrides `fr.*` du Tailwind config)
- **Surfaces dark** : `#0D0D0F` near-black + glass cards (`rgba + backdrop-filter`)
- **Hero H1** : gradient WUBRG en text-fill (`.fr-hero-title` — variante du `.ds-hero-title` ManaTuner)
- **Mana symbols** : via mana-font CDN (chargé dans `index.html`), accessibles via `<i class="ms ms-cost ms-{w|u|b|r|g}" />`

### Règles strictes (à ne PAS contourner)
- Ne jamais pasteliser les couleurs mana (signal, pas flair)
- Ne jamais ajouter un troisième CTA gradient (gold premium + blue→purple knowledge = limite)
- Ne jamais utiliser Swamp `#150B00` comme texte sur dark (illisible)
- Toujours respecter `prefers-reduced-motion` (déjà géré dans `tokens.css`)
- Ne pas dupliquer les tokens dans `tailwind.config.ts` — tout est dans le preset

### Conséquence pour le code
- **Préférer les classes `.ds-*`** (`.ds-card`, `.ds-btn`, `.ds-chip`) aux composants custom
- **Préférer les CSS variables** (`var(--text-primary)`, `var(--mana-blue)`) aux hexcodes hardcodés
- **Les chips d'archétype** utilisent les vraies couleurs mana — voir `lib/helpers.ts > archetypeColor`

## Ce que Claude Code peut faire sans demander

- Refactoriser `App.tsx` en sous-composants si > 400 lignes
- Améliorer l'accessibilité (ARIA labels, contraste, navigation clavier)
- Optimiser les imports et le tree-shaking
- Ajouter des tests unitaires pour `lib/helpers.ts`
- Améliorer le SEO (meta tags, Open Graph, JSON-LD)
- Optimiser les performances (lazy loading des données d'événements)

## Ce qui requiert validation utilisateur

- Toute modification de `french_players.yaml` (impact direct sur la véracité des données)
- Toute modification des seuils dans `lib/helpers.ts` (12 / 30 / 36 / 39 AMP) — ces chiffres viennent de WotC
- Tout changement d'architecture (passage à Next.js, ajout d'une DB, etc.)
- Tout déploiement (`vercel deploy --prod`)
