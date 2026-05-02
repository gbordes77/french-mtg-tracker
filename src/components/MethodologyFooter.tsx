import type { MTGEvent } from "@/lib/types";

interface Props {
  event: MTGEvent;
}

const blockTitleStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.2em",
  color: "var(--text-secondary)",
  marginBottom: "0.5rem",
};

const bodyStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  lineHeight: "var(--lh-relaxed)",
  color: "var(--text-secondary)",
};

export default function MethodologyFooter({ event }: Props) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div style={blockTitleStyle}>Méthodologie</div>
          <p style={bodyStyle}>
            Identification croisée via la liste d'invitation magic.gg, les{" "}
            <em>Regional Championship</em> EMEA et les Spotlight Lyon. Les
            Québécois et Belges francophones sont explicitement exclus via leur
            circuit RC d'origine.
          </p>
        </div>
        <div>
          <div style={blockTitleStyle}>Sources</div>
          <p style={bodyStyle}>
            magic.gg standings · melee.gg/Tournament/View/{event.meleeId || "TBD"}
            · MTGTop8 · vérification Twitter/X.
          </p>
        </div>
        <div>
          <div style={blockTitleStyle}>Contribuer</div>
          <p style={bodyStyle}>
            Un joueur français manque ? Une erreur ? Pull request sur{" "}
            <span style={{ color: "var(--text-primary)" }}>
              github.com/gbordes77/french-mtg-tracker
            </span>
            .
          </p>
        </div>
      </div>

      <div
        className="mt-10 pt-6 flex items-center justify-between font-mono"
        style={{
          fontSize: "10px",
          color: "var(--text-secondary)",
          opacity: 0.6,
          borderTop: "1px solid var(--glass-border)",
        }}
      >
        <span>FRENCH MTG TRACKER · MTGTOOLS · 2026</span>
        <span>Indépendant · Non affilié à Wizards of the Coast</span>
      </div>
    </>
  );
}
