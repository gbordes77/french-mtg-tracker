import { Activity, Calendar, Target, BookOpen, Github, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_KEY = "frmtg-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return (document.documentElement.dataset.theme as Theme) ?? "light";
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof Activity;
  href: string;
  external?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "suivi", label: "Suivi", icon: Activity, href: "#suivi" },
  { id: "events", label: "Événements", icon: Calendar, href: "#events" },
  { id: "seuils", label: "Seuils", icon: Target, href: "#seuils" },
  { id: "methodo", label: "Méthodologie", icon: BookOpen, href: "#methodo" },
];

export default function Header() {
  const [active, setActive] = useState<string>("suivi");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Applique le thème au <html> + persiste
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Scroll-spy via IntersectionObserver : zéro travail sur scroll event,
  // notification uniquement quand une section entre/sort du viewport.
  useEffect(() => {
    const elements = NAV_ITEMS.map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visibleSections = new Map<string, number>(); // id → intersectionRatio

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleSections.delete(entry.target.id);
          }
        }
        if (visibleSections.size === 0) return;
        // Section avec le plus gros ratio visible = active
        const [activeId] = [...visibleSections.entries()].sort(
          (a, b) => b[1] - a[1],
        )[0];
        setActive(activeId);
      },
      {
        // Ignore les ~120px sous le nav (pas vraiment "vu") et le tiers bas (l'utilisateur lit du haut)
        rootMargin: "-120px 0px -33% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "var(--mana-blue)",
        borderBottom: "1px solid rgba(0,0,0,0.15)",
        boxShadow: "0 2px 12px rgba(14,104,171,0.25)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        {/* LOGO — drapeau FR + nom */}
        <a
          href="#suivi"
          className="flex items-center gap-3 shrink-0"
          style={{ textDecoration: "none" }}
        >
          <span className="flex items-center gap-0.5" style={{ fontSize: "14px" }}>
            <i className="ms ms-cost ms-w" style={{ color: "#fff" }} />
            <i className="ms ms-cost ms-u" style={{ color: "#fff" }} />
            <i className="ms ms-cost ms-b" style={{ color: "#fff" }} />
            <i className="ms ms-cost ms-r" style={{ color: "#fff" }} />
            <i className="ms ms-cost ms-g" style={{ color: "#fff" }} />
          </span>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--fw-bold)",
              fontSize: "1.25rem",
              color: "#fff",
              letterSpacing: "0.02em",
            }}
          >
            French <span style={{ color: "#ffd700" }}>MTG</span> Tracker
          </span>
        </a>

        {/* NAV */}
        <nav aria-label="Sections du site" className="flex items-center gap-2 flex-wrap">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={isActive ? "location" : undefined}
                className="flex items-center gap-2 transition-all"
                style={{
                  padding: "8px 14px",
                  borderRadius: "var(--radius-lg)",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textDecoration: "none",
                  background: isActive
                    ? "var(--gradient-cta-premium)"
                    : "rgba(255,255,255,0.12)",
                  color: isActive ? "#1A1A1A" : "#fff",
                  boxShadow: isActive
                    ? "0 2px 8px rgba(233,181,76,0.4)"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.22)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.12)";
                  }
                }}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </a>
            );
          })}

          {/* Theme toggle — icon-only square button */}
          <button
            type="button"
            aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="flex items-center justify-center transition-all"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              cursor: "pointer",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.22)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.12)")
            }
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* GitHub — toujours à droite, style outline */}
          <a
            href="https://github.com/gbordes77/french-mtg-tracker"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 transition-all"
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-lg)",
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.22)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.12)")
            }
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
