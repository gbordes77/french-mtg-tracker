import { useEffect, useMemo, useState } from "react";
import { Flag } from "lucide-react";
import type { EventData, FrenchPlayer, MTGEvent } from "@/lib/types";
import Header from "@/components/Header";
import StatusPill from "@/components/StatusPill";
import StatBlock from "@/components/StatBlock";
import EventCard from "@/components/EventCard";
import PerformanceRow from "@/components/PerformanceRow";
import ThresholdsBlock from "@/components/ThresholdsBlock";
import MethodologyFooter from "@/components/MethodologyFooter";

export default function App() {
  const [events, setEvents] = useState<MTGEvent[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/events.json")
      .then((r) => {
        if (!r.ok) throw new Error("Impossible de charger les événements");
        return r.json();
      })
      .then((data: MTGEvent[]) => {
        setEvents(data);
        const live = data.find((e) => e.status === "live");
        setSelectedSlug((live ?? data[0])?.slug ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    setEventData(null);
    fetch(`/data/${selectedSlug}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Données indisponibles pour ${selectedSlug}`);
        return r.json();
      })
      .then(setEventData)
      .catch((e) => setError(e.message));
  }, [selectedSlug]);

  const event = useMemo(
    () => events.find((e) => e.slug === selectedSlug),
    [events, selectedSlug],
  );

  const players: FrenchPlayer[] = eventData?.frenchPlayers ?? [];

  const stats = useMemo(() => {
    if (!event) return { total: 0, active: 0, day2Lock: 0, onPaceTop8: 0 };
    const active = players.filter((p) => p.points > 0);
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

        <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
          {/* HERO */}
          <div className="grid grid-cols-12 gap-6 mb-12">
            <div className="col-span-12 lg:col-span-8">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <StatusPill status={event.status} />
                <span
                  className="font-mono"
                  style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                >
                  Round {event.currentRound} / {event.totalRounds}
                </span>
                {event.field && (
                  <span
                    className="font-mono"
                    style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                  >
                    {event.field} joueurs · ${event.purse.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Titre avec gradient WUBRG (signature ManaTuner brandbook §3) */}
              <h1
                className="fr-hero-title"
                style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
              >
                {event.name}
              </h1>

              <div
                className="mt-6 flex items-baseline gap-6 font-mono flex-wrap"
                style={{ fontSize: "11px", color: "var(--text-secondary)" }}
              >
                <span>{event.location.toUpperCase()}</span>
                <span>{event.dates.toUpperCase()}</span>
                <span>{event.formats.toUpperCase()}</span>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 justify-end">
              <div className="grid grid-cols-2 gap-3">
                <StatBlock
                  label="Engagés FR"
                  value={stats.total}
                  sub={event.field ? `sur ${event.field}` : undefined}
                  highlightFr
                />
                <StatBlock
                  label="Encore en vie"
                  value={stats.active}
                  sub={
                    stats.total > 0
                      ? `${((stats.active / stats.total) * 100).toFixed(0)}% du roster`
                      : "—"
                  }
                />
                <StatBlock
                  label="Day 2 acquis"
                  value={stats.day2Lock}
                  sub="≥ 12 pts (officiel)"
                />
                <StatBlock
                  label="Sur rythme Top 8"
                  value={stats.onPaceTop8}
                  sub="≥ 18 pts à R8"
                />
              </div>
            </div>
          </div>

          {/* EVENT SELECTOR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {events.map((e) => (
              <EventCard
                key={e.slug}
                event={e}
                active={e.slug === selectedSlug}
                onClick={() => setSelectedSlug(e.slug)}
              />
            ))}
          </div>

          {/* ROSTER TABLE */}
          {players.length > 0 ? (
            <>
              <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                <h2
                  className="italic"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--fw-medium)",
                    fontSize: "2rem",
                    color: "var(--text-primary)",
                  }}
                >
                  La délégation
                </h2>
                <div
                  className="font-mono flex items-center gap-2"
                  style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                >
                  <Flag className="w-3 h-3" />
                  Mise à jour : R{event.currentRound}{" "}
                  {event.status === "live" && "· auto-refresh 5min"}
                </div>
              </div>

              <div className="ds-card overflow-x-auto" style={{ padding: 0 }}>
                <table className="w-full min-w-[1100px]">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                      {[
                        "Rang",
                        "Joueur",
                        "Archétype",
                        "Limited",
                        "Construit",
                        "Total",
                        "Statut · Source",
                      ].map((h, idx) => (
                        <th
                          key={h}
                          className="font-mono uppercase font-normal text-left"
                          style={{
                            padding: "12px",
                            paddingLeft: idx === 0 ? "1.5rem" : "12px",
                            paddingRight: idx === 6 ? "1.5rem" : "12px",
                            fontSize: "10px",
                            letterSpacing: "0.2em",
                            color: "var(--text-secondary)",
                            opacity: 0.7,
                            textAlign: idx === 5 ? "right" : "left",
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
                        key={`${p.first}-${p.last}`}
                        player={p}
                        event={event}
                        isFirst={i === 0}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
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
          )}

          {/* FOOTER */}
          <div
            className="mt-16 pt-8"
            style={{ borderTop: "1px solid var(--glass-border)" }}
          >
            <ThresholdsBlock />
            <MethodologyFooter event={event} />
          </div>
        </div>
      </div>
    </div>
  );
}
