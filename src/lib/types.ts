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

export interface EventData {
  slug: string;
  round: number;
  totalRounds: number;
  scrapedAt: string;
  fieldSize: number;
  frenchPlayers: FrenchPlayer[];
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
