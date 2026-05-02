# Méthodologie d'identification des joueurs français

Ce document décrit **comment** le projet identifie un joueur comme français. Il est public à dessein : la véracité du tracker repose entièrement sur cette méthode, et elle doit pouvoir être **auditée par n'importe qui** dans la communauté.

> Si tu cherches *quoi* faire pour ajouter un joueur, voir [`CONTRIBUTING.md`](../CONTRIBUTING.md). Ce document explique le *pourquoi*.

---

## 1. Le piège de base : francophone ≠ français

Magic: The Gathering est joué dans plusieurs régions francophones, dont aucune n'est un sous-ensemble de la France :

| Région | Population MTG estimée | Circuit RC d'attache |
|---|---|---|
| France | ~3 000 joueurs compétitifs | RC EMEA |
| Québec | ~7 M de francophones, communauté MTG active | RC Canada (F2F Tour) |
| Belgique francophone | ~4 M de francophones | RC EMEA |
| Suisse romande | ~1.5 M de francophones | RC EMEA |
| France d'outre-mer (Réunion, Guadeloupe, etc.) | minoritaire mais existe | RC EMEA |

**Conséquence** : un joueur s'appelant `Noé Offman`, `Max Dore`, `Clément Harvey` peut très bien être Canadien. Plus de 50% des prénoms français côté magic.gg appartiennent à des **non-Français**.

→ Le prénom n'est **jamais** une evidence suffisante.

---

## 2. Le vrai discriminant : le Regional Championship d'origine

Wizards a structuré le circuit compétitif en **Regional Championships** (RC) géographiques. Chaque RC qualifie ses tops vers le Pro Tour. Le code RC d'invitation est **publié sur magic.gg** dans la liste d'invitation de chaque PT.

### Tableau de routage

| Code invitation `magic.gg` | Région | Inclut FR ? |
|---|---|---|
| `RC - CA` (F2F Tour : Toronto / Ottawa / Montréal / Calgary / Vancouver) | Canada | ❌ |
| `RC - EMEA` (Fanfinity : Antwerp / Lyon / Turin / Madrid / Prague / …) | Europe | ✅ inclut FR + UK + DE + IT + ES + Benelux + Pays nordiques + … |
| `RC - US #1`, `RC - US #2` (SCG CON) | États-Unis | ❌ |
| `RC - SA` (Magicsur Chile) | Amérique du Sud | ❌ |
| `RC - MCC` | Mexico / Central America / Caribbean | ❌ |
| `RC - JPK`, `RC - SEA`, `RC - CN`, `RC - ANZ`, `RC - CT` | Japon / Asie / Océanie | ❌ |
| `Magic Spotlight: Avatar (Lyon)` | Événement FR — biais français fort, mais pas exclusif | ✅ probable, à vérifier |
| `Deferred PT X` / `39+ AMP` / `PT X 30+ MP` / `Worlds Top 8` / `MTGO Champions Showcase` | Hérité — résoudre récursivement | À vérifier individuellement |

**Règle pratique** : si le joueur est invité via `RC - EMEA`, il est *européen*, mais pas nécessairement français. Croiser avec une seconde source.

---

## 3. Sources de vérification (par ordre de fiabilité)

Une classification (FR ou exclu) doit reposer sur **au moins une source ★★★** ou **deux sources ★★**.

### ★★★ Sources fortes

| Source | Méthode | Robustesse |
|---|---|---|
| **mtgtop8.com — drapeau pays** | URL `https://mtgtop8.com/player?p=Nom%20Prenom` → drapeau visible si renseigné | Géré par la communauté, fiable quand renseigné. Manque sur ~30% des joueurs. |
| **Historique RC sur magic.gg invitation lists** | Si les 2-3 derniers RC du joueur sont systématiquement Antwerp / Lyon / Turin → FR ou européen. Si Toronto / Ottawa / Montréal → Canadien. | Très fiable, mais demande de remonter sur 2-3 PT. |
| **Coverage officielle** | Article magic.gg ou interview Wizards mentionnant la nationalité explicite | Imparable mais rare. |

### ★★ Sources de confirmation

| Source | Méthode | Robustesse |
|---|---|---|
| **Twitter/X** | Bio `🇫🇷` + relais par @MTGFrance / @JEDepraz / @TerredeMagic / @CryptoChris07 | Communautaire, peut être manipulé. Ne pas se baser uniquement sur l'emoji drapeau. |
| **Discord MTGTools FR** | Le joueur est membre actif ou les modérateurs confirment | Très fiable mais accès privé. |
| **Décklists nationaux** | Le joueur a top-8 un Trial / Open en France / Belgique / Suisse francophone | Indique communauté de jeu, pas nationalité. |

### ★ Sources insuffisantes (à NE PAS utiliser seules)

