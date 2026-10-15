import { createPortal } from "react-dom";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { ConversationDto, NotificationDto, Paginated } from "../lib/types";
import { useSocketEvent } from "../realtime/RealtimeContext";
import { Icon } from "./Icon";

// ---------- screens that need a logged-in user ----------

export function ShellLayout() {
  const { user } = useAuth();
  const theme = user?.role === "TRANSLATOR" ? "theme-dark" : "";
  return (
    <div className={`phone ${theme}`}>
      <Outlet />
      {user && user.role !== "ADMIN" && <TabBar />}
    </div>
  );
}

// ---------- login, registration, password recovery ----------

export function AuthShell({
  children,
  tagline,
  variant = "client",
}: {
  children: ReactNode;
  tagline?: string;
  variant?: "client" | "translator";
}) {
  return (
    <div className={variant === "translator" ? "phone theme-orange" : "phone"}>
      <div className="auth-hero">
        <span className="logo">morago</span>
        <p>{tagline ?? "Live translators for your life in Korea"}</p>
      </div>
      <div className="auth-sheet">{children}</div>
    </div>
  );
}

function TabBar() {
  const unread = useUnreadMessages();
  const tabs = [
    { to: "/", label: "Home", icon: "home", end: true },
    { to: "/calls", label: "My calls", icon: "phone", end: false },
    { to: "/messages", label: "Messages", icon: "message", end: false },
    { to: "/profile", label: "Profile", icon: "user", end: false },
  ];
  return (
    <nav className="tabbar">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => (isActive ? "tab active" : "tab")}
        >
          <Icon name={tab.icon} size={22} />
          {tab.label}
          {tab.icon === "message" && unread > 0 && <span className="badge">{unread}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

function useUnreadMessages(): number {
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    api<{ items: ConversationDto[] }>("GET", "/conversations")
      .then((data) => setCount(data.items.reduce((sum, item) => sum + item.unreadCount, 0)))
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);
  useSocketEvent("message:new", load);
  useSocketEvent("messages:read", load);
  return count;
}

// ---------- headers ----------

export function BellButton() {
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    api<Paginated<NotificationDto> & { unreadCount: number }>("GET", "/notifications?limit=1")
      .then((data) => setUnread(data.unreadCount))
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);
  useSocketEvent("notification:new", load);

  return (
    <Link to="/notifications" className="icon-btn" aria-label="Notifications">
      <Icon name="bell" size={18} />
      {unread > 0 && <span className="dot" />}
    </Link>
  );
}

// Coloured header with the logo, used on the main screens.
export function BrandHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="header">
      <div className="header-row">
        <span style={{ width: 36 }} />
        <span className="logo">morago</span>
        <BellButton />
      </div>
      {children}
    </header>
  );
}

// White header with a back arrow, used on inner screens.
export function TopBar({ title, backTo }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  return (
    <div className="topbar">
      <button
        className="back-circle"
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        aria-label="Back"
      >
        <Icon name="back" size={18} />
      </button>
      <h1>{title}</h1>
    </div>
  );
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="overlay-bg" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="grabber" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Picture used on the "request sent" sheets: a phone with a wallet and a check mark.
export function SuccessArt() {
  return (
    <svg className="success-art" viewBox="0 0 190 150" aria-hidden="true">
      <defs>
        <linearGradient id="sa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b4252" />
          <stop offset="1" stopColor="#3b4252" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M40 150V22a14 14 0 0 1 14-14h92" fill="none" stroke="url(#sa)" strokeWidth="5" strokeLinecap="round" />
      <path d="M150 150V40" fill="none" stroke="url(#sa)" strokeWidth="5" strokeLinecap="round" />
      <rect x="62" y="52" width="66" height="46" rx="14" fill="#f1f3f6" />
      <circle cx="95" cy="70" r="13" fill="#e3e7ec" />
      <rect x="74" y="88" width="42" height="7" rx="3.5" fill="#e3e7ec" />
      <circle cx="152" cy="26" r="20" fill="#fff" />
      <circle cx="152" cy="26" r="13" fill="#3b4252" />
      <path d="M146 26l4.5 4.5L158 22" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Loading() {
  return <div className="empty">Loading...</div>;
}
