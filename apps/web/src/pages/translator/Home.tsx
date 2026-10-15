import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { BrandHeader } from "../../components/Layout";
import { useCall } from "../../call/CallContext";
import { ApiError, api, errorMessage } from "../../lib/api";
import { formatDate, formatDuration, formatWon } from "../../lib/format";
import type { CallDto, OwnTranslatorProfile, Paginated, WalletResponse } from "../../lib/types";

export function TranslatorHome() {
  const { callEpoch } = useCall();
  const [profile, setProfile] = useState<OwnTranslatorProfile | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [calls, setCalls] = useState<CallDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ profile: OwnTranslatorProfile }>("GET", "/translators/me")
      .then((data) => setProfile(data.profile))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    api<WalletResponse>("GET", "/wallet?limit=1")
      .then((data) => setBalance(data.balance))
      .catch(() => undefined);
    api<Paginated<CallDto>>("GET", "/calls?status=ENDED&limit=10")
      .then((data) => setCalls(data.items))
      .catch(() => undefined);
  }, [callEpoch]);

  async function setOnline(isOnline: boolean) {
    setError(null);
    try {
      const data = await api<{ profile: OwnTranslatorProfile }>("PUT", "/translators/me/online", { isOnline });
      setProfile(data.profile);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : errorMessage(e));
    }
  }

  const approved = profile?.verificationStatus === "APPROVED";

  return (
    <div className="screen">
      <BrandHeader>
        <Link to="/balance" className="balance-card">
          <div>
            <div className="label">My balance</div>
            <div className="amount">
              <span className="coin">{"\u20A9"}</span>
              {balance === null ? "..." : `${balance.toLocaleString("en-US")} won`}
            </div>
          </div>
          <span className="subtle">{"\u203A"}</span>
        </Link>
        <div className="toggle-switch">
          <button className={profile?.isOnline ? "on-green" : ""} disabled={!profile} onClick={() => setOnline(true)}>
            Available
          </button>
          <button className={profile && !profile.isOnline ? "on-red" : ""} disabled={!profile} onClick={() => setOnline(false)}>
            Not available
          </button>
        </div>
      </BrandHeader>

      <div className="body">
        {error && <div className="alert error">{error}</div>}
        {profile && profile.verificationStatus === "REGISTERED" && (
          <div className="alert info">
            Complete your profile (topics, languages, price) so that the administrator can review it.{" "}
            <Link to="/translator/profile" style={{ textDecoration: "underline" }}>
              Open profile
            </Link>
          </div>
        )}
        {profile && profile.verificationStatus === "INTERVIEW_SCHEDULED" && (
          <div className="alert info">An interview has been scheduled. You will be approved after it.</div>
        )}
        {profile && profile.verificationStatus === "REJECTED" && (
          <div className="alert error">Your profile was not approved. Contact support.</div>
        )}
        {profile && !approved && profile.verificationStatus !== "REGISTERED" && null}

        <h2 className="section-title" style={{ marginTop: 4 }}>
          Call history
        </h2>
        {calls.length === 0 && <div className="empty">No call history</div>}
        {calls.map((call) => (
          <div key={call.id} className="list-item">
            <Avatar name={call.client.fullName} size={44} square />
            <div className="grow">
              <div className="name">{call.client.fullName}</div>
              <div className="sub">{call.theme.name}</div>
            </div>
            <div className="meta">
              <div>{formatDate(call.requestedAt)}</div>
              <div>
                {formatDuration(call.durationSec)} · {formatWon(call.totalCost ?? 0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
