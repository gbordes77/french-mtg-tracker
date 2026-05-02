interface Props {
  d1: string | null;
  d2: string | null;
}

/**
 * Affiche un split D1/D2 (Limited ou Construit).
 * Typo : JetBrains Mono via font-mono (token ManaTuner).
 */
export default function FormatSplit({ d1, d2 }: Props) {
  const valueColor = (val: string | null): string => {
    if (!val) return "var(--text-secondary)";
    if (val === "DROP") return "var(--text-secondary)";
    return "var(--text-primary)";
  };

  return (
    <div className="flex flex-col gap-1 font-mono">
      <div className="flex items-center gap-2 text-[11px]">
        <span style={{ color: "var(--text-secondary)", width: "1.75rem" }}>
          D1
        </span>
        <span className="tabular-nums" style={{ color: valueColor(d1) }}>
          {d1 || "—"}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span style={{ color: "var(--text-secondary)", width: "1.75rem" }}>
          D2
        </span>
        <span className="tabular-nums" style={{ color: valueColor(d2) }}>
          {d2 || "—"}
        </span>
      </div>
    </div>
  );
}
