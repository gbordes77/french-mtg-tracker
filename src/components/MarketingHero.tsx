/**
 * Hero — version épurée : 5 mana symbols, H1 gradient WUBRG, tagline
 * principale, liste compacte des events. Pas de chips, pas de CTA, pas de
 * tagline éditoriale — la data parle pour elle-même.
 */
export default function MarketingHero() {
  return (
    <section id="hero" className="relative">
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-20 text-center">
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

        {/* H1 gradient WUBRG canon */}
        <h1
          className="fr-hero-title mb-6"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            lineHeight: 1.05,
          }}
        >
          Les Français au Pro Tour
        </h1>

        {/* Tagline principale */}
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
          className="font-mono"
          style={{
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            letterSpacing: "0.05em",
          }}
        >
          Pro Tour · World Championship · Magic Spotlight Series · Arena Championship · RC EMEA
        </p>
      </div>
    </section>
  );
}
