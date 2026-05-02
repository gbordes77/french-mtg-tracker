import { useEffect, useMemo, useState } from "react";
import { Trophy, ExternalLink, HelpCircle, Check } from "lucide-react";
import type { AmpData, FrenchPlayer } from "@/lib/types";

interface Props {
  players: FrenchPlayer[];
}

const TARGET_AMP = 39;
const AMP_FLOOR = 9; // pts en deçà desquels un PT ne donne pas d'AMP
// Colonne magic.gg utilisée comme baseline pré-PT en cours.
// "Post PT MSH Total" = total cumulé sur les 3 PT précédant Strixhaven.
const BASELINE_KEY = "Post PT MSH Total";

interface Row {
  player: FrenchPlayer;
  baseline: number | null;   // AMP cumulés magic.gg (snapshot avant PT en cours)
  liveAmp: number;           // AMP gagnés au PT en cours
  total: number;             // baseline + live (null baseline → live seul)
  hasBaseline: boolean;
}

function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s*,\s*/g, ", ");
}

/**
 * Course aux 39+ AMP — TOTAL projeté (snapshot magic.gg + contribution live).
 *
 * Charge public/data/amp.json (généré par scrape_amp.py depuis
 * magic.gg/standings/pro-tour-adjusted-match-points). Match les Français
 * par "Last, First", calcule le total projeté = baseline magic.gg +
 * live AMP gagnés au PT en cours.
 *
 * AMP = max(0, match_points - 9). 39+ AMP cumulés sur 3 PT = invitation auto.
 */
