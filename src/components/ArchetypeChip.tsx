import { ExternalLink } from "lucide-react";
import { archetypeColor } from "@/lib/helpers";

interface Props {
  archetype: string;
  /** Si fourni, la chip devient un lien cliquable vers la decklist sur melee.gg */
  decklistUrl?: string | null;
}

/**
 * Chip d'archétype avec symboles mana-font canoniques (brandbook §6).
 * Les couleurs viennent de la palette mana ManaTuner (helpers.ts > archetypeColor).
 *
 * Si `decklistUrl` est fourni, la chip devient un `<a>` cliquable qui ouvre
 * la decklist sur melee.gg dans un nouvel onglet, avec un petit icon
 * external-link pour signaler l'action.
 */
export default function ArchetypeChip({ archetype, decklistUrl }: Props) {
  const c = archetypeColor(archetype);

  const baseStyle = {
    background: c.bg,
    borderColor: c.border,
    color: c.fg,
  };

  const inner = (
    <>
      <span className="archetype-mana" aria-hidden>
        {c.manaCodes.map((code) => (
          <i key={code} className={`ms ms-cost ms-${code}`} />
        ))}
      </span>
      <span>{archetype}</span>
      {decklistUrl && (
        <ExternalLink
          className="w-3 h-3"
          style={{ marginLeft: "4px", opacity: 0.7 }}
          aria-hidden="true"
        />
      )}
    </>
  );

  if (decklistUrl) {
    return (
      <a
        href={decklistUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center px-2.5 py-1 text-xs rounded font-mono border transition-all"
        style={{
          ...baseStyle,
          textDecoration: "none",
          cursor: "pointer",
        }}
        title={`Decklist ${archetype} sur melee.gg`}
        aria-label={`Voir la decklist ${archetype} sur melee.gg`}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.filter = "";
          (e.currentTarget as HTMLElement).style.transform = "";
        }}
      >
        {inner}
      </a>
    );
  }

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-xs rounded font-mono border"
      style={baseStyle}
    >
      {inner}
    </span>
  );
}
