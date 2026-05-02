import { ArrowDown, Github, Activity, BookOpen, Code2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Marketing hero — calque la structure ManaTuner pour cohérence visuelle :
 * mana symbols centrés → H1 gradient WUBRG → tagline → chips → CTA gold
 * → tagline italique de séparation.
 *
 * Sert d'intro avant le dashboard data ; visible uniquement à l'arrivée
 * sur la page (le nav "Suivi" scrolle directement vers #suivi qui est le
 * dashboard, le user peut donc bypass cette intro).
 */
export default function MarketingHero() {
  return (
    <section id="hero" className="relative">
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
        {/* 5 mana symbols WUBRG */}
        <div
          className="flex items-center justify-center gap-3 mb-8"
          style={{ fontSize: "1.75rem" }}
        >
          <i className="ms ms-cost ms-w" />
          <i className="ms ms-cost ms-u" />
          <i className="ms ms-cost ms-b" />
          <i className="ms ms-cost ms-r" />
          <i className="ms ms-cost ms-g" />
        </div>

        {/* H1 gradient WUBRG → FR red */}
        <h1
          className="fr-hero-title mb-6"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            lineHeight: 1.05,
          }}
        >
          Les Français au Pro Tour
        </h1>

        {/* Tagline */}
        <p
          className="max-w-2xl mx-auto mb-3"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "1.125rem",
            lineHeight: 1.6,
            color: "var(--text-primary)",
          }}
        >
          Suivi des performances françaises aux{" "}
          <strong>Pro Tours</strong>, <strong>Worlds</strong>,{" "}
          <strong>Magic Spotlight</strong> et{" "}
          <strong>Regional Championships EMEA</strong>.
        </p>

        {/* Liste compacte des événements suivis */}
        <p
          className="font-mono mb-8"
          style={{
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            letterSpacing: "0.05em",
          }}
        >
          Pro Tour · World Championship · Magic Spotlight Series · Arena Championship · RC EMEA
        </p>

        {/* 3 chips style ManaTuner — soft pastel bg, lucide icons */}
        <div className="flex items-center justify-center gap-3 flex-wrap mb-10">
          <Chip
            icon={Activity}
            label="Stats live"
            color="var(--mana-blue)"
            bg="rgba(14,104,171,0.12)"
          />
          <Chip
            icon={BookOpen}
            label="Méthodologie publique"
            color="var(--mana-green)"
            bg="rgba(0,115,62,0.12)"
          />
          <Chip
            icon={Code2}
            label="Open source"
            color="#9c27b0"
            bg="rgba(156,39,176,0.12)"
          />
        </div>

        {/* CTA gold (Tier 1 ManaTuner) */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href="#suivi"
            className="ds-btn ds-btn--premium inline-flex items-center gap-2"
            style={{ padding: "14px 28px", fontSize: "1rem" }}
          >
            <ArrowDown className="w-5 h-5" />
            <span>Voir le PT en cours</span>
          </a>

          {/* CTA secondaire knowledge (Tier 2) */}
          <a
            href="https://github.com/gbordes77/french-mtg-tracker"
            target="_blank"
            rel="noreferrer"
            className="ds-btn ds-btn--knowledge inline-flex items-center gap-2"
            style={{ padding: "14px 28px", fontSize: "1rem" }}
          >
            <Github className="w-5 h-5" />
            <span>Voir le code source</span>
          </a>
        </div>

        {/* Small print sous CTA (analog ManaTuner) */}
        <p
          className="mt-6 max-w-xl mx-auto"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          <strong>Gratuit</strong>. Pas d'inscription. Données scrapées toutes les 30 min depuis{" "}
          <span className="font-mono" style={{ fontSize: "0.85rem" }}>
            magic.gg
          </span>{" "}
          pendant les événements live.
        </p>

        {/* Tagline éditoriale italic large (signature ManaTuner brandbook §3) */}
        <div
          className="mt-16 pt-10"
          style={{ borderTop: "1px solid var(--glass-border)" }}
        >
          <p
            className="italic max-w-3xl mx-auto"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(1rem, 2vw, 1.4rem)",
              color: "var(--text-secondary)",
              fontWeight: 500,
              letterSpacing: "0.01em",
            }}
          >
            Les standings disent qui gagne. Le tracker dit qui est français.
          </p>
        </div>
      </div>
    </section>
  );
}

interface ChipProps {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
}

function Chip({ icon: Icon, label, color, bg }: ChipProps) {
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{
        background: bg,
        color,
        borderRadius: "var(--radius-full)",
        padding: "8px 18px",
        fontSize: "0.875rem",
        fontWeight: 600,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </span>
  );
}
