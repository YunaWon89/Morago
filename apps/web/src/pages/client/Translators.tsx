import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Layout";
import { Stars } from "../../components/Stars";
import { useCall } from "../../call/CallContext";
import { ApiError, api, errorMessage } from "../../lib/api";
import { formatWon } from "../../lib/format";
import type { CallType, CategoriesResponse, ConversationDto, Paginated, TranslatorCard } from "../../lib/types";

export function Translators() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const themeId = Number(params.get("themeId"));
  const { startCall, call } = useCall();

  const [translators, setTranslators] = useState<TranslatorCard[] | null>(null);
  const [themeName, setThemeName] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [picked, setPicked] = useState<TranslatorCard | null>(null);
  const [languageId, setLanguageId] = useState<number | null>(null);
  const [type, setType] = useState<CallType>("AUDIO");
  const [error, setError] = useState<string | null>(null);
  const [lowBalance, setLowBalance] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!themeId) return;
    api<Paginated<TranslatorCard>>("GET", `/translators?themeId=${themeId}&limit=50`)
      .then((data) => setTranslators(data.items))
      .catch(() => setTranslators([]));
    api<CategoriesResponse>("GET", "/categories")
      .then((data) => {
        const all = [...data.categories.flatMap((c) => c.themes), ...data.uncategorizedThemes];
        setThemeName(all.find((theme) => theme.id === themeId)?.name ?? "");
      })
      .catch(() => undefined);
  }, [themeId]);

  // Online translators are shown first.
  const visible = (translators ?? [])
    .filter((translator) => !onlineOnly || translator.isOnline)
    .sort((a, b) => Number(b.isOnline) - Number(a.isOnline));

  function open(translator: TranslatorCard) {
    setPicked(translator);
    setLanguageId(translator.languages[0]?.id ?? null);
    setType("AUDIO");
    setError(null);
    setLowBalance(false);
  }

  async function callNow() {
    if (!picked || languageId === null) return;
    setBusy(true);
    setError(null);
    setLowBalance(false);
    try {
      await startCall({ translatorId: picked.id, languageId, themeId, type });
      setPicked(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) setLowBalance(true);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function openChat() {
    if (!picked) return;
    try {
      const data = await api<{ conversation: ConversationDto }>("POST", "/conversations", {
        translatorId: picked.id,
      });
      navigate(`/messages/${data.conversation.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="screen">
      <header className="header">
        <div className="header-row">
          <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <span className="logo">morago</span>
          <span style={{ width: 36 }} />
        </div>
      </header>

      <div className="body">
        <p className="subtle">Selected topic</p>
        <h2 style={{ fontSize: 18, margin: "4px 0 14px" }}>{themeName || "..."}</h2>

        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Available translators
          </h2>
          <button className={onlineOnly ? "chip active" : "chip"} onClick={() => setOnlineOnly((value) => !value)}>
            Online only
          </button>
        </div>

        {translators === null && <div className="empty">Loading...</div>}
        {translators !== null && visible.length === 0 && (
          <div className="empty">No translators for this topic yet</div>
        )}
        {visible.map((translator) => (
          <button key={translator.id} className="list-item" onClick={() => open(translator)}>
            <Avatar fileId={translator.avatarFileId} name={translator.fullName} size={46} square />
            <div className="grow">
              <div className="name">
                <span className={translator.isOnline ? "status-dot on" : "status-dot off"} />
                {translator.fullName}
              </div>
              <div className="sub" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Stars value={translator.ratingAvg} size={12} />
                <span>({translator.reviewsCount})</span>
              </div>
              <div className="sub">{translator.languages.map((l) => l.name).join(", ")}</div>
            </div>
            <div className="meta">{formatWon(translator.pricePerMinute)}/min</div>
          </button>
        ))}
      </div>

      {picked && (
        <Sheet onClose={() => setPicked(null)}>
          <h2>
            <span className={picked.isOnline ? "status-dot on" : "status-dot off"} /> {picked.fullName}
          </h2>
          <p className="subtle" style={{ marginTop: 2 }}>
            {picked.themes.map((theme) => theme.name).join(", ")}
          </p>

          <div className="list-item" style={{ marginTop: 14, marginBottom: 0 }}>
            <Avatar fileId={picked.avatarFileId} name={picked.fullName} size={44} square />
            <div className="grow">
              <Stars value={picked.ratingAvg} size={16} /> <span className="subtle">{picked.ratingAvg.toFixed(1)}</span>
            </div>
            <button className="icon-btn light" onClick={openChat} aria-label="Write a message">
              <Icon name="message" size={18} />
            </button>
          </div>

          <div className="stat-row">
            <div>
              <b style={{ color: picked.isOnline ? "var(--green)" : "var(--red)" }}>
                {picked.isOnline ? "Online" : "Offline"}
              </b>
              <small>Availability</small>
            </div>
            <div>
              <b>{picked.topikLevel ? `TOPIK ${picked.topikLevel}` : "Verified"}</b>
              <small>{picked.topikLevel ? "Korean level" : "Status"}</small>
            </div>
            <div>
              <b>{formatWon(picked.pricePerMinute)}</b>
              <small>1 minute</small>
            </div>
          </div>

          <p className="subtle" style={{ marginBottom: 8 }}>
            Language of the call
          </p>
          <div className="chips" style={{ marginBottom: 14 }}>
            {picked.languages.map((language) => (
              <button
                key={language.id}
                className={languageId === language.id ? "chip active" : "chip"}
                onClick={() => setLanguageId(language.id)}
              >
                {language.name}
              </button>
            ))}
          </div>
          <div className="segmented plain">
            <button className={type === "AUDIO" ? "active" : ""} onClick={() => setType("AUDIO")}>
              Audio call
            </button>
            <button className={type === "VIDEO" ? "active" : ""} onClick={() => setType("VIDEO")}>
              Video call
            </button>
          </div>

          {error && (
            <div className="alert error">
              {error}
              {lowBalance && (
                <>
                  {" "}
                  <Link to="/balance/topup" style={{ textDecoration: "underline" }} onClick={() => setPicked(null)}>
                    Top up
                  </Link>
                </>
              )}
            </div>
          )}

          <button
            className={picked.isOnline ? "btn green" : "btn"}
            disabled={!picked.isOnline || busy || languageId === null || (call !== null && call.status !== "ENDED")}
            onClick={callNow}
          >
            {picked.isOnline ? (busy ? "Calling..." : "Call") : "Not Available"}
          </button>
        </Sheet>
      )}
    </div>
  );
}
