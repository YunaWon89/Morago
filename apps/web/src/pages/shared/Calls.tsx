import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { Sheet, SkeletonList } from "../../components/Layout";
import { Stars } from "../../components/Stars";
import { useCall } from "../../call/CallContext";
import { api } from "../../lib/api";
import { formatDate, formatDuration, formatTime, formatWon } from "../../lib/format";
import type { CallDto, ConversationDto, Paginated, TranslatorCard } from "../../lib/types";

export function Calls() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { callEpoch } = useCall();
  const [tab, setTab] = useState<"all" | "missed">("all");
  const [items, setItems] = useState<CallDto[] | null>(null);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [details, setDetails] = useState<CallDto | null>(null);
  const [contact, setContact] = useState<{ call: CallDto; translator: TranslatorCard | null } | null>(null);

  useEffect(() => {
    const query = new URLSearchParams({ limit: "50" });
    if (status) query.set("status", status);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    api<Paginated<CallDto>>("GET", `/calls?${query.toString()}`)
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, [callEpoch, status, from, to]);

  const isClient = user?.role === "USER";
  const shown = (items ?? []).filter(
    (call) => tab === "all" || ["MISSED", "REJECTED", "FAILED"].includes(call.status),
  );

  // A client can open the translator from the details to call or write again.
  function openContact(call: CallDto) {
    if (!isClient) return;
    setDetails(null);
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

        <div className="filters">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            <option value="ENDED">Finished</option>
            <option value="MISSED">Missed</option>
            <option value="REJECTED">Declined</option>
            <option value="FAILED">Failed</option>
          </select>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          {(status || from || to) && (
            <button
              type="button"
              className="clear"
              onClick={() => {
                setStatus("");
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </button>
          )}
        </div>

        {items === null && <SkeletonList />}
        {items !== null && shown.length === 0 && <div className="empty">No calls yet</div>}
        {shown.map((call) => {
          const other = isClient ? call.translator : call.client;
          const ok = call.status === "ENDED" && (call.durationSec ?? 0) > 0;
          return (
            <button key={call.id} className="list-item" onClick={() => setDetails(call)} style={{ cursor: "pointer" }}>
              <Avatar fileId={other.avatarFileId} name={other.fullName} size={48} square />
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

      {details && (
        <Sheet onClose={() => setDetails(null)}>
          <h2>Call details</h2>
          <div className="stat-row" style={{ flexWrap: "wrap" }}>
            <div>
              <b>{(isClient ? details.translator : details.client).fullName}</b>
              <small>{isClient ? "Translator" : "Client"}</small>
            </div>
            <div>
              <b>{details.status.toLowerCase()}</b>
              <small>Status</small>
            </div>
          </div>
          <div className="doc-list">
            <div className="doc-item"><div className="grow">Topic<small>{details.theme.name}</small></div></div>
            <div className="doc-item"><div className="grow">Language<small>{details.language.name}</small></div></div>
            <div className="doc-item"><div className="grow">Requested<small>{formatDate(details.requestedAt)} {formatTime(details.requestedAt)}</small></div></div>
            <div className="doc-item"><div className="grow">Duration<small>{details.durationSec ? formatDuration(details.durationSec) : "-"}</small></div></div>
            <div className="doc-item"><div className="grow">{isClient ? "Cost" : "Earned (after commission)"}<small>{details.totalCost ? formatWon(details.totalCost) : "-"}</small></div></div>
            <div className="doc-item"><div className="grow">Price per minute<small>{formatWon(details.pricePerMinute)}</small></div></div>
            {details.review && (
              <div className="doc-item">
                <div className="grow">Review<small><Stars value={details.review.rating} /> {details.review.comment ?? ""}</small></div>
              </div>
            )}
          </div>
          {isClient && (
            <button className="btn" onClick={() => openContact(details)}>
              Call or write again
            </button>
          )}
        </Sheet>
      )}

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
            <Avatar fileId={contact.call.translator.avatarFileId} name={contact.call.translator.fullName} size={44} square />
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
