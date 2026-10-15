import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Layout";
import { Stars } from "../../components/Stars";
import { useCall } from "../../call/CallContext";
import { api } from "../../lib/api";
import { formatDate, formatDuration, formatWon } from "../../lib/format";
import type { CallDto, ConversationDto, Paginated, TranslatorCard } from "../../lib/types";

export function Calls() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { callEpoch } = useCall();
  const [tab, setTab] = useState<"all" | "missed">("all");
  const [items, setItems] = useState<CallDto[] | null>(null);
  const [contact, setContact] = useState<{ call: CallDto; translator: TranslatorCard | null } | null>(null);

  useEffect(() => {
    api<Paginated<CallDto>>("GET", "/calls?limit=50")
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, [callEpoch]);

  const isClient = user?.role === "USER";
  const shown = (items ?? []).filter(
    (call) => tab === "all" || ["MISSED", "REJECTED", "FAILED"].includes(call.status),
  );

  // A client can open the translator from the history to call or write again.
  function open(call: CallDto) {
    if (!isClient) return;
    setContact({ call, translator: null });
    api<{ translator: TranslatorCard }>("GET", `/translators/${call.translator.id}`)
      .then((data) => setContact({ call, translator: data.translator }))
      .catch(() => undefined);
  }

  async function openChat(translatorId: number) {
    const data = await api<{ conversation: ConversationDto }>("POST", "/conversations", { translatorId });
    navigate(`/messages/${data.conversation.id}`);
  }

  return (
    <div className="screen">
      <header className="header" style={{ paddingBottom: 18 }}>
        <div className="header-row" style={{ justifyContent: "center" }}>
          <span className="logo">morago</span>
        </div>
      </header>
      <div className="body" style={{ paddingTop: 16 }}>
        <div className="segmented plain">
          <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
            All
          </button>
          <button className={tab === "missed" ? "active" : ""} onClick={() => setTab("missed")}>
            Missed
          </button>
        </div>
        <h1 className="page-title" style={{ marginBottom: 16 }}>
          Recent
        </h1>

        {items === null && <div className="empty">Loading...</div>}
        {items !== null && shown.length === 0 && <div className="empty">No calls yet</div>}
        {shown.map((call) => {
          const other = isClient ? call.translator : call.client;
          const ok = call.status === "ENDED" && (call.durationSec ?? 0) > 0;
          return (
            <button key={call.id} className="list-item" onClick={() => open(call)} style={{ cursor: isClient ? "pointer" : "default" }}>
              <Avatar name={other.fullName} size={48} square />
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
                  {ok ? `${formatDuration(call.durationSec)}${isClient ? "" : ` · ${formatWon(call.totalCost ?? 0)}`}` : call.status.toLowerCase()}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {contact && (
        <Sheet onClose={() => setContact(null)}>
          <h2>
            <span className={contact.translator?.isOnline ? "status-dot on" : "status-dot off"} />{" "}
            {contact.call.translator.fullName}
          </h2>
          <p className="subtle" style={{ marginTop: 2 }}>
            {contact.call.theme.name}
          </p>
          <div className="list-item" style={{ marginTop: 14, marginBottom: 0, boxShadow: "none", border: 0, borderTop: "1px solid var(--line)", borderRadius: 0, paddingLeft: 0, paddingRight: 0 }}>
            <Avatar name={contact.call.translator.fullName} size={44} square />
            <div className="grow">
              <Stars value={contact.translator?.ratingAvg ?? 0} size={15} />{" "}
              <span className="subtle">{contact.translator ? contact.translator.ratingAvg.toFixed(1) : ""}</span>
            </div>
            <button
              className="icon-btn light"
              style={{ color: "var(--red)" }}
              onClick={() => navigate(`/translators?themeId=${contact.call.theme.id}`)}
              aria-label="Call"
            >
              <Icon name="phone" size={18} />
            </button>
            <button className="icon-btn light" onClick={() => openChat(contact.call.translator.id)} aria-label="Write a message">
              <Icon name="message" size={18} />
            </button>
          </div>
          <div className="stat-row">
            <div>
              <b style={{ color: contact.translator?.isOnline ? "var(--green)" : "var(--red)" }}>
                {contact.translator?.isOnline ? "Online" : "Offline"}
              </b>
              <small>Availability</small>
            </div>
            <div>
              <b>Verified</b>
              <small>Status</small>
            </div>
            <div>
              <b>{contact.translator ? formatWon(contact.translator.pricePerMinute) : "..."}</b>
              <small>1 minute</small>
            </div>
          </div>
          <button
            className="btn"
            disabled={!contact.translator?.isOnline}
            onClick={() => navigate(`/translators?themeId=${contact.call.theme.id}`)}
          >
            {contact.translator?.isOnline ? "Call" : "Not available"}
          </button>
        </Sheet>
      )}
    </div>
  );
}
