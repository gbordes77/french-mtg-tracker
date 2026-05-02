import type {
  FrenchPlayer,
  Performance,
  PerformanceTone,
  PlayerProjections,
  Projection,
} from "./types";

// ────────────────────────────────────────────────────────────
// Calcul du record total à partir des sous-records par format
// ────────────────────────────────────────────────────────────

export interface TotalRecord {
  wins: number;
  losses: number;
  dropped: boolean;
}

export function computeTotalRecord(player: FrenchPlayer): TotalRecord {
  const parts = [
    player.draftD1,
    player.standardD1,
    player.draftD2,
    player.standardD2,
  ];
  let wins = 0;
  let losses = 0;
  let dropped = false;

  for (const part of parts) {
    if (!part) continue;
    if (part === "DROP") {
      dropped = true;
      continue;
    }
    const [w, l] = part.split("-").map(Number);
    if (!isNaN(w)) wins += w;
    if (!isNaN(l)) losses += l;
  }

  return { wins, losses, dropped };
}

// ────────────────────────────────────────────────────────────
// Projections : combien de victoires sur les rondes restantes
// pour atteindre Top 8 ou Re-qualif PT
// ────────────────────────────────────────────────────────────

// Seuils officiels Pro Tour (16 rondes)
// Source : magic.gg/events/{slug}-fact-sheet-for-competitors
export const THRESHOLDS = {
  DAY_2: 12,        // 4 victoires minimum à R8
  REQUALIF_PT: 30,  // 10 victoires sur 16 rondes = invitation auto au prochain PT
  TOP_8: 36,        // 12 victoires sur 16 rondes (cut variable)
  AMP_BONUS: 39,    // Voie alternative via Adjusted Match Points cumulés
} as const;

export const GOAL_WINS = {
  DAY_2: 4,
  REQUALIF_PT: 10,
  TOP_8: 12,
} as const;

export function projectionToGoal(
  currentWins: number,
  roundsRemaining: number,
  goalWins: number,
): Projection {
  const winsNeeded = goalWins - currentWins;
  if (winsNeeded <= 0) return { status: "acquired", display: "acquis" };
  if (winsNeeded > roundsRemaining)
    return { status: "impossible", display: "hors d'atteinte" };
  const lossesAllowed = roundsRemaining - winsNeeded;
  return {
    status: "achievable",
    display: `${winsNeeded}-${lossesAllowed}+ requis`,
  };
}

export function getProjections(
  player: FrenchPlayer,
  currentRound: number,
  totalRounds = 16,
): PlayerProjections | null {
  const rec = computeTotalRecord(player);
  if (rec.dropped || player.finalRecord) return null;
  const roundsRemaining = totalRounds - currentRound;
  if (roundsRemaining <= 0) return null;

  return {
    top8: projectionToGoal(rec.wins, roundsRemaining, GOAL_WINS.TOP_8),
    requalif: projectionToGoal(rec.wins, roundsRemaining, GOAL_WINS.REQUALIF_PT),
  };
}

// ────────────────────────────────────────────────────────────
// Tone de performance : statut visuel global du joueur
// ────────────────────────────────────────────────────────────

export function performanceTone(
  points: number,
  currentRound: number,
  _totalRounds = 16,
): Performance {
  if (points === 0 && currentRound >= 5)
    return { tone: "dropped", label: "Drop" };

  // Day 1 (rondes 1-8)
  if (currentRound <= 8) {
    if (points >= 21) return { tone: "elite", label: "Top contender" };
    if (points >= 18) return { tone: "strong", label: "Top 8 pace" };
    if (points >= 12) return { tone: "ok", label: "Day 2 qualifié" };
    if (points >= 9) return { tone: "bubble", label: "Bubble Day 2" };
    return { tone: "weak", label: "Éliminé Day 2" };
  }

  // Day 2 (rondes 9-16)
  if (points >= THRESHOLDS.TOP_8) return { tone: "elite", label: "Top 8" };
  if (points >= 33) return { tone: "strong", label: "Top 8 pace" };
  if (points >= THRESHOLDS.REQUALIF_PT)
    return { tone: "ok", label: "PT requalifié" };
  if (points >= 24) return { tone: "bubble", label: "In the money" };
  return { tone: "weak", label: "Hors course" };
}

// ────────────────────────────────────────────────────────────
// Couleur d'archétype — sémantique des couleurs Magic
// Palette canon ManaTuner (brandbook §2 — never change)
// W = Plains, U = Island, B = Swamp, R = Mountain, G = Forest
// ────────────────────────────────────────────────────────────

export interface ArchetypeStyle {
  bg: string;
  border: string;
  fg: string;
  /** Codes couleur mana pour rendu via mana-font (ex: ["u","r"] pour Izzet) */
  manaCodes: string[];
}

/**
 * Mapping archétype → identité couleur mana.
 * Couleurs Wizards canoniques en valeurs RGB pour les rgba transparentes.
 * - mana-blue  #0E68AB
 * - mana-red   #D3202A
 * - mana-green #00733E
 * - mana-gold  #E9B54C (multicolor)
 * - mana-black #150B00
 */
