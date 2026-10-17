import { useAuth } from "../auth/AuthContext";
import { useSocketEvent } from "../realtime/RealtimeContext";
import type { MessageDto } from "../lib/types";

let audio: AudioContext | null = null;

// A short beep made with the browser itself (no sound files). Browsers may block sound until the
// user has clicked something on the page; then nothing is played and nothing breaks.
export function beep(frequency = 880) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.27);
  } catch {
    // sound is optional
  }
}

// Plays a sound for a new message (from the other person) and for a new notification.
export function SoundAlerts() {
  const { user } = useAuth();
  useSocketEvent<MessageDto>("message:new", (message) => {
    if (message.senderId !== user?.id) beep(880);
  });
  useSocketEvent("notification:new", () => beep(660));
  return null;
}
