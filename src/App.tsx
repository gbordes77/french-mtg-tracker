import { useEffect, useMemo, useState } from "react";
import { Flag, ExternalLink } from "lucide-react";
import type { EventData, FrenchPlayer, MTGEvent } from "@/lib/types";
import { computeTotalRecord } from "@/lib/helpers";
import Header from "@/components/Header";
import StatBlock from "@/components/StatBlock";
import EventCard from "@/components/EventCard";
import PerformanceRow from "@/components/PerformanceRow";
import ThresholdsBlock from "@/components/ThresholdsBlock";
import MethodologyFooter from "@/components/MethodologyFooter";
import MarketingHero from "@/components/MarketingHero";
import LiveMatchesBlock from "@/components/LiveMatchesBlock";
import ExportCsvButton from "@/components/ExportCsvButton";
import AmpRaceBlock from "@/components/AmpRaceBlock";
import PerformanceCard from "@/components/PerformanceCard";
import { useMediaQuery } from "@/lib/useMediaQuery";

const EMPTY_PLAYERS: FrenchPlayer[] = [];

export default function App() {
  // Switch table desktop ↔ cards mobile à 768px (breakpoint Tailwind md)
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [events, setEvents] = useState<MTGEvent[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/data/events.json", { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Impossible de charger les événements");
        return r.json();
      })
      .then((data: MTGEvent[]) => {
        setEvents(data);
        const live = data.find((e) => e.status === "live");
        setSelectedSlug((live ?? data[0])?.slug ?? null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    const ctrl = new AbortController();
    setEventData(null);
    setEventError(null);
    setEventLoading(true);
    fetch(`/data/${selectedSlug}.json`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Données indisponibles pour ${selectedSlug}`);
        return r.json();
      })
      .then(setEventData)
      .catch((e) => {
        if (e.name !== "AbortError") setEventError(e.message);
      })
      .finally(() => setEventLoading(false));
    return () => ctrl.abort();
  }, [selectedSlug]);

  const event = useMemo(
    () => events.find((e) => e.slug === selectedSlug),
    [events, selectedSlug],
  );

  const players: FrenchPlayer[] = eventData?.frenchPlayers ?? EMPTY_PLAYERS;

  const stats = useMemo(() => {
    if (!event) return { total: 0, active: 0, day2Lock: 0, onPaceTop8: 0 };
    // "Encore en vie" = pas drop ET au moins 1 match gagné
    const active = players.filter(
      (p) => !computeTotalRecord(p).dropped && p.points > 0,
    );
    const day2Lock = players.filter((p) => p.points >= 12).length;
    const onPaceTop8 = players.filter(
      (p) => p.points >= 18 && event.status === "live",
    ).length;
    return {
      total: players.length,
      active: active.length,
      day2Lock,
      onPaceTop8,
    };
  }, [players, event]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen flex items-center justify-center font-mono"
        style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}
      >
        Chargement…
      </div>
    );
  }

  if (error || !event) {
    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center font-mono"
        style={{ color: "var(--fr-red)", fontSize: "0.875rem" }}
      >
        {error ?? "Aucun événement disponible"}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="grain min-h-screen relative">
        <Header />

        {/* MARKETING HERO — calque structure ManaTuner pour cohérence inter-sites */}
        <MarketingHero />

        <div id="suivi" className="max-w-7xl mx-auto px-6 py-10 relative z-10">
          {/* DASHBOARD HERO — event en cours + stats FR */}
          <div className="grid grid-cols-12 gap-6 mb-12">
            <div className="col-span-12 lg:col-span-8">
              {/* Titre avec gradient WUBRG (signature ManaTuner brandbook §3).
                  h2 car le h1 unique de la page est dans MarketingHero. */}
              <h2
                className="fr-hero-title"
                style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
              >
                {event.name}
              </h2>

              <div
                className="mt-6 flex items-baseline gap-6 font-mono flex-wrap"
                style={{ fontSize: "11px", color: "var(--text-secondary)" }}
              >
                <span>{event.location.toUpperCase()}</span>
                <span>{event.dates.toUpperCase()}</span>
                <span>{event.formats.toUpperCase()}</span>
              </div>

              {/* Liens externes vers les sources officielles */}
              <div className="mt-5 flex items-center gap-3 flex-wrap">
                {event.sourceUrl && (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 transition-all"
                    style={{
                      padding: "8px 14px",
                      borderRadius: "var(--radius-lg)",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      background: "rgba(14, 104, 171, 0.10)",
                      color: "var(--mana-blue)",
                      border: "1px solid rgba(14, 104, 171, 0.25)",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "rgba(14, 104, 171, 0.18)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "rgba(14, 104, 171, 0.10)")
                    }
                    aria-label={`Standings officiels sur magic.gg pour ${event.name}`}
                  >
                    <span>Standings</span>
                    <span className="font-mono" style={{ opacity: 0.85 }}>
                      magic.gg
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
                {event.meleeId && (
                  <a
                    href={`https://melee.gg/Tournament/View/${event.meleeId}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 transition-all"
                    style={{
                      padding: "8px 14px",
                      borderRadius: "var(--radius-lg)",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      background: "rgba(0, 115, 62, 0.10)",
                      color: "var(--mana-green)",
                      border: "1px solid rgba(0, 115, 62, 0.25)",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "rgba(0, 115, 62, 0.18)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "rgba(0, 115, 62, 0.10)")
                    }
                    aria-label={`Tournoi melee.gg #${event.meleeId} pour ${event.name}`}
                  >
                    <span>Tournoi</span>
                    <span className="font-mono" style={{ opacity: 0.85 }}>
                      melee.gg
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
                {/* Fact sheet officielle Wizards : prize pool, schedule, format details, seuils. */}
                <a
                  href={`https://magic.gg/events/${event.slug.startsWith("pt-") ? "pro-tour-" + event.slug.slice(3) : event.slug}-fact-sheet-for-competitors`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 transition-all"
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--radius-lg)",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    background: "rgba(233, 181, 76, 0.12)",
                    color: "#8a6500",
                    border: "1px solid rgba(233, 181, 76, 0.30)",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "rgba(233, 181, 76, 0.22)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "rgba(233, 181, 76, 0.12)")
                  }
                  aria-label={`Fact sheet officielle ${event.name} (prize pool, schedule, formats)`}
                >
                  <span>Fact sheet</span>
                  <span className="font-mono" style={{ opacity: 0.85 }}>
                    ${event.purse.toLocaleString()}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 justify-end">
              <div className="grid grid-cols-2 gap-3">
                <StatBlock
                  label="Engagés FR"
                  value={stats.total}
                  sub={event.field ? `sur ${event.field}` : undefined}
                  highlightFr
                  hint="Joueurs identifiés comme français dans le tournoi (cf. méthodologie en bas de page)"
                />
                <StatBlock
                  label="Toujours en course"
                  value={stats.active}
                  sub={
                    stats.total > 0
                      ? `${((stats.active / stats.total) * 100).toFixed(0)}% du roster`
                      : "—"
                  }
                  hint="Français qui n'ont pas dropé (= abandonné) et qui ont au moins 1 match gagné. Mis à jour automatiquement après chaque ronde (refresh toutes les 5 min depuis melee.gg)."
                />
                <StatBlock
                  label="Day 2 acquis"
                  value={stats.day2Lock}
                  sub="≥ 12 pts (officiel)"
                  hint="Day 2 = passage au lendemain. À partir de 12 points (= 4 victoires) à la fin du Day 1, le joueur est qualifié pour la deuxième journée du Pro Tour."
                />
                <StatBlock
                  label="Sur rythme Top 8"
                  value={stats.onPaceTop8}
                  sub="≥ 18 pts à R8"
                  hint="Le cut Top 8 d'un PT est généralement à 36 points (12 victoires sur 16 rondes). Pour rester sur ce rythme, il faut au minimum 18 pts à mi-tournoi (R8)."
                />
              </div>
            </div>
          </div>

          {/* LIVE MATCHES — affiché si la ronde en cours a des matchs FR */}
          {!eventLoading && !eventError && eventData?.liveRound && eventData?.liveMatches && eventData.liveMatches.length > 0 && (
            <LiveMatchesBlock
              liveRound={eventData.liveRound}
              matches={eventData.liveMatches}
              scrapedAt={eventData.scrapedAt}
            />
          )}


          {/* ROSTER TABLE */}
          {eventLoading && (
            <div
              role="status"
              aria-live="polite"
              className="ds-card p-12 text-center font-mono"
              style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}
            >
              Chargement des données…
            </div>
          )}
          {!eventLoading && eventError && (
            <div
              role="alert"
              className="ds-card p-12 text-center font-mono"
              style={{ fontSize: "0.875rem", color: "var(--fr-red)" }}
            >
              {eventError}
            </div>
          )}
          {!eventLoading && !eventError && players.length > 0 ? (
            <>
              <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                <h3
                  className="italic"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--fw-medium)",
                    fontSize: "2rem",
                    color: "var(--text-primary)",
                  }}
                >
                  La délégation
                </h3>
                <div
                  className="font-mono flex items-center gap-3 flex-wrap"
                  style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Flag className="w-3 h-3" />
                    Mise à jour : R{event.currentRound}
                    {event.status === "live" && " · auto-refresh 5 min"}
                  </span>
                  {eventData && (
                    <ExportCsvButton event={eventData} slug={selectedSlug ?? "event"} />
                  )}
                </div>
              </div>

              {isMobile ? (
                <div className="flex flex-col gap-3">
                  {players.map((p) => (
                    <PerformanceCard
                      key={`${p.last}|${p.first}|${p.rank}`}
                      player={p}
                      event={event}
                    />
                  ))}
                </div>
              ) : (
              <div className="ds-card overflow-x-auto" style={{ padding: 0 }}>
                <table className="w-full min-w-[1100px]">
                  <caption className="sr-only">
                    Performances des joueurs français à {event.name}, ronde{" "}
                    {event.currentRound} sur {event.totalRounds}.
                  </caption>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                      {([
                        ["Rang", "Position au standings global du tournoi"],
                        ["Joueur", undefined],
                        ["Archétype", "Cliquer pour voir la decklist sur melee.gg"],
                        ["Limited", undefined],
                        ["Construit", undefined],
                        ["Total", "Match Points + tiebreakers (OMW : Opponent Match Win %, plus c'est haut mieux c'est)"],
                        ["Statut · Source", "Statut = projection (Top 8 / requalif / hors course). Source = origine de l'invitation (RC EMEA, 39+ AMP, Worlds Top 8…)"],
                      ] as Array<[string, string | undefined]>).map(([h, hint], idx) => (
                        <th
                          key={h}
                          scope="col"
                          className="font-mono uppercase font-normal text-left"
                          title={hint}
                          style={{
                            padding: "12px",
                            paddingLeft: idx === 0 ? "1.5rem" : "12px",
                            paddingRight: idx === 6 ? "1.5rem" : "12px",
                            fontSize: "10px",
                            letterSpacing: "0.2em",
                            color: "var(--text-secondary)",
                            opacity: 0.7,
                            textAlign: idx === 5 ? "right" : "left",
                            cursor: hint ? "help" : "default",
                            textDecoration: hint ? "underline dotted" : "none",
                            textUnderlineOffset: "3px",
                            textDecorationThickness: "1px",
                          }}
                        >
                          {h === "Limited" ? (
                            <>
                              <div>Limited</div>
                              <div
                                style={{
                                  fontSize: "9px",
                                  textTransform: "none",
                                  letterSpacing: "normal",
                                  marginTop: "2px",
                                  opacity: 0.7,
                                }}
                              >
                                Draft · 3 rondes/jour
                              </div>
                            </>
                          ) : h === "Construit" ? (
                            <>
                              <div>Construit</div>
                              <div
                                style={{
                                  fontSize: "9px",
                                  textTransform: "none",
                                  letterSpacing: "normal",
                                  marginTop: "2px",
                                  opacity: 0.7,
                                }}
                              >
                                Standard · 5 rondes/jour
                              </div>
                            </>
                          ) : (
                            h
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, i) => (
                      <PerformanceRow
                        key={`${p.last}|${p.first}|${p.rank}`}
                        player={p}
                        event={event}
                        isFirst={i === 0}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          ) : !eventLoading && !eventError ? (
            <div className="ds-card p-12 text-center">
              <div
                className="font-mono"
                style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}
              >
                {event.status === "upcoming"
                  ? "Aucune donnée disponible — événement à venir"
                  : "Aucun joueur français identifié à ce stade"}
              </div>
            </div>
          ) : null}

          {/* FOOTER */}
          <div
            className="mt-16 pt-8"
            style={{ borderTop: "1px solid var(--glass-border)" }}
          >
            <div id="seuils">
              <ThresholdsBlock />
            </div>

            {/* COURSE AUX 39+ AMP — total projeté = baseline magic.gg + live.
                Charge public/data/amp.json (généré par scrape_amp.py). */}
            {!eventLoading && !eventError && players.length > 0 && event.status === "live" && (
              <div id="amp">
                <AmpRaceBlock players={players} />
              </div>
            )}

            {/* À VENIR — uniquement les événements upcoming */}
            {events.some((e) => e.status === "upcoming") && (
              <section id="events" className="mb-12">
                <h3
                  className="italic mb-4"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--fw-medium)",
                    fontSize: "1.5rem",
                    color: "var(--text-primary)",
                  }}
                >
                  À venir
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {events
                    .filter((e) => e.status === "upcoming")
                    .map((e) => (
                      <EventCard
                        key={e.slug}
                        event={e}
                        active={e.slug === selectedSlug}
                        onClick={() => setSelectedSlug(e.slug)}
                      />
                    ))}
                </div>
              </section>
            )}

            <div id="methodo">
              <MethodologyFooter event={event} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
