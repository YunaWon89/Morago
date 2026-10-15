import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Stars } from "../components/Stars";
import { errorMessage } from "../lib/api";
import { formatClock, formatDuration, formatWon } from "../lib/format";
import { useCall } from "./CallContext";

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

// The call is shown on top of every page, so it survives navigation.
// Plays the other person's voice through the Web Audio API. A muted <audio> element is
// still attached because browsers only deliver remote WebRTC sound when the stream is
// connected to a media element. Playback is resumed on every tap in case the browser
// keeps the audio context suspended until the page has been touched.
function RemoteAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.muted = true;
    void el.play().catch(() => undefined);

    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioCtx();
    const source = context.createMediaStreamSource(stream);
    source.connect(context.destination);

    const resume = () => {
      if (context.state !== "running") void context.resume().catch(() => undefined);
    };
    resume();
    const timer = window.setInterval(resume, 700);
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      source.disconnect();
      void context.close().catch(() => undefined);
    };
  }, [stream]);
  return <audio ref={ref} muted playsInline />;
}

export function CallOverlay() {
  const { user } = useAuth();
  const c = useCall();
  const { call } = c;

  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState(false);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = c.remoteStream;
  }, [c.remoteStream, call?.status]);
  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = c.localStream;
  }, [c.localStream, call?.status]);
  useEffect(() => {
    setRating(0);
    setComment("");
    setRated(false);
    setError(null);
  }, [call?.id]);

  const ticking = call?.status === "ACTIVE";
  const now = useNow(ticking);

  if (!call || !user) return null;

  const isClient = user.role === "USER";
  const other = isClient ? call.translator : call.client;
  const theme = isClient ? "teal" : "dark";
  const isVideo = call.type === "VIDEO";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const seconds = call.startedAt ? (now - new Date(call.startedAt).getTime()) / 1000 : 0;

  // ----- a translator is being called -----
  if (call.status === "REQUESTED" && !isClient) {
    return (
      <div className="call-screen">
        <div className="call-inner dark">
          <span className="logo">morago</span>
          <div className="call-kind pulse">Incoming {isVideo ? "video" : "audio"} call</div>
          <div className="call-center">
            <div className="avatar-rings">
              <Avatar name={call.client.fullName} size={132} />
            </div>
            <div className="name" style={{ marginTop: 18 }}>{call.client.fullName}</div>
            <div className="call-meta">
              <span>{call.theme.name}</span>
              <span>{call.language.name}</span>
              <span>{formatWon(call.pricePerMinute)} / min</span>
            </div>
            {error && <div className="alert error">{error}</div>}
          </div>
          <div className="answer-row">
            <button className="round-action" disabled={busy} onClick={() => run(c.reject)}>
              <span className="big-circle red"><Icon name="hangup" size={30} /></span>
              Decline
            </button>
            <button className="round-action" disabled={busy} onClick={() => run(c.accept)}>
              <span className="big-circle green"><Icon name="phone" size={30} /></span>
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- calls that are over -----
  if (["ENDED", "MISSED", "REJECTED", "FAILED"].includes(call.status)) {
    const tookPlace = call.status === "ENDED" && (call.durationSec ?? 0) > 0;
    const canRate = isClient && tookPlace && !call.review && !rated;

    return (
      <div className="call-screen">
        <div className={`call-inner ${theme}`}>
          <span className="logo">morago</span>
          <div className="call-center">
            <Avatar name={other.fullName} size={96} square />
            <div className="name" style={{ marginTop: 0 }}>
              {isClient ? "to. " : ""}
              {other.fullName}
            </div>

            {tookPlace ? (
              <div className="summary-box">
                <span className="subtle" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {isClient ? "Call total" : "Call total (before commission)"}
                </span>
                <big>{formatWon(call.totalCost ?? 0)}</big>
                <span style={{ opacity: 0.7 }}>{formatDuration(call.durationSec)}</span>
              </div>
            ) : (
              <p style={{ opacity: 0.85 }}>
                {call.status === "MISSED" && (isClient ? "The translator did not answer" : "Missed call")}
                {call.status === "REJECTED" && "The call was declined"}
                {call.status === "FAILED" && "The call could not be connected"}
                {call.status === "ENDED" && "The call ended before it started"}
              </p>
            )}

            {canRate && (
              <>
                <p style={{ opacity: 0.85, marginTop: 8 }}>Please evaluate the translation</p>
                <div style={{ fontSize: 36 }}>
                  <Stars value={rating} onChange={setRating} size={36} />
                </div>
                <input
                  className="code-input"
                  style={{ letterSpacing: 0, fontSize: 14, fontWeight: 400, color: "var(--ink)" }}
                  placeholder="Comment (optional)"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </>
            )}
            {(call.review || rated) && isClient && <p style={{ opacity: 0.85 }}>Thank you for your rating!</p>}
            {!isClient && call.review && (
              <div style={{ textAlign: "center" }}>
                <p style={{ opacity: 0.7, fontSize: 13 }}>User rating</p>
                <Stars value={call.review.rating} size={26} />
              </div>
            )}
            {error && <div className="alert error">{error}</div>}
            {c.mediaError && <div className="alert error">{c.mediaError}</div>}
          </div>

          <div style={{ width: "100%" }}>
            {canRate && (
              <button
                className="btn orange"
                style={{ marginBottom: 10 }}
                disabled={busy || rating === 0}
                onClick={() =>
                  run(async () => {
                    await c.rate(rating, comment.trim());
                    setRated(true);
                  })
                }
              >
                Send rating
              </button>
            )}
            <button className="btn outline" onClick={c.dismiss}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- calling, connecting, talking -----
  const calling = call.status === "REQUESTED";
  const connecting = call.status === "ACCEPTED";

  const showVideo = isVideo && !!c.remoteStream;

  return (
    <div className="call-screen">
      <div className={`call-inner ${theme} ${showVideo ? "with-video" : ""}`}>
        <RemoteAudio stream={c.remoteStream} />
        <video ref={remoteRef} autoPlay playsInline muted className={showVideo ? "remote-video" : "media-hidden"} />
        {isVideo && c.localStream && !c.cameraOff && (
          <video ref={localRef} autoPlay playsInline muted className="local-video" />
        )}

        <div className="call-top">
          <span className="logo">morago</span>
        </div>

        {!showVideo && (
          <div className="call-center">
            <div className={calling || connecting ? "avatar-rings" : ""}>
              <Avatar name={other.fullName} size={150} />
            </div>
            <div className="name" style={{ marginTop: 22 }}>{other.fullName}</div>
            <div className={calling || connecting ? "timer pulse" : "timer"}>
              {calling && "Calling..."}
              {connecting && "Connecting..."}
              {ticking && formatClock(seconds)}
            </div>
            {ticking && isClient && (
              <div className="call-meta">
                <span>about {formatWon(Math.round((call.pricePerMinute * seconds) / 60))}</span>
              </div>
            )}
          </div>
        )}

        {showVideo && (
          <div className="video-caption">
            <div className="name">{other.fullName}</div>
            <div className="timer">
              {ticking ? formatClock(seconds) : "Connecting..."}
              {ticking && isClient && ` · about ${formatWon(Math.round((call.pricePerMinute * seconds) / 60))}`}
            </div>
          </div>
        )}

        {(error || c.mediaError) && <div className="alert error call-alert">{error || c.mediaError}</div>}

        <div className="call-bottom">
          {!calling && (
            <div className="call-actions">
              <button className="round-action" onClick={c.toggleMute}>
                <span className={c.muted ? "circle filled" : "circle"}>
                  <Icon name={c.muted ? "micOff" : "mic"} />
                </span>
                {c.muted ? "Unmute" : "Mute"}
              </button>
              {isVideo && (
                <button className="round-action" onClick={c.toggleCamera}>
                  <span className={c.cameraOff ? "circle filled" : "circle"}>
                    <Icon name={c.cameraOff ? "cameraOff" : "camera"} />
                  </span>
                  Camera
                </button>
              )}
            </div>
          )}
          <button
            className="hangup"
            disabled={busy}
            aria-label={calling ? "Cancel the call" : "End the call"}
            onClick={() => run(calling ? c.cancel : c.end)}
          >
            <Icon name="hangup" size={30} />
          </button>
        </div>
      </div>
    </div>
  );
}
