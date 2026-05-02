# DESIGN-SYSTEM.md — Comment utiliser le DS ManaTuner dans ce projet

Le design system **est intégré** au repo dans `design-system/`. Aucun travail de sync n'est requis. Ce document explique :
1. Ce qui est inclus
2. Comment l'utiliser depuis les composants
3. Les règles à respecter (et celles à NE PAS contourner)

## Contenu de `design-system/`

Tous les fichiers viennent du **système ManaTuner v1.0.0** (voir `design-system/README.md`) :

| Fichier | Rôle | Importé par |
|---|---|---|
| `BRANDBOOK.md` | ★ Règles de marque (palette, CTA, typo) | Lecture humaine — RÉFÉRENCE OBLIGATOIRE |
| `tokens.json` | W3C Design Tokens (source de vérité) | Outils Figma / Style Dictionary |
| `tokens.css` | CSS custom properties (`--mana-*`, `--brand-*`, …) | `src/index.css` |
| `tokens.ts` | TypeScript exports | (disponible si besoin de types) |
| `components.css` | Classes utilitaires `.ds-card`, `.ds-btn`, `.ds-chip`, `.mana-symbol` | `src/index.css` |
| `tailwind.preset.js` | Preset Tailwind avec toutes les couleurs/typo/shadows | `tailwind.config.ts` |
| `mui-theme.ts` | MUI bridge (non utilisé ici, on est en Tailwind) | — |
| `README.md` | Guide d'intégration complet | Lecture humaine |

## Comment l'utiliser

### 1. Couleurs via CSS variables

Les variables `--mana-*`, `--brand-*`, `--surface-*`, `--text-*` sont dispos partout :

```tsx
<div style={{ background: "var(--surface-paper)", color: "var(--text-primary)" }}>
  Hello
</div>
```

### 2. Couleurs via classes Tailwind

Le preset expose les mêmes valeurs comme classes Tailwind :

```tsx
<button className="bg-mana-blue text-white">Primary</button>
<div    className="bg-cta-premium">Gold CTA</div>
<div    className="bg-hero-wubrg">Hero gradient</div>
<span   className="text-mana-red">Error</span>
```

### 3. Composants signature (`.ds-*`)

Préférer les classes utilitaires aux re-implémentations :

```tsx
<div className="ds-card p-6">…</div>          {/* card avec hover lift + glass en dark */}
<button className="ds-btn ds-btn--premium">Action</button>
<button className="ds-btn ds-btn--knowledge">Browse</button>
<span className="ds-chip ds-chip--success">Day 2</span>
<h1 className="ds-hero-title">Magic Hero</h1>  {/* Le tracker utilise .fr-hero-title qui est une variante */}
```

### 4. Symboles mana (mana-font)

Chargé depuis CDN dans `index.html`. Usage :

```tsx
<i className="ms ms-cost ms-u" />  {/* Bleu */}
<i className="ms ms-cost ms-r" />  {/* Rouge */}
<i className="ms ms-cost ms-w" />  {/* Blanc */}
```

Le composant `ArchetypeChip` les affiche automatiquement à partir du nom d'archétype (mapping dans `helpers.ts`).

## Règles à respecter (brandbook §7 et §8)

### À FAIRE
- Utiliser les **classes `.ds-card`** pour toute surface (header, blocs stats, table, footer)
- Utiliser **Cinzel** pour H1-H4 (via `var(--font-heading)` ou classe Tailwind `font-heading`)
- Utiliser **Inter** pour le body (via `var(--font-body)` ou `font-sans`)
- Utiliser **JetBrains Mono** pour la data tabulaire et les techTerm captions (via `var(--font-mono)` ou `font-mono`)
- Glass cards en dark mode (déjà géré par `.ds-card` automatiquement via `[data-theme="dark"]`)
- Hover lifts (déjà gérés par `.ds-card` et `.ds-btn`)
- Respect strict de `prefers-reduced-motion` (déjà géré dans `tokens.css`)

### À NE PAS FAIRE
- ❌ **Ne pas pasteliser les couleurs mana** — ce sont des couleurs canon Wizards, pas du flair
- ❌ **Ne pas remplacer Cinzel par une autre police display** — c'est l'identité ManaTuner
- ❌ **Ne pas utiliser Swamp `#150B00` comme texte sur dark mode** (illisible — voir brandbook §7)
- ❌ **Ne pas créer un troisième CTA gradient** — gold + blue→purple, c'est tout. Le tracker n'a pas besoin de CTA premium pour la v1.
- ❌ **Ne pas dupliquer les tokens dans `tailwind.config.ts`** — tout est dans le preset, n'ajouter que les overrides FR (`fr.blue`, `fr.red`)
- ❌ **Ne pas modifier les fichiers de `design-system/` directement** — si une évolution est nécessaire, soit synchroniser depuis le repo manatuner-pro principal, soit créer un fichier d'override dans `src/`

## Identité FR du tracker (cohabite avec ManaTuner)

Le brandbook §8 prévoit explicitement le cas d'un fork MTG-adjacent : *"keep the canon, swap the framing"*. C'est exactement ce que fait le tracker :

- **Canon mana intact** : couleurs WUBRG inchangées, gradient hero préservé
- **Framing FR ajouté** : drapeau (`#0055a4` / `#ef4135`) comme accent chrome (header "Français" en rouge, bordure `.ds-card--bordered-fr` sur les blocs prioritaires)
- **Mana colors as content tags** : les chips d'archétype utilisent les vraies couleurs mana (Izzet en bleu+rouge, Mono-Green en vert, Bant en gold, etc.) — l'archétype porte la couleur, pas le chrome

## Pour le dark mode

Le projet est en **dark mode par défaut** (cf `index.html` : `<html data-theme="dark">`). Cohérent avec :
- L'esthétique tournoi compétitif / terminal de scoring sportif
- Le confort visuel pour suivre un PT en live (écran allumé longtemps)
- Le vibe identité ManaTuner (glass cards = signature dark)

Si on veut ajouter un toggle light/dark plus tard, il suffit de :
1. Ajouter un bouton dans `Header.tsx` qui toggle `document.documentElement.dataset.theme`
2. Tout le reste fonctionne automatiquement (les variables CSS basculent via le sélecteur `[data-theme="dark"]`)

## Pour resync depuis ManaTuner si évolution

Si manatuner-pro évolue, copier les fichiers mis à jour dans `design-system/` :

```bash
cp ~/Code/manatuner-pro/design-system/{BRANDBOOK.md,tokens.json,tokens.css,tokens.ts,components.css,tailwind.preset.js} \
   ./design-system/
```

Puis vérifier que :
- Le build TypeScript passe : `pnpm tsc --noEmit`
- Le build Vite passe : `pnpm build`
- L'apparence reste cohérente : `pnpm dev` puis revue visuelle

**Bumper `$version` dans `tokens.json` et noter le changement dans le commit message** (suivre semver — voir `design-system/README.md` § Versioning).
