import type { EventStatus } from "@/lib/types";

interface Props {
  status: EventStatus;
}

const labels: Record<EventStatus, string> = {
  live: "EN DIRECT",
  ended: "TERMINÉ",
  upcoming: "À VENIR",
};

export default function StatusPill({ status }: Props) {
  return (
    <span className={`status-pill status-pill--${status}`}>
      <span className="status-pill__dot">
        <span className="status-pill__dot-core" />
      </span>
      {labels[status]}
    </span>
  );
}