export function archetypeColor(archetype: string): ArchetypeStyle {
  const a = archetype.toLowerCase();

  // Izzet (U+R) — le plus fréquent au PT SOS
  if (a.includes("izzet")) {
    return {
      bg: "rgba(14, 104, 171, 0.12)",
      border: "var(--mana-blue)",
      fg: "var(--mana-blue)",
      manaCodes: ["u", "r"],
    };
  }

  // Mono-Green ou archétypes verts dominants
  if (a.includes("mono-green") || a.includes("mono green")) {
    return {
      bg: "rgba(0, 115, 62, 0.15)",
      border: "var(--mana-green)",
      fg: "var(--mana-green)",
      manaCodes: ["g"],
    };
  }

  // Simic (G+U)
  if (a.includes("simic") || a.includes("bant rhythm")) {
    return {
      bg: "rgba(0, 115, 62, 0.12)",
      border: "var(--mana-green)",
      fg: "var(--mana-green)",
      manaCodes: ["g", "u"],
    };
  }

  // Bant (W+U+G)
  if (a.includes("bant")) {
    return {
      bg: "rgba(233, 181, 76, 0.18)",
      border: "var(--mana-multicolor)",
      fg: "var(--mana-multicolor)",
      manaCodes: ["w", "u", "g"],
    };
  }

  // Jeskai (W+U+R)
  if (a.includes("jeskai")) {
    return {
      bg: "rgba(233, 181, 76, 0.16)",
      border: "var(--mana-multicolor)",
      fg: "var(--mana-multicolor)",
      manaCodes: ["u", "r", "w"],
    };
  }

  // Sultai (B+U+G) ou variantes Reanimator/Dimir
  if (a.includes("sultai") || a.includes("reanimator")) {
    return {
      bg: "rgba(21, 11, 0, 0.10)",
      border: "var(--mana-colorless)",
      fg: "var(--text-primary)",
      manaCodes: ["b", "u", "g"],
    };
  }

  if (a.includes("dimir")) {
    return {
      bg: "rgba(21, 11, 0, 0.08)",
      border: "var(--mana-colorless)",
      fg: "var(--text-primary)",
      manaCodes: ["u", "b"],
    };
  }

  // Fallback colorless
  return {
    bg: "rgba(203, 197, 192, 0.15)",
    border: "var(--mana-colorless)",
    fg: "var(--text-secondary)",
    manaCodes: ["c"],
  };
}

// ────────────────────────────────────────────────────────────
// Style de tone — palette mana ManaTuner (auto-adaptive light/dark)
// ────────────────────────────────────────────────────────────

export const toneColors: Record<PerformanceTone, string> = {
  elite:   "var(--mana-multicolor)",  // gold premium
  strong:  "var(--mana-green)",       // succès
  ok:      "var(--mana-blue)",        // info
  bubble:  "var(--mana-multicolor)",  // warning (mêmes valeurs que elite — diff par opacité au consumer)
  weak:    "var(--mana-colorless)",   // neutre
  dropped: "var(--text-secondary)",   // dimmed
};

// ────────────────────────────────────────────────────────────
// Décodeur des sources d'invitation au Pro Tour
// ────────────────────────────────────────────────────────────

/**
 * Convertit une source brute (e.g. "39+ AMP", "Deferred PT ECL", "Worlds 31 Top 8")
 * en explication courte lisible. Retourne null si on ne reconnaît pas.
 *
 * Couvre les voies de qualification les plus courantes (cf. Wizards
 * Premier Tournament Invitation Policy).
 */
export function explainSource(source: string | null | undefined): string | null {
  if (!source) return null;
  const s = source.trim();

  if (/^39\+\s*amp$/i.test(s))
    return "Cumulé 39+ AMP sur les 3 derniers PT (voie alternative)";

  // Deferred PT XXX = invitation reportée d'un PT précédent
  const deferredMatch = s.match(/^deferred\s+pt\s+(.+)$/i);
  if (deferredMatch)
    return `Invitation au PT ${deferredMatch[1]} reportée sur ce PT-ci`;

  // Worlds N Top 8
  const worldsMatch = s.match(/^worlds\s+(\d+)\s+top\s+(\d+)$/i);
  if (worldsMatch)
    return `Top ${worldsMatch[2]} du Magic World Championship ${worldsMatch[1]}`;

  // Spotlight + ville
  const spotlightMatch = s.match(/^spotlight\s+(.+)$/i);
  if (spotlightMatch)
    return `Top finish à un Magic Spotlight Series (${spotlightMatch[1]})`;

  if (/mtgo\s+champions\s+showcase/i.test(s))
    return "Top finish au tournoi MTGO Champions Showcase";

  // PT XXX 30+ MP (re-qualif via 10-6 sur PT précédent)
  const ptMpMatch = s.match(/^pt\s+(\S+)\s+(\d+)\+\s*mp$/i);
  if (ptMpMatch)
    return `${ptMpMatch[2]}+ match points (${(parseInt(ptMpMatch[2]) / 3) | 0}+ victoires) au PT ${ptMpMatch[1]} précédent — re-qualif directe`;

  // RC EMEA, RC NA etc.
  const rcMatch = s.match(/^rc\s+(emea|na|\w+)$/i);
  if (rcMatch)
    return `Top finish à un Regional Championship ${rcMatch[1].toUpperCase()}`;

  if (/^pt\s+top\s+8$/i.test(s))
    return "Top 8 d'un Pro Tour précédent — qualif auto";

  if (/à\s*v[ée]rifier/i.test(s)) return null; // placeholder, ne pas expliquer

  return null;
}

export function projectionColor(
  status: Projection["status"],
): string {
  switch (status) {
    case "acquired":
      return "var(--mana-green)";
    case "achievable":
      return "var(--text-primary)";
    case "impossible":
      return "var(--text-secondary)";
  }
}