- Prénom francophone (Noé, Clément, Max, Hugo, Léo, Théo, Émile, Pierre-Yves, etc.)
- Nom de famille français (Dore, Roy, Tremblay très courants au Québec)
- Présence dans une équipe au nom français (cf. Team Baguette Sirop d'Érable = équipe FR + QC)

---

## 4. Workflow de mise à jour de `french_players.yaml`

À faire avant **chaque nouveau Pro Tour** (15-30 min de boulot) :

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Liste d'invitation                                            │
│    https://magic.gg/events/{slug}-invitation-list                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. Filtre `RC - EMEA` + `Magic Spotlight Lyon`                   │
│    → liste de candidats                                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. Pour chaque candidat, vérifier 1 source ★★★ ou 2 sources ★★  │
│    - mtgtop8 drapeau pays                                        │
│    - Historique RC (2-3 derniers PT)                             │
│    - Twitter / Discord MTGTools                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                  ┌───────────┴────────────┐
                  ▼                        ▼
        ┌─────────────────┐      ┌──────────────────┐
        │ confirmé FR     │      │ confirmé non-FR  │
        │ → players:      │      │ → excluded:      │
        │   verified:true │      │   sources: [...] │
        └─────────────────┘      └──────────────────┘
                  │                        │
                  └───────────┬────────────┘
                              ▼
        ┌──────────────────────────────────────────┐
        │ Cas litigieux (preuves contradictoires)? │
        │ → players: avec verified:false           │
        │ → ouvrir une issue pour discussion       │
        │ → le scraper IGNORE les non-vérifiés     │
        └──────────────────────────────────────────┘
                              │
                              ▼
        Commit : `chore: update FR roster for {slug}`
```

---

## 5. Filtre défensif au niveau scraper

Le code `scrapers/scrape_melee.py > identify_french()` applique un filtre strict :

```python
fr_index = {
    normalize_name(p["name"]): p
    for p in config.get("players", [])
    if p.get("verified") is True   # ← seuls les verified=true sont publiés
}
```

**Conséquence** : même si un joueur litigieux reste accidentellement dans `players:` avec `verified: false`, **il ne fuitera jamais publiquement** dans le JSON de sortie ni sur le site. Cela donne aux mainteneurs une zone de quarantaine pour discuter sans risque.

Les normalisations effectuées :

- `unicodedata.normalize("NFC", name)` — préserve les diacritiques (é, è, ô)
- `re.sub(r"\s*,\s*", ", ", ...)` — normalise les virgules
- `.casefold()` — comparaison case-insensitive

Le format `Last, First` reste autoritaire. Toute déviation (`First Last`, surnoms, abréviations) doit être corrigée dans le YAML, jamais dans le code.

---

## 6. Joueurs explicitement exclus

La transparence est une feature : les exclusions sont **publiques et justifiées** dans `excluded:` de [`scrapers/data/french_players.yaml`](../scrapers/data/french_players.yaml). Au moment de l'écriture de ce document :

| Joueur | Nationalité présumée | Raison |
|---|---|---|
| Offman, Noé | CA (Québec) | RC Montréal mai 2025 + RC F2F Ottawa Fév 2024 + Team Trios Montréal Janv 2024 |
| Dore, Max | CA (Québec) | Team Baguette Sirop d'Érable (équipe franco-canadienne) |
| Pham, Ha | CA (Québec) | Team Baguette Sirop d'Érable |
| Roudier, Remi | CA (Québec) | Team Baguette Sirop d'Érable |
| Dubreuil, Eleanor | CA (Québec) | RC Montréal |
| Harvey, Clément | CA (Québec) | Circuit F2F Tour |
| Rayvich, Maxime | Non-FR (préciser) | Signalé non-français par le maintainer |

> Si une exclusion te paraît injuste ou erronée, ouvre une issue avec une evidence ★★★ neuve. Le maintainer reverra avec plaisir — c'est l'objectif de la liste publique.

---

## 7. Biais et limites connus

### Biais 1 — Joueurs FR jouant à l'étranger

Un Français installé aux États-Unis qui se qualifie via `RC - US #1` ne sera pas détecté automatiquement. Cas rare mais existant. Si tu en connais, ouvre une issue avec evidence : c'est un override manuel.

### Biais 2 — Doubles nationaux

Un joueur FR/CA qui joue alternativement les deux circuits est complexe. Position du projet : on suit la *résidence MTG* (RC d'attache habituel sur les 2-3 derniers PT), pas le passeport. Si un joueur passe d'EMEA à Canada définitivement, on le déplace en `excluded:` à partir du PT suivant.

### Biais 3 — Nouveaux qualifiés

Les nouveaux invités (premier PT) n'ont pas d'historique RC — il faut des evidence externes (Twitter, Discord). Risque de manquer un FR au premier PT, corrigé au PT suivant. Acceptable.

### Biais 4 — Magic Spotlight Lyon

Bien que biaisé en faveur des FR, le Spotlight Lyon attire aussi des joueurs UK/DE/IT. Ne pas auto-classer FR sur ce seul critère.

### Biais 5 — Non-binaires noms / pseudos

Certains joueurs s'enregistrent sous un pseudo ou un nom légèrement différent de leur état civil. Cas rare en PT (Wizards exige le legal name) mais à signaler en issue le cas échéant.

---

## 8. Limites volontaires du périmètre

- **Le tracker suit uniquement les Français au sens strict.** Pas les francophones, pas les "joueurs FR-friendly", pas les expats.
- **Les événements supportés sont limités** (~15/an) : Pro Tours, Worlds, Magic Spotlight Series, Arena Championship, RC EMEA. Pas les opens locaux, pas les Last-Chance Trials.
- **Pas de classement historique** ni de "Hall of Fame FR" pour la v1. Possible plus tard si la demande émerge.

---

## 9. Audit externe bienvenu

Le projet est ouvert à toute critique méthodologique. Pour soumettre un audit :

1. Compare la liste `players:` actuelle avec ta propre source (mtgtop8, magic.gg).
2. Liste les divergences (FR oublié, non-FR inclus, exclusion abusive).
3. Ouvre une issue avec evidence.

Le mainteneur s'engage à répondre dans la semaine et à corriger ce qui est documentable.

---

## 10. Mises à jour de ce document

Ce document est versionné. Chaque modification de la méthodologie doit :

- Faire l'objet d'une PR avec discussion préalable en issue.
- Mettre à jour la date de "Dernière révision" ci-dessous.
- Être accompagnée d'un commit `docs: update METHODOLOGY (raison)`.

**Dernière révision** : 2 mai 2026 (initialisation publique).
