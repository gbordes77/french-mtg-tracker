import { Trophy, TrendingUp, TrendingDown, Minus, Circle } from "lucide-react";
import type { FrenchPlayer, MTGEvent } from "@/lib/types";
import {
  computeTotalRecord,
  getProjections,
  performanceTone,
  toneColors,
  projectionColor,
} from "@/lib/helpers";
import ArchetypeChip from "./ArchetypeChip";

interface Props {
  player: FrenchPlayer;
  event: MTGEvent;
}

const toneIcon = {
  elite: <Trophy className="w-3 h-3" />,
  strong: <TrendingUp className="w-3 h-3" />,
  ok: <Circle className="w-3 h-3 fill-current" />,
  bubble: <TrendingDown className="w-3 h-3" />,
  weak: <Minus className="w-3 h-3" />,
  dropped: <Circle className="w-3 h-3" />,
};

/**
 * Variante mobile/compacte de PerformanceRow — affichée à la place de la
 * table sur viewports < 768px (cf. App.tsx + useMediaQuery).
 *
 * Layout vertical card :
 *   #5  Thierry RAMBOA           7-1-0
 *   [Izzet Prowess ↗]            OMW 62%
 *   Limited 3-0 · Standard 4-1
 *   ★ Top contender · 39+ AMP
 *   Top 8 acquis · Requalif acquis
 */
export default function PerformanceCard({ player, event }: Props) {
  const perf = performanceTone(player.points, event.currentRound, event.totalRounds);
  const rec = computeTotalRecord(player);
  const proj = getProjections(player, event.currentRound, event.totalRounds);

  return (
    <div
      className="ds-card p-4"
      style={{
        borderRadius: "var(--radius-lg)",
        opacity: rec.dropped ? 0.7 : 1,
      }}
    >
      {/* Ligne 1 : rang + joueur + record total */}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span
            className="tabular-nums shrink-0"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.25rem",
              fontWeight: "var(--fw-medium)",
              color: rec.dropped ? "var(--text-secondary)" : "var(--text-primary)",
            }}
          >
            #{player.rank}
          </span>
          <div className="min-w-0">
            <div
              className="font-mono uppercase truncate"
              style={{
                fontSize: "10px",
                letterSpacing: "0.15em",
                color: "var(--text-secondary)",
              }}
            >
              {player.first}
            </div>
            <div
              className="truncate"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--fw-semibold)",
                fontSize: "1.125rem",
                color: "var(--text-primary)",
                lineHeight: 1.2,
              }}
            >
              {player.last}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          {rec.dropped ? (
            <div
              className="italic font-mono uppercase"
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                letterSpacing: "0.15em",
              }}
            >
              drop ({rec.wins}-{rec.losses})
            </div>
          ) : (
            <>
              <div
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: "var(--fw-semibold)",
                  fontSize: "1.5rem",
                  color: "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {rec.wins}
                <span style={{ color: "var(--text-secondary)" }}>–</span>
                {rec.losses}
              </div>
              <div
                className="font-mono mt-1"
                style={{
                  fontSize: "10px",
                  color: "var(--text-secondary)",
                  letterSpacing: "0.05em",
                }}
              >
                {player.points} pts · OMW {(player.omw * 100).toFixed(1)}%
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ligne 2 : archetype */}
      <div className="mb-3">
        <ArchetypeChip archetype={player.archetype} decklistUrl={player.decklistUrl} />
      </div>

      {/* Ligne 3 : splits Limited / Construit */}
      {!rec.dropped && (
        <div
          className="font-mono mb-3"
          style={{
            fontSize: "11px",
            color: "var(--text-secondary)",
          }}
        >
          {!player.noLimited && (
            <>
              <span style={{ color: "var(--text-primary)" }}>Limited</span>{" "}
              <span className="tabular-nums">
                {player.draftD1 ?? "—"}
                {player.draftD2 ? ` / ${player.draftD2}` : ""}
              </span>{" "}
              <span style={{ opacity: 0.5 }}>·</span>{" "}
            </>
          )}
          <span style={{ color: "var(--text-primary)" }}>Construit</span>{" "}
          <span className="tabular-nums">
            {player.standardD1 ?? "—"}
            {player.standardD2 ? ` / ${player.standardD2}` : ""}
          </span>
        </div>
      )}

      {/* Ligne 4 : statut + source */}
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <div
          className="flex items-center gap-1.5"
          style={{ color: toneColors[perf.tone] }}
        >
          {toneIcon[perf.tone]}
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "10px",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "0.2em",
            }}
          >
            {perf.label}
          </span>
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--text-secondary)",
            opacity: 0.85,
          }}
        >
          {player.source}
        </span>
      </div>

      {/* Ligne 5 : projections */}
      {proj && (
        <div
          className="font-mono pt-2 flex items-center gap-3 flex-wrap"
          style={{
            borderTop: "1px solid var(--glass-border)",
            fontSize: "10px",
          }}
        >
          <span>
            <span
              style={{
                color: "var(--text-secondary)",
                letterSpacing: "0.15em",
              }}
              className="uppercase"
            >
              Top 8{" "}
            </span>
            <span style={{ color: projectionColor(proj.top8.status) }}>
              {proj.top8.display}
            </span>
          </span>
          <span style={{ color: "var(--text-secondary)", opacity: 0.5 }}>·</span>
          <span>
            <span
              style={{
                color: "var(--text-secondary)",
                letterSpacing: "0.15em",
              }}
              className="uppercase"
            >
              Requalif{" "}
            </span>
            <span style={{ color: projectionColor(proj.requalif.status) }}>
              {proj.requalif.display}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
