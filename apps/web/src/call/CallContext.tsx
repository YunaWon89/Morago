import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthContext";
import { api, errorMessage } from "../lib/api";
import type { CallDto, CallStatus, CallType, Paginated } from "../lib/types";
import { useSocket, useSocketEvent } from "../realtime/RealtimeContext";

const TERMINAL: CallStatus[] = ["ENDED", "MISSED", "REJECTED", "FAILED"];

// eslint-disable-next-line react-refresh/only-export-components
export function isTerminal(status: CallStatus): boolean {
  return TERMINAL.includes(status);
}

interface SignalMessage {
  callId: number;
  type: "offer" | "answer" | "ice";
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  from: number;
}

export interface StartCallInput {
  translatorId: number;
  languageId: number;
  themeId: number;
  type: CallType;
}

interface CallApi {
  call: CallDto | null;
  // Increases every time a call finishes, so pages can reload balances and history.
  callEpoch: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  speaker: boolean;
  mediaError: string | null;
  startCall: (input: StartCallInput) => Promise<void>;
  accept: () => Promise<void>;
  reject: () => Promise<void>;
  cancel: () => Promise<void>;
  end: () => Promise<void>;
  rate: (rating: number, comment?: string) => Promise<void>;
  dismiss: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallApi | null>(null);

// Thrown when the call was closed while the peer connection was still being prepared. Not a user-facing error.
class StaleCallError extends Error {}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socket = useSocket();

  const [call, setCallState] = useState<CallDto | null>(null);
  const callRef = useRef<CallDto | null>(null);
  const [callEpoch, setCallEpoch] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const peerPromise = useRef<Promise<void> | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const startedSent = useRef(false);
  const signalQueue = useRef<Promise<void>>(Promise.resolve());
  const lostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLostRef = useRef<() => void>(() => undefined);

  const setCall = useCallback((next: CallDto | null) => {
    callRef.current = next;
    setCallState(next);
  }, []);

  const cleanupMedia = useCallback(() => {
    if (lostTimer.current) {
      clearTimeout(lostTimer.current);
      lostTimer.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localRef.current) {
      localRef.current.getTracks().forEach((track) => track.stop());
      localRef.current = null;
    }
    peerPromise.current = null;
    pendingIce.current = [];
    startedSent.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCameraOff(false);
    setSpeaker(true);
  }, []);

  const sendSignal = useCallback(
    (type: SignalMessage["type"], data: unknown) => {
      const current = callRef.current;
      if (!socket || !current) return;
      socket.emit("webrtc:signal", { callId: current.id, type, data });
    },
    [socket],
  );

  // Billing starts when the audio/video connection is really established.
  // Both sides confirm it, so a client that skips /start cannot get a free call.
  // If the confirmation fails, the unconfirmed call is ended.
  const onConnected = useCallback(() => {
    const current = callRef.current;
    if (!user || !current || current.status !== "ACCEPTED" || startedSent.current) return;
    startedSent.current = true;
    api("POST", `/calls/${current.id}/start`).catch(async () => {
      const latest = callRef.current;
      if (latest && latest.id === current.id && latest.status === "ACCEPTED") {
        setMediaError("The call could not be started");
        await api("POST", `/calls/${current.id}/end`).catch(() => undefined);
      }
    });
  }, [user]);

