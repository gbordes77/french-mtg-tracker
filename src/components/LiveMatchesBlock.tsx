import { Radio, Star } from "lucide-react";
import type { LiveMatch, LiveRound } from "@/lib/types";
import ArchetypeChip from "./ArchetypeChip";

interface Props {
  liveRound: LiveRound;
  matches: LiveMatch[];
  scrapedAt: string;
}

/**
 * Bloc "Round X en cours" — affiché quand le scraper detecte un round
 * started=true && completed=false. Une ligne par match avec au moins un FR.
 *
 * Données live melee.gg : table, archetype (auto via decklist), score
 * en games (0-0, 1-0, 2-1...), status (en cours / terminé), feature match.
 */
export default function LiveMatchesBlock({ liveRound, matches, scrapedAt }: Props) {
  if (!matches || matches.length === 0) return null;

  const inProgress = matches.filter((m) => !m.hasResult).length;
  const finished = matches.filter((m) => m.hasResult).length;
  const allFinished = inProgress === 0;
  const updatedAgo = formatRelative(scrapedAt);

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h3
          className="flex items-center gap-3"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: "var(--fw-medium)",
            fontSize: "1.75rem",
            color: "var(--text-primary)",
          }}
        >
          <Radio
            className="w-5 h-5"
            style={{
              color: allFinished ? "var(--text-secondary)" : "var(--mana-red)",
            }}
            aria-hidden="true"
          />
          <span className="italic">
            {liveRound.name} {allFinished ? "· résultats" : "en cours"}
          </span>
        </h3>
        <div
          className="font-mono flex items-center gap-3 flex-wrap"
          style={{ fontSize: "11px", color: "var(--text-secondary)" }}
        >
          <span>
            {allFinished
              ? `${finished} matchs terminés`
              : `${inProgress} en cours · ${finished} terminés`}
          </span>
          <span>·</span>
          <span>refresh {updatedAgo}</span>
        </div>
      </div>

      <div className="ds-card overflow-x-auto" style={{ padding: 0 }}>
        <table className="w-full min-w-[800px]">
          <caption className="sr-only">
            Matchs des Français sur la {liveRound.name}.
          </caption>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
              {["Table", "Statut", "Joueur FR", "Archétype", "Score", "Adversaire", "Archétype"].map(
                (h, idx) => (
                  <th
                    key={h}
                    scope="col"
                    className="font-mono uppercase font-normal text-left"
                    style={{
                      padding: "10px 12px",
                      paddingLeft: idx === 0 ? "1.25rem" : "12px",
                      paddingRight: idx === 6 ? "1.25rem" : "12px",
                      fontSize: "10px",
                      letterSpacing: "0.2em",
                      color: "var(--text-secondary)",
                      opacity: 0.7,
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => (
              <LiveMatchRow key={`${m.table}-${m.fr.name}-${i}`} match={m} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LiveMatchRow({ match: m }: { match: LiveMatch }) {
  const won = m.fr.gameWins > m.opponent.gameWins;
  const lost = m.fr.gameWins < m.opponent.gameWins;
  const tied = m.fr.gameWins === m.opponent.gameWins && m.hasResult;

  const scoreColor = m.hasResult
    ? won
      ? "var(--mana-green)"
      : lost
        ? "var(--mana-red)"
        : "var(--text-secondary)"
    : "var(--text-primary)";

  return (
    <tr
      style={{
        borderTop: "1px solid var(--glass-border)",
      }}
    >
      <td
        className="tabular-nums font-mono"
        style={{
          padding: "10px 12px",
          paddingLeft: "1.25rem",
          fontSize: "0.875rem",
          color: m.featured ? "var(--mana-multicolor)" : "var(--text-primary)",
          fontWeight: m.featured ? 600 : 400,
        }}
      >
        <span className="inline-flex items-center gap-1.5">
          {m.featured && (
            <Star
              className="w-3 h-3"
              style={{ color: "var(--mana-multicolor)" }}
              aria-hidden="true"
            />
          )}
          {m.table}
        </span>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <StatusBadge hasResult={m.hasResult} won={won} lost={lost} tied={tied} />
      </td>
      <td
        style={{
          padding: "10px 12px",
          fontSize: "0.95rem",
          color: "var(--text-primary)",
          fontWeight: 600,
        }}
      >
        {m.fr.first} <strong>{m.fr.last}</strong>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <ArchetypeRef archetype={m.fr.archetype} url={m.fr.decklistUrl} />
      </td>
      <td
        className="tabular-nums font-mono text-center"
        style={{
          padding: "10px 12px",
          fontSize: "1rem",
          fontWeight: 700,
          color: scoreColor,
        }}
      >
        {m.fr.gameWins}–{m.opponent.gameWins}
      </td>
      <td
        style={{
          padding: "10px 12px",
          fontSize: "0.95rem",
          color: m.frVsFr ? "var(--mana-multicolor)" : "var(--text-primary)",
        }}
      >
        {m.opponent.first} {m.opponent.last}
        {m.frVsFr && (
          <span
            className="ml-2 font-mono"
            style={{ fontSize: "9px", color: "var(--mana-multicolor)" }}
          >
            FR
          </span>
        )}
      </td>
      <td style={{ padding: "10px 12px", paddingRight: "1.25rem" }}>
        <ArchetypeRef
          archetype={m.opponent.archetype}
          url={m.opponent.decklistUrl}
        />
      </td>
    </tr>
  );
}

function ArchetypeRef({
  archetype,
  url,
}: {
  archetype: string | null;
  url?: string | null;
}) {
  if (!archetype) {
    return (
      <span
        className="font-mono"
        style={{ fontSize: "0.8rem", color: "var(--text-secondary)", opacity: 0.6 }}
      >
        —
      </span>
    );
  }
  return <ArchetypeChip archetype={archetype} decklistUrl={url ?? undefined} />;
}

function StatusBadge({
  hasResult,
  won,
  lost,
  tied,
}: {
  hasResult: boolean;
  won: boolean;
  lost: boolean;
  tied: boolean;
}) {
  if (!hasResult) {
    return (
      <span
        className="inline-flex items-center gap-1.5 font-mono uppercase"
        style={{
          fontSize: "10px",
          letterSpacing: "0.15em",
          color: "var(--mana-blue)",
          background: "rgba(14,104,171,0.10)",
          padding: "3px 8px",
          borderRadius: "var(--radius-full)",
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--mana-blue)",
            display: "inline-block",
            animation: "ds-pulse-ring 1.5s infinite",
          }}
        />
        en cours
      </span>
    );
  }
  const label = won ? "victoire" : lost ? "défaite" : tied ? "draw" : "—";
  const color = won ? "var(--mana-green)" : lost ? "var(--mana-red)" : "var(--text-secondary)";
  const bg = won
    ? "rgba(0,115,62,0.10)"
    : lost
      ? "rgba(211,32,42,0.10)"
      : "var(--glass-secondary)";
  return (
    <span
      className="inline-flex items-center font-mono uppercase"
      style={{
        fontSize: "10px",
        letterSpacing: "0.15em",
        color,
        background: bg,
        padding: "3px 8px",
        borderRadius: "var(--radius-full)",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return iso;
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min === 1) return "il y a 1 min";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return `il y a ${h} h`;
}
