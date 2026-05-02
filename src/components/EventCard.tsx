import type { MTGEvent } from "@/lib/types";
import StatusPill from "./StatusPill";

interface Props {
  event: MTGEvent;
  active: boolean;
  onClick: () => void;
}

export default function EventCard({ event, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`ds-card text-left p-4 w-full transition-all ${
        active ? "ds-card--bordered-fr" : ""
      }`}
      style={{
        borderRadius: "var(--radius-lg)",
        background: active ? "rgba(239, 65, 53, 0.05)" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <StatusPill status={event.status} />
        <span
          className="font-mono"
          style={{ fontSize: "10px", color: "var(--text-secondary)" }}
        >
          {event.dates}
        </span>
      </div>
      <div
        className="leading-tight"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: "var(--fw-semibold)",
          fontSize: "1.05rem",
          color: active ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        {event.shortName}
      </div>
      <div
        className="font-mono mt-1"
        style={{ fontSize: "11px", color: "var(--text-secondary)" }}
      >
        {event.location}
      </div>
    </button>
  );
}
