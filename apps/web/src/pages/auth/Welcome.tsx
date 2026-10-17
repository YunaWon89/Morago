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
  return <img className="mark" src="/img/logomark.png" width={size} height={size} alt="" />;
}

const SLIDES = [
  {
    title: "Don't understand or can't explain?",
    text: "The Morago app will help, just choose your translator",
    bg: "url(/img/ob/1.jpg)",
  },
  {
    title: "From hospital to realtor",
    text: "Choose from various topics — from puden-san to hospital",
    bg: "url(/img/ob/2.jpg)",
  },
  {
    title: "First call on us",
    text: "Call and pay only for the minutes you actually used",
    bg: "url(/img/ob/3.jpg)",
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
      style={{ backgroundImage: slide.bg }}
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

      {/* Wide screens: one wide picture with all four people (hidden on phones) */}
      <div className="ob-wide" aria-hidden="true">
        <div className="ob-wide-text">
          <h2>{SLIDES[0]!.title}</h2>
          <p>{SLIDES[0]!.text}</p>
        </div>
      </div>

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
