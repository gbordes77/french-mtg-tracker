interface Props {
  label: string;
  value: string | number;
  sub?: string;
  /** Surligne la card avec un trait latéral FR (pour les blocs vraiment importants) */
  highlightFr?: boolean;
}

/**
 * Stat block — utilise .ds-card de ManaTuner (glass en dark).
 * Typo : label/sub en JetBrains Mono (techTerm), value en Cinzel.
 */
export default function StatBlock({ label, value, sub, highlightFr }: Props) {
  return (
    <div
      className={`ds-card p-4 ${highlightFr ? "ds-card--bordered-fr" : ""}`}
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <div
        className="font-mono uppercase mb-1.5"
        style={{
          fontSize: "10px",
          letterSpacing: "0.2em",
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </div>
      <div
        className="tabular-nums leading-none"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "2.25rem",
          fontWeight: "var(--fw-semibold)",
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="font-mono mt-1.5"
          style={{
            fontSize: "10px",
            color: "var(--text-secondary)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
