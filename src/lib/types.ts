export type EventStatus = "upcoming" | "live" | "ended";

export interface MTGEvent {
  slug: string;
  name: string;
  shortName: string;
  location: string;
  dates: string;
  status: EventStatus;
  currentRound: number;
  totalRounds: number;
  formats: string;
  field: number | null;
  purse: number;
  meleeId: number | null;
  sourceUrl: string;
}

export interface FrenchPlayer {
  rank: number;
  first: string;
  last: string;
  points: number;
  omw: number;
  archetype: string;

  // Données melee.gg (optionnelles, présentes si scrappé via melee)
  gw?: number;             // Team Game Win % (tiebreaker 2)
  ogw?: number;            // Opponent Game Win % (tiebreaker 3)
  matchRecord?: string;    // "W-L-D" total tournoi
  gameRecord?: string;     // "W-L-D" en games
  decklistId?: string;     // GUID de la decklist sur melee.gg
  decklistUrl?: string;    // URL complète vers melee.gg/Decklist/View/{id}

  // Split par jour et par format (Pro Tour : 3 Draft + 5 Standard / jour)
  draftD1: string | null;
  standardD1: string | null;
  draftD2: string | null;
  standardD2: string | null;
  finalRecord: string | null;

  source: string; // Origine d'invitation : "RC EMEA", "39+ AMP", "Worlds Top 8", etc.
  rcOrigin: string;
  flag?: string;
  noLimited?: boolean; // True pour Worlds (full Standard, pas de Draft)
}

export type DataSource = "melee.gg" | "magic.gg";

export interface LiveMatchCompetitor {
  name: string;       // "Last, First" ou Username
  last: string;
  first: string;
  gameWins: number;   // games gagnés sur ce match (0, 1 ou 2 typiquement)
  archetype: string | null;  // depuis Decklists[0].DecklistName
  decklistId?: string | null;
  decklistUrl?: string | null;
}

export interface LiveMatch {
  table: number;
  round: number;
  hasResult: boolean;       // false = match en cours, true = match terminé
  featured: boolean;        // FeatureMatch melee (table couverte par le stream)
  podNumber: number | null; // pour drafts (3 rondes par pod)
  fr: LiveMatchCompetitor;
  opponent: LiveMatchCompetitor;
  frVsFr: boolean;
}

export interface LiveRound {
  name: string;          // "Round 9"
  number: number | null;
  started: boolean;
}

export interface EventData {
  slug: string;
  round: number;
  totalRounds: number;
  scrapedAt: string;
  fieldSize: number;
  source?: DataSource;
  tournamentId?: number;
  frenchPlayers: FrenchPlayer[];
  liveRound?: LiveRound;       // ronde actuellement en cours (si applicable)
  liveMatches?: LiveMatch[];   // matchs avec au moins un FR sur la ronde en cours
}

export type PerformanceTone =
  | "elite"     // 21+ pts à R8 ou 36+ à R16 — Top 8 lock
  | "strong"    // 18+ pts à R8 ou 33+ à R16 — Top 8 pace
  | "ok"        // Day 2 acquis ou requalif acquise
  | "bubble"    // À risque (3-5 à R8)
  | "weak"      // Hors course
  | "dropped";  // Drop

export interface Performance {
  tone: PerformanceTone;
  label: string;
}

export interface Projection {
  status: "acquired" | "achievable" | "impossible";
  display: string;
}

export interface PlayerProjections {
  top8: Projection;
  requalif: Projection;
}
