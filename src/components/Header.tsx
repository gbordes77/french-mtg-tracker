import { ExternalLink } from "lucide-react";

export default function Header() {
  return (
    <header
      className="relative z-10"
      style={{ borderBottom: "1px solid var(--glass-border)" }}
    >
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col leading-none">
            <span
              className="font-mono uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.3em",
                color: "var(--text-secondary)",
              }}
            >
              Suivi compétitif
            </span>
            <span
              className="mt-1.5"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1.5rem",
                fontWeight: "var(--fw-medium)",
                lineHeight: 1,
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>Les </span>
              <strong
                style={{
                  fontWeight: "var(--fw-bold)",
                  color: "var(--fr-red)",
                }}
              >
                Français
              </strong>
              <span style={{ color: "var(--text-secondary)" }}> au Pro Tour</span>
            </span>
          </div>
        </div>
        <div
          className="flex items-center gap-6 font-mono"
          style={{ fontSize: "11px", color: "var(--text-secondary)" }}
        >
          <span>v0.1.0</span>
          <span>
            {new Date().toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          <a
            href="https://github.com/gbordes77/french-mtg-tracker"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 transition-colors"
            style={{ color: "inherit" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")
            }
          >
            Source <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </header>
  );
}
