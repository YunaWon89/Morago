import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/Avatar";
import { AvatarPicker } from "../../components/AvatarPicker";
import { Field } from "../../components/Field";
import { Icon } from "../../components/Icon";
import { BrandHeader, Sheet, TopBar } from "../../components/Layout";
import { useToast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { formatRelative } from "../../lib/format";
import type { NotificationDto, Paginated } from "../../lib/types";

const INFO: Record<string, string> = {
  FAQ: "How are calls paid? You pay only for the minutes you actually talk, second by second, at the price set by the translator. How do I top up? Send a bank transfer and request a top-up; an administrator confirms it within one working day.",
  "Privacy Policy": "Morago stores only the data needed to run calls, chat and payments: your phone number, email, name and your call history. Audio and video go directly between the participants and are not recorded.",
  "Contact Us": "Write to support@morago.example or call the number shown in the app after launch. This is a demo version.",
};

export function Profile() {
  const { user, logout } = useAuth();
  const [info, setInfo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      await api("DELETE", "/auth/me", { password });
      logout();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const isTranslator = user.role === "TRANSLATOR";

  return (
    <div className="screen">
      <header className="header" style={{ paddingBottom: 26, paddingTop: 34 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 22 }}>My Profile</h1>
        <div className="row" style={{ justifyContent: "flex-start", gap: 14 }}>
          <div style={{ borderRadius: "50%", border: "2px solid rgba(255,255,255,0.8)", display: "inline-flex" }}>
            <Avatar fileId={user.avatarFileId} name={user.fullName} size={56} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{user.fullName}</div>
            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 2 }}>{user.phone}</div>
          </div>
          <Link
            to="/profile/edit"
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 999, padding: "9px 28px", fontSize: 13, fontWeight: 600 }}
          >
            Edit
          </Link>
        </div>
      </header>

      <div className="body">
        <h2 className="section-title" style={{ marginTop: 6 }}>
          Settings
        </h2>
        {isTranslator && (
          <Link to="/translator/profile" className="menu-item">
            <Icon name="user" size={18} />
            <span className="grow">Translator profile: topics, languages, price</span>
            <Icon name="chevron" size={16} />
          </Link>
        )}
        <Link to="/profile/password" className="menu-item">
          <Icon name="lock" size={18} />
          <span className="grow">Change Password</span>
          <Icon name="chevron" size={16} />
        </Link>
        <Link to="/notifications" className="menu-item">
          <Icon name="bell" size={18} />
          <span className="grow">Notifications</span>
          <Icon name="chevron" size={16} />
        </Link>

        <h2 className="section-title">About the App</h2>
        {Object.keys(INFO).map((title) => (
          <button key={title} className="menu-item" onClick={() => setInfo(title)}>
            <Icon name={title === "FAQ" ? "help" : title === "Privacy Policy" ? "shield" : "users"} size={18} />
            <span className="grow">{title}</span>
            <Icon name="chevron" size={16} />
          </button>
        ))}

        <button className="btn secondary" style={{ marginTop: 20 }} onClick={logout}>
          <Icon name="logout" size={16} /> Log out
        </button>
        <button className="link" style={{ width: "100%", marginTop: 10, color: "var(--red)" }} onClick={() => { setDeleting(true); setError(null); setPassword(""); }}>
          Delete account
        </button>
      </div>

      {deleting && (
        <Sheet onClose={() => setDeleting(false)}>
          <h2>Delete account?</h2>
          <p className="subtle" style={{ margin: "10px 0 14px", fontSize: 14 }}>
            Your account will be closed and you will not be able to log in. Enter your password to confirm.
          </p>
          {error && <div className="alert error">{error}</div>}
          <Field label="Password" icon="lock" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn red" disabled={busy || !password} onClick={deleteAccount}>
            {busy ? "Please wait..." : "Delete account"}
          </button>
          <button className="btn secondary" onClick={() => setDeleting(false)}>
            Cancel
          </button>
        </Sheet>
      )}

      {info && (
        <Sheet onClose={() => setInfo(null)}>
          <h2>{info}</h2>
          <p className="subtle" style={{ margin: "10px 0 18px", fontSize: 14 }}>
            {INFO[info]}
          </p>
          <button className="btn" onClick={() => setInfo(null)}>
            OK
          </button>
        </Sheet>
      )}
    </div>
  );
}