  const ensurePeer = useCallback((): Promise<void> => {
    if (!peerPromise.current) {
      peerPromise.current = (async () => {
        const current = callRef.current;
        if (!current) throw new Error("There is no active call");

        pendingIce.current = [];
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pcRef.current = pc;
        pc.onicecandidate = (event) => {
          if (event.candidate) sendSignal("ice", event.candidate.toJSON());
        };
        pc.ontrack = (event) => setRemoteStream(event.streams[0] ?? null);
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === "connected") {
            if (lostTimer.current) {
              clearTimeout(lostTimer.current);
              lostTimer.current = null;
            }
            onConnected();
          } else if ((state === "disconnected" || state === "failed") && !lostTimer.current) {
            // Give the connection a short time to recover (the caller tries an ICE restart), then end the call.
            if (user?.role === "USER" && pc.signalingState === "stable") {
              pc.createOffer({ iceRestart: true })
                .then(async (offer) => {
                  await pc.setLocalDescription(offer);
                  sendSignal("offer", pc.localDescription?.toJSON());
                })
                .catch(() => undefined);
            }
            lostTimer.current = setTimeout(
              () => {
                lostTimer.current = null;
                onLostRef.current();
              },
              state === "failed" ? 8_000 : 15_000,
            );
          }
        };

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser cannot access the microphone");
        }
        // If the camera is busy (another browser uses it) or blocked, the call continues with sound only.
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: current.type === "VIDEO",
          });
        } catch (error) {
          if (current.type !== "VIDEO") throw error;
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMediaError("The camera is not available, the call continues with sound only");
        }
        // The call may have ended while the browser was asking for the microphone.
        if (pcRef.current !== pc || pc.signalingState === "closed") {
          stream.getTracks().forEach((track) => track.stop());
          throw new StaleCallError();
        }
        localRef.current = stream;
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      })();
    }
    return peerPromise.current;
  }, [sendSignal, onConnected, user?.role]);

  const endQuietly = useCallback(async () => {
    const current = callRef.current;
    if (current) await api("POST", `/calls/${current.id}/end`).catch(() => undefined);
  }, []);

  // The media connection did not come back: end the call so nobody is charged for silence.
  useEffect(() => {
    onLostRef.current = () => {
      const current = callRef.current;
      if (!current || isTerminal(current.status)) return;
      setMediaError("The connection was lost, the call was ended");
      void endQuietly();
    };
  }, [endQuietly]);

  const failMedia = useCallback(
    (error: unknown) => {
      if (error instanceof StaleCallError) return;
      const text =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Access to the microphone or camera was denied"
          : errorMessage(error);
      setMediaError(text);
      void endQuietly();
    },
    [endQuietly],
  );

  const beginOffer = useCallback(async () => {
    await ensurePeer();
    const pc = pcRef.current;
    if (!pc || pc.signalingState !== "stable") return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal("offer", pc.localDescription?.toJSON());
  }, [ensurePeer, sendSignal]);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const candidate of pendingIce.current) await pc.addIceCandidate(candidate);
    pendingIce.current = [];
  }, []);

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      const current = callRef.current;
      if (!current || message.callId !== current.id) return;
      await ensurePeer();
      const pc = pcRef.current;
      if (!pc) return;

      if (message.type === "offer") {
        if (pc.signalingState !== "stable") return; // duplicate offer, ignore
        await pc.setRemoteDescription(message.data as RTCSessionDescriptionInit);
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal("answer", pc.localDescription?.toJSON());
      } else if (message.type === "answer") {
        if (pc.signalingState !== "have-local-offer") return; // duplicate answer, ignore
        await pc.setRemoteDescription(message.data as RTCSessionDescriptionInit);
        await flushIce();
      } else if (pc.remoteDescription) {
        await pc.addIceCandidate(message.data as RTCIceCandidateInit);
      } else {
        pendingIce.current.push(message.data as RTCIceCandidateInit);
      }
    },
    [ensurePeer, flushIce, sendSignal],
  );

  useSocketEvent<CallDto>("call:incoming", (dto) => {
    const current = callRef.current;
    if (current && !isTerminal(current.status)) return;
    setMediaError(null);
    setCall(dto);
  });

  useSocketEvent<CallDto>("call:updated", (dto) => {
    const current = callRef.current;
    if (current && current.id !== dto.id) return;
    if (!current && isTerminal(dto.status)) return;

    setCall(dto);

    if (dto.status === "ACCEPTED") {
      const step = user?.role === "USER" ? beginOffer() : ensurePeer();
      step.catch(failMedia);
    }
    if (isTerminal(dto.status)) {
      cleanupMedia();
      setCallEpoch((value) => value + 1);
    }
  });

  useSocketEvent<SignalMessage>("webrtc:signal", (message) => {
    signalQueue.current = signalQueue.current
      .then(() => handleSignal(message))
      .catch(failMedia);
  });

  // While a call is open, tell the server every few seconds that this side is alive.
  // If one side goes silent (closed tab, lost network), the server ends the call.
  const openCallId = call && (call.status === "ACCEPTED" || call.status === "ACTIVE") ? call.id : null;
  useEffect(() => {
    if (!socket || openCallId === null) return;
    const beat = () => socket.emit("call:heartbeat", { callId: openCallId });
    beat();
    const timer = setInterval(beat, 5_000);
    return () => clearInterval(timer);
  }, [socket, openCallId]);

  // After a page reload an unfinished call is shown again, so the user can end it.
  useEffect(() => {
    if (!user || (user.role !== "USER" && user.role !== "TRANSLATOR")) return;
    let cancelled = false;
    api<Paginated<CallDto>>("GET", "/calls?limit=5")
      .then((data) => {
        if (cancelled || callRef.current) return;
        const open = data.items.find((item) => !isTerminal(item.status));
        if (open) setCall(open);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, setCall]);

  // Logging out must not leave the microphone on.
  useEffect(() => {
    if (!user) {
      cleanupMedia();
      setCall(null);
    }
  }, [user, cleanupMedia, setCall]);

  const startCall = useCallback(
    async (input: StartCallInput) => {
      setMediaError(null);
      const data = await api<{ call: CallDto }>("POST", "/calls", input);
      setCall(data.call);
    },
    [setCall],
  );

  const act = useCallback(
    async (action: "accept" | "reject" | "cancel" | "end") => {
      const current = callRef.current;
      if (!current) return;
      const data = await api<{ call: CallDto }>("POST", `/calls/${current.id}/${action}`);
      setCall(data.call);
      if (isTerminal(data.call.status)) {
        cleanupMedia();
        setCallEpoch((value) => value + 1);
      }
    },
    [setCall, cleanupMedia],
  );

  const rate = useCallback(
    async (rating: number, comment?: string) => {
      const current = callRef.current;
      if (!current) return;
      await api("POST", `/calls/${current.id}/review`, { rating, comment: comment || undefined });
      setCall({ ...current, review: { rating, comment: comment ?? null } });
    },
    [setCall],
  );

  const dismiss = useCallback(() => {
    cleanupMedia();
    setCall(null);
    setMediaError(null);
  }, [cleanupMedia, setCall]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleSpeaker = useCallback(() => setSpeaker((value) => !value), []);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    localRef.current?.getVideoTracks().forEach((track) => (track.enabled = !next));
    setCameraOff(next);
  }, [cameraOff]);

  const value = useMemo<CallApi>(
    () => ({
      call,
      callEpoch,
      localStream,
      remoteStream,
      muted,
      cameraOff,
      speaker,
      mediaError,
      startCall,
      accept: () => act("accept"),
      reject: () => act("reject"),
      cancel: () => act("cancel"),
      end: () => act("end"),
      rate,
      dismiss,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
    }),
    [
      call,
      callEpoch,
      localStream,
      remoteStream,
      muted,
      cameraOff,
      speaker,
      mediaError,
      startCall,
      act,
      rate,
      dismiss,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCall(): CallApi {
  const value = useContext(CallContext);
  if (!value) throw new Error("useCall must be used inside CallProvider");
  return value;
}