export default function AmpRaceBlock({ players }: Props) {
  const [ampData, setAmpData] = useState<AmpData | null>(null);
  // Visible par défaut — l'utilisateur ne devrait pas avoir à cliquer le ⓘ
  // pour comprendre comment les AMP marchent. Le ⓘ permet de replier si besoin.
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    fetch("/data/amp.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setAmpData)
      .catch(() => setAmpData(null));
  }, []);

  const rows = useMemo<Row[]>(() => {
    const baselineByName: Record<string, number | null> = {};
    if (ampData?.players) {
      for (const p of ampData.players) {
        const key = normalize(`${p["Last Name"]}, ${p["First Name"]}`);
        const v = p[BASELINE_KEY];
        baselineByName[key] = typeof v === "number" ? v : null;
      }
    }

    return players
      .map<Row>((p) => {
        const key = normalize(`${p.last}, ${p.first}`);
        const baseline = baselineByName[key];
        const baselineNum =
          typeof baseline === "number" && baseline > 0 ? baseline : null;
        const liveAmp = Math.max(0, p.points - AMP_FLOOR);
        return {
          player: p,
          baseline: baselineNum,
          liveAmp,
          total: (baselineNum ?? 0) + liveAmp,
          hasBaseline: baselineNum !== null,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [players, ampData]);

  const top = rows[0];
  const onPace = rows.filter((r) => r.total >= TARGET_AMP).length;

  return (
    <section className="mb-10">
      <div
        className="ds-card p-6"
        style={{
          borderRadius: "var(--radius-lg)",
          background:
            "linear-gradient(135deg, rgba(233,181,76,0.10) 0%, rgba(211,32,42,0.06) 100%), var(--surface-paper)",
          borderLeft: "3px solid var(--mana-multicolor)",
        }}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
          <h3
            className="flex items-center gap-2"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--fw-medium)",
              fontSize: "1.5rem",
              color: "var(--text-primary)",
              fontStyle: "italic",
            }}
          >
            <Trophy
              className="w-5 h-5"
              style={{ color: "var(--mana-multicolor)" }}
              aria-hidden="true"
            />
            Course aux {TARGET_AMP}+ AMP
            <button
              type="button"
              onClick={() => setShowHelp((s) => !s)}
              aria-label="Comment les AMP sont-ils calculés ?"
              aria-expanded={showHelp}
              className="inline-flex items-center justify-center transition-all"
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: "1px solid var(--text-secondary)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                marginLeft: "4px",
              }}
              title="Comment les AMP sont calculés"
            >
              <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </h3>
          <div
            className="font-mono"
            style={{ fontSize: "11px", color: "var(--text-secondary)" }}
          >
            {onPace > 0 ? (
              <span style={{ color: "var(--mana-green)", fontWeight: 700 }}>
                {onPace} FR ≥ 39 AMP projetés ✓
              </span>
            ) : (
              <span>Personne n'a encore atteint 39 AMP projetés</span>
            )}
          </div>
        </div>

        {/* Help panel — replié par défaut */}
        {showHelp && (
          <div
            className="mt-3 mb-4 p-4"
            style={{
              background: "var(--glass-secondary)",
              borderRadius: "var(--radius-lg)",
              fontSize: "0.875rem",
              lineHeight: 1.65,
              color: "var(--text-secondary)",
            }}
          >
            <div
              className="font-mono uppercase mb-3"
              style={{
                fontSize: "10px",
                letterSpacing: "0.25em",
                color: "var(--text-primary)",
              }}
            >
              Comment fonctionnent les AMP
            </div>

            <p>
              <strong style={{ color: "var(--text-primary)" }}>
                AMP = Adjusted Match Points
              </strong>{" "}
              = les <strong>points marqués au PT au-delà des 9 premiers</strong>.
              Au-delà de 3 victoires, chaque victoire en plus ={" "}
              <strong style={{ color: "var(--mana-multicolor)" }}>+3 AMP</strong>.
            </p>

            <AmpScale />

            <p
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginTop: "0.5rem",
              }}
            >
              + Bonus Top 8 atteint :{" "}
              <strong style={{ color: "var(--mana-multicolor)" }}>+12 AMP</strong>{" "}
              (ou compense pour atteindre 39 si en dessous).
            </p>

            <p>
              <strong style={{ color: "var(--text-primary)" }}>
                Règle officielle Wizards
              </strong>{" "}
              : un joueur qui cumule{" "}
              <strong style={{ color: "var(--mana-multicolor)" }}>
                39+ AMP sur les 3 derniers PT
              </strong>{" "}
              obtient une invitation auto au prochain PT — sans devoir Top 8 ou
              re-qualifier via 10-6. Le Top 8 ajoute aussi un bonus de +12 AMP
              (ou compense pour atteindre 39 si en dessous).
            </p>

            <p className="mt-2">
              <strong style={{ color: "var(--text-primary)" }}>
                Total projeté ici
              </strong>{" "}
              = cumul officiel{" "}
              <a
                href="https://magic.gg/standings/pro-tour-adjusted-match-points"
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: "var(--text-primary)" }}
              >
                magic.gg
              </a>{" "}
              ({ampData?.lastUpdated ?? "—"}) <strong>+</strong> AMP gagnés au PT
              en cours (calculés depuis les standings live melee.gg).{" "}
              <em>Bonus Top 8 non inclus dans la projection.</em>
            </p>

            <p
              className="mt-3 pt-3 font-mono"
              style={{
                fontSize: "11px",
                borderTop: "1px solid var(--glass-border)",
              }}
            >
              📄 Sources officielles ·{" "}
              <a
                href="https://assets.ctfassets.net/ryplwhabvmmk/6YDZEeJXf70PuKG103ohdH/d5a55e0ac4aea87d0fcb21069f93b8a6/MTG_PTIP-2425_2024-09-27.pdf"
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: "var(--mana-blue)" }}
              >
                Premier Tournament Invitation Policy (PDF Wizards)
              </a>{" "}
              ·{" "}
              <a
                href="https://magic.gg/standings/pro-tour-adjusted-match-points"
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: "var(--mana-blue)" }}
              >
                Classement AMP magic.gg
              </a>
            </p>
          </div>
        )}

        {/* Liste des FR */}
        {rows.length === 0 ? (
          <p
            className="font-mono text-center py-6"
            style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}
          >
            Pas de données AMP pour les Français du PT en cours.
          </p>
        ) : (
          <div className="space-y-1.5 mt-4">
            {rows.map((r) => (
              <AmpRow
                key={`${r.player.last}-${r.player.first}`}
                row={r}
                isTop={r === top}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          className="mt-5 pt-4 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderTop: "1px solid var(--glass-border)" }}
        >
          <p
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--text-secondary)",
              opacity: 0.75,
            }}
          >
            Baseline magic.gg ·{" "}
            {ampData?.lastUpdated ?? "données indisponibles"}
          </p>
          <a
            href="https://magic.gg/standings/pro-tour-adjusted-match-points"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 transition-all"
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-lg)",
              fontFamily: "var(--font-body)",
              fontSize: "0.8rem",
              fontWeight: 600,
              textDecoration: "none",
              background: "rgba(233,181,76,0.15)",
              color: "#8a6500",
              border: "1px solid rgba(233,181,76,0.4)",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(233,181,76,0.25)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(233,181,76,0.15)")
            }
          >
            <span>Classement officiel</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * Frise visuelle de progression des AMP en fonction des victoires au PT.
 *
 * Affiche une barre horizontale 3v → 16v (= score parfait) avec :
 * - couleur progressive grise → gold → vert (= seuil 39 atteint)
 * - markers verticaux + labels pour les milestones (Day 2, Top 8 pace,
 *   Re-qualif, Top 8 typique, 39 AMP target)
 * - axes : victoires en haut, AMP en bas
 */
