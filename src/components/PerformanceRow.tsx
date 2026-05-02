import { Trophy, TrendingUp, TrendingDown, Minus, Circle } from "lucide-react";
import type { FrenchPlayer, MTGEvent } from "@/lib/types";
import {
  computeTotalRecord,
  getProjections,
  performanceTone,
  toneColors,
  projectionColor,
  explainSource,
} from "@/lib/helpers";
import ArchetypeChip from "./ArchetypeChip";
import FormatSplit from "./FormatSplit";

interface Props {
  player: FrenchPlayer;
  event: MTGEvent;
  isFirst: boolean;
}

const toneIcon = {
  elite: <Trophy className="w-3 h-3" />,
  strong: <TrendingUp className="w-3 h-3" />,
  ok: <Circle className="w-3 h-3 fill-current" />,
  bubble: <TrendingDown className="w-3 h-3" />,
  weak: <Minus className="w-3 h-3" />,
  dropped: <Circle className="w-3 h-3" />,
};

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.15em",
  color: "var(--text-secondary)",
};

export default function PerformanceRow({ player, event, isFirst }: Props) {
  const perf = performanceTone(player.points, event.currentRound, event.totalRounds);
  const rec = computeTotalRecord(player);
  const proj = getProjections(player, event.currentRound, event.totalRounds);

  const rowBorder = isFirst ? "none" : "1px solid var(--glass-border)";

  return (
    <tr style={{ borderTop: rowBorder }} className="hover:bg-white/[0.02] transition-colors">
      {/* Rang — Cinzel léger */}
      <td className="py-4 pl-6 pr-3 align-top">
        <div className="flex items-baseline gap-3">
          <span
            className="tabular-nums"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.5rem",
              fontWeight: "var(--fw-medium)",
              color: perf.tone === "dropped" ? "var(--text-secondary)" : "var(--text-primary)",
            }}
          >
            {String(player.rank).padStart(3, "0")}
          </span>
          {player.flag && <span className="text-base">{player.flag}</span>}
        </div>
      </td>

      {/* Joueur — Inter pour prénom + Cinzel pour nom */}
      <td className="py-4 px-3 align-top">
        <div className="leading-tight">
          <div style={labelStyle}>{player.first}</div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--fw-semibold)",
              fontSize: "1.25rem",
              color: "var(--text-primary)",
              marginTop: "2px",
            }}
          >
            {player.last}
          </div>
        </div>
      </td>

      {/* Archétype — chip avec mana symbols */}
      <td className="py-4 px-3 align-top">
        <ArchetypeChip archetype={player.archetype} decklistUrl={player.decklistUrl} />
      </td>

      {/* Limited */}
      <td className="py-4 px-3 align-top">
        {player.noLimited ? (
          <span
            className="font-mono italic"
            style={{ fontSize: "10px", color: "var(--text-secondary)" }}
          >
            n/a
          </span>
        ) : (
          <FormatSplit d1={player.draftD1} d2={player.draftD2} />
        )}
      </td>

      {/* Construit */}
      <td className="py-4 px-3 align-top">
        <FormatSplit d1={player.standardD1} d2={player.standardD2} />
      </td>

      {/* Total — Cinzel grosse police pour le record */}
      <td className="py-4 px-3 align-top text-right">
        {rec.dropped ? (
          <>
            <div
              className="italic"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1.25rem",
                color: "var(--text-secondary)",
              }}
            >
              drop
            </div>
            <div
              className="font-mono uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.15em",
                color: "var(--text-secondary)",
              }}
            >
              {rec.wins}-{rec.losses} avant drop
            </div>
          </>
        ) : (
          <>
            <div
              className="tabular-nums"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--fw-semibold)",
                fontSize: "1.875rem",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              {rec.wins}
              <span style={{ color: "var(--text-secondary)" }}>–</span>
              {rec.losses}
            </div>
            <div
              className="font-mono uppercase mt-1"
              style={{
                fontSize: "10px",
                letterSpacing: "0.15em",
                color: "var(--text-secondary)",
              }}
            >
              OMW {(player.omw * 100).toFixed(1)}%
            </div>
            <div
              className="font-mono tabular-nums mt-0.5"
              style={{ fontSize: "10px", color: "var(--text-secondary)", opacity: 0.7 }}
            >
              {player.points} pts
            </div>
          </>
        )}
      </td>

      {/* Statut + Source + Projections */}
      <td className="py-4 pl-3 pr-6 align-top">
        <div
          className="flex items-center gap-2"
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
        <div className="mt-2">
          <div
            className="font-mono uppercase"
            style={{
              fontSize: "9px",
              letterSpacing: "0.15em",
              color: "var(--text-secondary)",
              opacity: 0.6,
            }}
          >
            Méthode de qualification à ce PT
          </div>
          <div
            className="font-mono mt-0.5"
            style={{
              fontSize: "10px",
              color: "var(--text-primary)",
              fontWeight: 600,
            }}
          >
            {player.source}
          </div>
          {explainSource(player.source) && (
            <div
              className="mt-0.5"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                color: "var(--text-secondary)",
                lineHeight: 1.4,
                maxWidth: "220px",
              }}
            >
              {explainSource(player.source)}
            </div>
          )}
        </div>

        {proj && (
          <div
            className="mt-2 pt-2 space-y-0.5 font-mono"
            style={{ borderTop: "1px solid var(--glass-border)" }}
          >
            <div className="flex items-center gap-1.5" style={{ fontSize: "9px" }}>
              <span
                className="uppercase"
                style={{
                  letterSpacing: "0.15em",
                  color: "var(--text-secondary)",
                  opacity: 0.7,
                }}
              >
                Top 8
              </span>
              <span style={{ color: projectionColor(proj.top8.status) }}>
                {proj.top8.display}
              </span>
            </div>
            <div className="flex items-center gap-1.5" style={{ fontSize: "9px" }}>
              <span
                className="uppercase"
                style={{
                  letterSpacing: "0.15em",
                  color: "var(--text-secondary)",
                  opacity: 0.7,
                }}
              >
                Requalif
              </span>
              <span style={{ color: projectionColor(proj.requalif.status) }}>
                {proj.requalif.display}
              </span>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
