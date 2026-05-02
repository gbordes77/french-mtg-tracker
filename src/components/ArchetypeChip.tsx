import { archetypeColor } from "@/lib/helpers";

interface Props {
  archetype: string;
}

/**
 * Chip d'archétype avec symboles mana-font canoniques (brandbook §6).
 * Les couleurs viennent de la palette mana ManaTuner (helpers.ts > archetypeColor).
 */
export default function ArchetypeChip({ archetype }: Props) {
  const c = archetypeColor(archetype);

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-xs rounded font-mono border"
      style={{
        background: c.bg,
        borderColor: c.border,
        color: c.fg,
      }}
    >
      <span className="archetype-mana" aria-hidden>
        {c.manaCodes.map((code) => (
          <i key={code} className={`ms ms-cost ms-${code}`} />
        ))}
      </span>
      <span>{archetype}</span>
    </span>
  );
}
