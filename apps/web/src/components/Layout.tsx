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

export function AuthShell({ children }: { children: ReactNode }) {
  return <div className="phone">{children}</div>;
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
        className="icon-btn light"
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
  return (
    <div className="overlay-bg" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="grabber" />
        {children}
      </div>
    </div>
  );
}

export function Loading() {
  return <div className="empty">Loading...</div>;
}