export function ProfileEdit() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("PATCH", "/auth/profile", { fullName: fullName.trim() });
      await refreshUser();
      toast.success("Saved");
      navigate("/profile");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen no-tabs">
      <TopBar title="Edit Profile" />
      <div className="body">
        {error && <div className="alert error">{error}</div>}
        <AvatarPicker />
        <Field label="Full name" icon="user" placeholder="Last name First name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <button className="btn" disabled={busy || fullName.trim().length < 2} onClick={save}>
          {busy ? "Please wait..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const mismatch = repeat && repeat !== next ? "Passwords do not match" : null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/auth/change-password", { currentPassword: current, newPassword: next });
      setDone(true);
      toast.success("Password has been changed");
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen no-tabs">
      <TopBar title="Change Password" />
      <div className="body">
        {error && <div className="alert error">{error}</div>}
        <Field label="Current Password" icon="lock" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field label="New Password" icon="lock" type="password" placeholder="Enter New Password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Field label="Repeat New Password" icon="lock" type="password" placeholder="Repeat New Password" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={mismatch} />
        <button className="btn" disabled={busy || !current || next.length < 8 || next !== repeat} onClick={save}>
          {busy ? "Please wait..." : "Save Changes"}
        </button>
        <Link to="/forgot-password" className="link">
          Forgot Password
        </Link>
      </div>
    </div>
  );
}

function notificationText(item: NotificationDto): { title: string; text: string } {
  const event = item.payload?.event;
  const status = item.payload?.status;
  if (event === "VERIFICATION_STATUS_CHANGED") {
    const words: Record<string, string> = {
      APPROVED: "Your translator profile has been approved. You can go online now.",
      REJECTED: "Your translator profile was not approved.",
      INTERVIEW_SCHEDULED: "An interview has been scheduled. We will contact you.",
    };
    return { title: "Profile review", text: words[status ?? ""] ?? "Your profile status has changed." };
  }
  if (event === "TOPUP_STATUS_CHANGED") {
    return {
      title: "Top-up",
      text: status === "COMPLETED" ? "Your top-up request was confirmed and the balance is updated." : "Your top-up request was declined.",
    };
  }
  if (event === "PAYOUT_STATUS_CHANGED") {
    return {
      title: "Withdrawal",
      text: status === "PAID" ? "Your withdrawal was paid out." : "Your withdrawal was declined and the money returned to your balance.",
    };
  }
  return { title: "Notification", text: "Tap to view" };
}

export function Notifications() {
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [unread, setUnread] = useState(0);

  const load = () => {
    api<Paginated<NotificationDto> & { unreadCount: number }>("GET", "/notifications?limit=50")
      .then((data) => {
        setItems(data.items);
        setUnread(data.unreadCount);
      })
      .catch(() => setItems([]));
  };
  useEffect(load, []);

  async function clearAll() {
    await api("POST", "/notifications/read-all").catch(() => undefined);
    load();
  }

  return (
    <div className="screen no-tabs">
      <TopBar title="Notifications" />
      <div className="body">
        <div className="row" style={{ marginBottom: 8 }}>
          <b>
            Latest {unread > 0 && <span className="badge">{unread}</span>}
          </b>
          {unread > 0 && (
            <button style={{ color: "#ff6b3d", fontSize: 13 }} onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
        {items === null && <div className="empty">Loading...</div>}
        {items !== null && items.length === 0 && <div className="empty">No notifications</div>}
        {items?.map((item) => {
          const { title, text } = notificationText(item);
          return (
            <div key={item.id} className="list-item" style={{ opacity: item.isRead ? 0.6 : 1 }}>
              <span className="avatar" style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--teal)" }}>
                <Icon name="info" size={18} />
              </span>
              <div className="grow">
                <div className="name">{title}</div>
                <div className="sub">{text}</div>
              </div>
              <div className="meta">{formatRelative(item.createdAt)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Used as the header on the translator home too.
export { BrandHeader };
