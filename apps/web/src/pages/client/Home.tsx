import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { BrandHeader } from "../../components/Layout";
import { Stars } from "../../components/Stars";
import { useCall } from "../../call/CallContext";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { topicIcon } from "../../lib/topics";
import type { CallDto, CategoriesResponse, Paginated, WalletResponse } from "../../lib/types";

export function ClientHome() {
  const navigate = useNavigate();
  const { callEpoch } = useCall();
  const [balance, setBalance] = useState<number | null>(null);
  const [topics, setTopics] = useState<CategoriesResponse | null>(null);
  const [calls, setCalls] = useState<CallDto[]>([]);
  const [callsLoaded, setCallsLoaded] = useState(false);

  useEffect(() => {
    api<WalletResponse>("GET", "/wallet?limit=1")
      .then((data) => setBalance(data.balance))
      .catch(() => undefined);
    api<Paginated<CallDto>>("GET", "/calls?status=ENDED&limit=3")
      .then((data) => {
        setCalls(data.items);
        setCallsLoaded(true);
      })
      .catch(() => undefined);
  }, [callEpoch]);

  useEffect(() => {
    api<CategoriesResponse>("GET", "/categories")
      .then(setTopics)
      .catch(() => undefined);
  }, []);

  const emergency = topics?.uncategorizedThemes.find((theme) => theme.isEmergency);

  // "First call free" promo from the design: shown once per browser tab to a client with no calls yet.
  const [promo, setPromo] = useState(false);
  useEffect(() => {
    try {
      if (!sessionStorage.getItem("morago_promo_seen")) setPromo(true);
    } catch {
      /* ignore */
    }
  }, []);
  function closePromo(goTo?: string) {
    try {
      sessionStorage.setItem("morago_promo_seen", "1");
    } catch {
      /* ignore */
    }
    setPromo(false);
    if (goTo) navigate(goTo);
  }

  return (
    <div className="screen">
      {promo && callsLoaded && calls.length === 0 && (
        <div className="free-call" onClick={() => closePromo()}>
          <div className="free-call-card" onClick={(event) => event.stopPropagation()}>
            <h2>FIRST CALL FREE!</h2>
            <p>
              Try the Morago Translate
              <br />
              service on us
            </p>
            <img src="/img/free-call.png" alt="" />
            <button className="btn" onClick={() => closePromo("/topics")}>
              Try
            </button>
          </div>
        </div>
      )}
      <BrandHeader>
        <div className="balance-card">
          <div>
            <div className="label">My balance</div>
            <div className="amount">
              <span className="coin">{"\u20A9"}</span>
              {balance === null ? "..." : balance.toLocaleString("en-US")}
            </div>
          </div>
          <Link to="/balance/topup" className="plus-btn">
            Top up
            <span className="sq">
              <Icon name="plus" size={14} />
            </span>
          </Link>
        </div>
        <button className="btn yellow" style={{ marginTop: 14 }} onClick={() => navigate("/topics")}>
          Select a translator and call
        </button>
      </BrandHeader>

      <div className="body">
        <h2 className="section-title" style={{ marginTop: 6 }}>
          Popular translation topics
        </h2>
        <div className="grid">
          {topics?.categories.map((category) => (
            <button key={category.id} className="tile" onClick={() => navigate(`/topics?category=${category.id}`)}>
              <img className="topic-ico" src={topicIcon(category.name)} alt="" />
              {category.name}
            </button>
          ))}
          {emergency && (
            <button className="tile" onClick={() => navigate(`/translators?themeId=${emergency.id}`)}>
              <img className="topic-ico" src={topicIcon(emergency.name)} alt="" />
              {emergency.name}
            </button>
          )}
        </div>

        <div className="row">
          <h2 className="section-title">My recent calls</h2>
          <Link to="/calls" className="subtle">
            All
          </Link>
        </div>
        {calls.length === 0 && <div className="empty">You have no calls yet</div>}
        {calls.map((call) => (
          <div key={call.id} className="list-item">
            <Avatar fileId={call.translator.avatarFileId} name={call.translator.fullName} size={44} square />
            <div className="grow">
              <div className="name">
                {call.translator.fullName}
                {call.review && <Stars value={call.review.rating} />}
              </div>
              <div className="sub">{call.theme.name}</div>
            </div>
            <div className="meta">{formatDate(call.requestedAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
