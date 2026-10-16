import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export const WELCOME_KEY = "morago_welcome_seen";

export function markWelcomeSeen() {
  try {
    sessionStorage.setItem(WELCOME_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function welcomeSeen(): boolean {
  try {
    return sessionStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

export function LogoMark({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
      <rect width="60" height="60" rx="14" fill="#fff" />
      <circle cx="15" cy="31" r="6.5" fill="#1b9bb8" />
      <path d="M25 24.5h6a6.5 6.5 0 0 1 0 13h-6z" fill="#d0021b" transform="translate(0 0)" />
      <circle cx="45" cy="31" r="6.5" fill="#ec9610" />
    </svg>
  );
}

const SLIDES = [
  {
    title: "Don't understand or can't explain?",
    text: "The Morago app will help, just choose your translator",
    bg: "linear-gradient(180deg, #a98a6a 0%, #8c6d52 38%, #2b2420 70%, #000 100%)",
  },
  {
    title: "From hospital to realtor",
    text: "Choose from various topics — from puden-san to hospital",
    bg: "linear-gradient(180deg, #dfe8ee 0%, #9fb2bd 38%, #2a3238 70%, #000 100%)",
  },
  {
    title: "First call on us",
    text: "Call and pay only for the minutes you actually used",
    bg: "linear-gradient(180deg, #e9e9ea 0%, #b3b4b6 38%, #2a2b2d 70%, #000 100%)",
  },
];

export function Welcome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [splash, setSplash] = useState(true);
  const [index, setIndex] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSplash(false), 1500);
    return () => clearTimeout(id);
  }, []);

  if (user) return <Navigate to="/" replace />;

  function go(path: string) {
    markWelcomeSeen();
    navigate(path);
  }

  if (splash) {
    return (
      <div className="splash">
        <LogoMark size={64} />
        <span className="logo">morago</span>
      </div>
    );
  }

  const slide = SLIDES[index]!;
  return (
    <div
      className="onboarding"
      style={{ background: slide.bg }}
      onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const end = e.changedTouches[0]?.clientX;
        if (touchX !== null && end !== undefined) {
          if (touchX - end > 50) setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
          if (end - touchX > 50) setIndex((i) => Math.max(0, i - 1));
        }
        setTouchX(null);
      }}
    >
      <span className="ob-circle red" style={index % 2 ? { right: -26, left: "auto" } : undefined} />
      <span className="ob-circle orange" style={index === 1 ? { left: -46, right: "auto" } : undefined} />
      <button className="ob-skip" onClick={() => go("/login")}>
        Skip
      </button>

      <div className="ob-content" key={index}>
        <h1>{slide.title}</h1>
        <p>{slide.text}</p>
        <div className="ob-dots">
          {SLIDES.map((_, i) => (
            <button key={i} className={i === index ? "active" : ""} onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      </div>

      <div className="ob-actions">
        <button className="btn" onClick={() => go("/login")}>
          Log in
        </button>
        <button className="btn light" onClick={() => go("/register")}>
          Sign up
        </button>
        <Link to="/register?role=translator" className="ob-link" onClick={markWelcomeSeen}>
          I am a translator
        </Link>
      </div>
    </div>
  );
}
