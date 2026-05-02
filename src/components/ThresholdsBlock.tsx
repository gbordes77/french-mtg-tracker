import { ExternalLink } from "lucide-react";

interface ThresholdProps {
  record: string;
  label: string;
  detail: string;
  color: string;
  /** Si fourni, le bloc devient cliquable et pointe vers cette URL externe */
  href?: string;
  hint?: string;
}

function Threshold({ record, label, detail, color, href, hint }: ThresholdProps) {
  const inner = (
    <>
      <div
        className="tabular-nums flex items-baseline gap-2"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "2rem",
          fontWeight: "var(--fw-semibold)",
          color,
          lineHeight: 1,
        }}
      >
        {record}
        {href && (
          <ExternalLink
            className="w-4 h-4"
            style={{ opacity: 0.6 }}
            aria-hidden="true"
          />
        )}
      </div>
      <div
        className="font-mono uppercase mt-2"
        style={{
          fontSize: "10px",
          letterSpacing: "0.2em",
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </div>
      <div
        className="font-mono mt-1"
        style={{ fontSize: "10px", color: "var(--text-secondary)", opacity: 0.7 }}
      >
        {detail}
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        title={hint}
        aria-label={`${label} — ouvrir le classement officiel sur magic.gg`}
        className="block transition-all"
        style={{ textDecoration: "none" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "";
          (e.currentTarget as HTMLElement).style.filter = "";
        }}
      >
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

/**
 * Bloc seuils officiels Pro Tour — utilise .ds-card de ManaTuner.
 * Les couleurs des records correspondent à la palette mana :
 * - Day 2 (4-4)     → mana-blue
 * - Requalif (10-6) → mana-green
 * - Top 8 (12-4)    → mana-multicolor (gold)
 * - AMP (39+)       → mana-red
 */
export default function ThresholdsBlock() {
  return (
    <div className="ds-card mb-12 p-6">
      <div
        className="font-mono uppercase mb-5"
        style={{
          fontSize: "10px",
          letterSpacing: "0.2em",
          color: "var(--text-secondary)",
        }}
      >
        Seuils officiels Pro Tour (16 rondes)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Threshold
          record="4-4"
          label="Day 2 acquis"
          detail="≥ 12 pts à R8"
          color="var(--mana-blue)"
        />
        <Threshold
          record="10-6"
          label="Re-qualif PT"
          detail="≥ 30 pts · invit prochain PT"
          color="var(--mana-green)"
        />
        <Threshold
          record="12-4"
          label="Top 8 / Worlds"
          detail="≥ 36 pts · cut variable"
          color="var(--mana-multicolor)"
        />
        <Threshold
          record="39+"
          label="AMP cumulé"
          detail="3 derniers PT · voie alt."
          color="var(--mana-red)"
          href="https://magic.gg/standings/pro-tour-adjusted-match-points"
          hint="Voir le classement AMP officiel 2026 sur magic.gg"
        />
      </div>
    </div>
  );
}