function AmpScale() {
  // 10 paliers Swiss : 3v à 12v (= cut Top 8 typique). Au-delà de 12v c'est
  // rare en pratique — les joueurs lockés Top 8 ID (intentional draw) leurs
  // dernières rondes. Le saut de 27 → 39 AMP se fait via le bonus Top 8.
  const steps = [
    { wins: 3,  amp: 0,  label: null },
    { wins: 4,  amp: 3,  label: "Day 2" },
    { wins: 5,  amp: 6,  label: null },
    { wins: 6,  amp: 9,  label: null },
    { wins: 7,  amp: 12, label: "Top 8 pace" },
    { wins: 8,  amp: 15, label: null },
    { wins: 9,  amp: 18, label: null },
    { wins: 10, amp: 21, label: "Re-qualif" },
    { wins: 11, amp: 24, label: null },
    { wins: 12, amp: 27, label: "Top 8 cut" },
  ];

  return (
    <div className="my-4">
      {/* Barre principale Swiss (3v→12v) + bonus Top 8 visuellement séparé.
          Layout : 10 segments Swiss (proportion 10/12) puis 2 segments de
          "bonus Top 8" en vert qui font sauter à 39 AMP. */}
      <div
        className="grid relative"
        style={{
          gridTemplateColumns: `repeat(10, minmax(0,1fr)) 4px repeat(2, minmax(0,1fr))`,
          height: "32px",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {/* Segments Swiss : gris → bleu → gold */}
        {steps.map((s, i) => {
          const ratio = s.amp / 27; // normalisé sur la zone Swiss [0..27]
          let bg: string;
          if (s.amp === 0) bg = "var(--mana-colorless)";
          else if (s.amp < 12)
            bg = `color-mix(in srgb, var(--mana-colorless) ${(1 - ratio * 1.5) * 100}%, var(--mana-blue))`;
          else
            bg = `color-mix(in srgb, var(--mana-blue) ${(1 - (ratio - 0.44) * 1.78) * 100}%, var(--mana-multicolor))`;
          return (
            <div
              key={`bar-${s.wins}`}
              className="flex items-center justify-center font-mono tabular-nums"
              style={{
                fontSize: "11px",
                fontWeight: s.label ? 700 : 500,
                color: s.amp === 0 ? "var(--text-secondary)" : "var(--mana-black)",
                background: bg,
                borderRight:
                  i < steps.length - 1
                    ? "1px solid rgba(255,255,255,0.25)"
                    : "none",
              }}
              title={`${s.wins} victoires (${s.wins * 3} pts) → ${s.amp} AMP`}
            >
              {s.amp}
            </div>
          );
        })}

        {/* Gap visuel séparant Swiss du bonus */}
        <div
          aria-hidden="true"
          style={{ background: "var(--surface-paper)" }}
        />

        {/* Bonus Top 8 : 2 segments en vert mana */}
        <div
          className="flex items-center justify-center font-mono tabular-nums"
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#fff",
            background: "var(--mana-green)",
            borderRight: "1px solid rgba(255,255,255,0.25)",
          }}
          title="Bonus Top 8 atteint : +12 AMP supplémentaires"
        >
          +12
        </div>
        <div
          className="flex items-center justify-center font-mono tabular-nums"
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#fff",
            background: "var(--mana-green)",
          }}
          title="Total minimum garanti après Top 8 : 39 AMP"
        >
          = 39 ✓
        </div>
      </div>

      {/* Bottom axis : nombre de victoires sous chaque segment Swiss + label "si Top 8" */}
      <div
        className="grid mt-1"
        style={{
          gridTemplateColumns: `repeat(10, minmax(0,1fr)) 4px repeat(2, minmax(0,1fr))`,
        }}
      >
        {steps.map((s) => (
          <div
            key={`bot-${s.wins}`}
            className="font-mono text-center"
            style={{
              fontSize: "9px",
              color: "var(--text-secondary)",
              opacity: 0.85,
              letterSpacing: "0.05em",
            }}
          >
            {s.wins}v
          </div>
        ))}
        <div aria-hidden="true" />
        <div
          className="font-mono text-center"
          style={{
            gridColumn: "span 2",
            fontSize: "9px",
            color: "var(--mana-green)",
            opacity: 0.85,
            letterSpacing: "0.05em",
            fontStyle: "italic",
          }}
        >
          si Top 8 atteint
        </div>
      </div>

      {/* Légende axes */}
      <div
        className="flex justify-between mt-2 font-mono uppercase"
        style={{
          fontSize: "9px",
          letterSpacing: "0.2em",
          color: "var(--text-secondary)",
          opacity: 0.6,
        }}
      >
        <span>← AMP gagnés</span>
        <span>victoires au PT →</span>
      </div>
    </div>
  );
}


