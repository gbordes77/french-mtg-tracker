import { Download } from "lucide-react";
import type { EventData } from "@/lib/types";

interface Props {
  event: EventData;
  slug: string;
}

const COLUMNS: Array<{ key: string; header: string; accessor: (p: any) => unknown }> = [
  { key: "rank", header: "Rang", accessor: (p) => p.rank },
  { key: "first", header: "Prénom", accessor: (p) => p.first },
  { key: "last", header: "Nom", accessor: (p) => p.last },
  { key: "points", header: "Points", accessor: (p) => p.points },
  { key: "matchRecord", header: "Match Record", accessor: (p) => p.matchRecord ?? "" },
  { key: "gameRecord", header: "Game Record", accessor: (p) => p.gameRecord ?? "" },
  { key: "omw", header: "OMW", accessor: (p) => p.omw ?? "" },
  { key: "gw", header: "GW", accessor: (p) => p.gw ?? "" },
  { key: "ogw", header: "OGW", accessor: (p) => p.ogw ?? "" },
  { key: "archetype", header: "Archetype", accessor: (p) => p.archetype ?? "" },
  { key: "decklistUrl", header: "Decklist URL", accessor: (p) => p.decklistUrl ?? "" },
  { key: "draftD1", header: "Draft D1", accessor: (p) => p.draftD1 ?? "" },
  { key: "standardD1", header: "Standard D1", accessor: (p) => p.standardD1 ?? "" },
  { key: "draftD2", header: "Draft D2", accessor: (p) => p.draftD2 ?? "" },
  { key: "standardD2", header: "Standard D2", accessor: (p) => p.standardD2 ?? "" },
  { key: "source", header: "Source invitation", accessor: (p) => p.source ?? "" },
  { key: "rcOrigin", header: "RC Origin", accessor: (p) => p.rcOrigin ?? "" },
  { key: "twitter", header: "Twitter", accessor: (p) => p.twitter ?? "" },
];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // RFC 4180 : si la cellule contient virgule, guillemet ou retour ligne,
  // on l'entoure de guillemets et on double les guillemets internes.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(event: EventData): string {
  const headers = COLUMNS.map((c) => c.header);
  const rows = event.frenchPlayers.map((p) =>
    COLUMNS.map((c) => escapeCSV(c.accessor(p))).join(","),
  );
  // BOM UTF-8 pour qu'Excel affiche correctement les diacritiques (é, è, ô…)
  return "﻿" + [headers.join(","), ...rows].join("\r\n");
}

/**
 * Bouton Export CSV — génère un CSV plat des Français du PT en cours.
 * Compatible Excel/Sheets/Notion (BOM UTF-8 + RFC 4180).
 *
 * Cas d'usage Karim/Natsuki : pousser dans un Sheet de prep RC, ou dans
 * Notion team-testing en 1 clic, sans script ni copier-coller manuel.
 */
export default function ExportCsvButton({ event, slug }: Props) {
  const handleClick = () => {
    const csv = buildCsv(event);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = event.scrapedAt.slice(0, 10); // YYYY-MM-DD
    link.href = url;
    link.download = `${slug}-r${event.round}-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 transition-all"
      style={{
        padding: "6px 12px",
        borderRadius: "var(--radius-lg)",
        fontFamily: "var(--font-body)",
        fontSize: "0.8rem",
        fontWeight: 500,
        color: "var(--text-secondary)",
        background: "var(--glass-secondary)",
        border: "1px solid var(--glass-border)",
        cursor: "pointer",
      }}
      title={`Télécharger les ${event.frenchPlayers.length} lignes au format CSV (UTF-8, compatible Excel/Sheets)`}
      aria-label="Exporter les standings en CSV"
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
      }}
    >
      <Download className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Export CSV</span>
    </button>
  );
}
