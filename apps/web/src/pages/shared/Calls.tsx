import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/Avatar";
import { BrandHeader } from "../../components/Layout";
import { Stars } from "../../components/Stars";
import { useCall } from "../../call/CallContext";
import { api } from "../../lib/api";
import { formatDate, formatDuration, formatWon } from "../../lib/format";
import type { CallDto, Paginated } from "../../lib/types";

export function Calls() {
  const { user } = useAuth();
  const { callEpoch } = useCall();
  const [tab, setTab] = useState<"all" | "missed">("all");
  const [items, setItems] = useState<CallDto[] | null>(null);

  useEffect(() => {
    api<Paginated<CallDto>>("GET", "/calls?limit=50")
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, [callEpoch]);

  const isClient = user?.role === "USER";
  const shown = (items ?? []).filter(
    (call) => tab === "all" || ["MISSED", "REJECTED", "FAILED"].includes(call.status),
  );

  return (
    <div className="screen">
      <BrandHeader />
      <div className="body">
        <div className="segmented plain">
          <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
            All
          </button>
          <button className={tab === "missed" ? "active" : ""} onClick={() => setTab("missed")}>
            Missed
          </button>
        </div>
        <h1 className="page-title" style={{ marginBottom: 14 }}>
          Recent
        </h1>

        {items === null && <div className="empty">Loading...</div>}
        {items !== null && shown.length === 0 && <div className="empty">No calls yet</div>}
        {shown.map((call) => {
          const other = isClient ? call.translator : call.client;
          const ok = call.status === "ENDED" && (call.durationSec ?? 0) > 0;
          return (
            <div key={call.id} className="list-item">
              <Avatar name={other.fullName} size={44} square />
              <div className="grow">
                <div className="name">
                  {other.fullName}
                  <span className={ok ? "status-dot on" : "status-dot off"} />
                  {call.review && <Stars value={call.review.rating} />}
                </div>
                <div className="sub">{call.theme.name}</div>
              </div>
              <div className="meta">
                <div>{formatDate(call.requestedAt)}</div>
                <div>
                  {ok ? `${formatDuration(call.durationSec)} · ${formatWon(call.totalCost ?? 0)}` : call.status.toLowerCase()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