function AmpRow({ row, isTop }: { row: Row; isTop: boolean }) {
  const { player, baseline, liveAmp, total, hasBaseline } = row;
  const reached = total >= TARGET_AMP;
  const widthPct = Math.min(100, (total / TARGET_AMP) * 100);

  const totalColor = reached
    ? "var(--mana-green)"
    : isTop
      ? "var(--mana-multicolor)"
      : "var(--text-primary)";

  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: "10px 12px",
        background: reached
          ? "rgba(0,115,62,0.08)"
          : isTop
            ? "rgba(233,181,76,0.08)"
            : "var(--glass-secondary)",
        borderRadius: "var(--radius-lg)",
        border: reached
          ? "1px solid rgba(0,115,62,0.35)"
          : isTop
            ? "1px solid rgba(233,181,76,0.3)"
            : "1px solid transparent",
      }}
    >
      {/* Joueur */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "9px",
              letterSpacing: "0.1em",
              color: "var(--text-secondary)",
              opacity: 0.85,
            }}
          >
            {player.first}
          </span>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1rem",
              fontWeight: "var(--fw-semibold)",
              color: "var(--text-primary)",
            }}
          >
            {player.last}
          </span>
          {reached && (
            <Check
              className="w-4 h-4"
              style={{ color: "var(--mana-green)" }}
              aria-label="Seuil 39 AMP atteint"
            />
          )}
        </div>
      </div>

      {/* Detail breakdown — caché sur mobile */}
      <div
        className="hidden md:flex items-center gap-2 font-mono tabular-nums"
        style={{
          fontSize: "11px",
          color: "var(--text-secondary)",
          minWidth: "140px",
          justifyContent: "flex-end",
        }}
      >
        {hasBaseline ? (
          <>
            <span title={`Cumul magic.gg avant ce PT (${BASELINE_KEY})`}>
              {baseline}
            </span>
            <span style={{ opacity: 0.5 }}>+</span>
            <span
              title="AMP gagnés au PT en cours"
              style={{ color: "var(--mana-multicolor)", fontWeight: 600 }}
            >
              {liveAmp}
            </span>
            <span style={{ opacity: 0.5 }}>=</span>
          </>
        ) : (
          <span
            style={{ opacity: 0.6 }}
            title="Ce joueur n'apparaît pas dans le classement AMP magic.gg (nouveau qualifié)"
          >
            live·
          </span>
        )}
      </div>

      {/* Barre + total */}
      <div
        className="hidden sm:block"
        style={{
          flex: "0 1 120px",
          height: "6px",
          background: "var(--glass-border)",
          borderRadius: "var(--radius-full)",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <div
          style={{
            width: `${widthPct}%`,
            height: "100%",
            background: reached
              ? "var(--mana-green)"
              : isTop
                ? "var(--gradient-cta-premium)"
                : "var(--mana-multicolor)",
            transition: "width 0.4s ease-out",
          }}
        />
      </div>

      <div
        className="tabular-nums font-mono shrink-0 text-right"
        style={{
          minWidth: "60px",
          fontSize: "1.125rem",
          fontWeight: 700,
          color: totalColor,
        }}
      >
        {total}
        <span
          className="ml-1"
          style={{
            fontSize: "9px",
            fontWeight: 500,
            color: "var(--text-secondary)",
            letterSpacing: "0.1em",
          }}
        >
          AMP
        </span>
      </div>
    </div>
  );
}
