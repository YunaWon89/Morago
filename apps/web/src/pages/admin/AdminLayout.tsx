import { useEffect, useState, type FormEvent } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Icon } from "../../components/Icon";
import { Loading } from "../../components/Layout";
import { Forbidden } from "../ErrorPages";
import { ApiError, errorMessage } from "../../lib/api";
import { Modal } from "./ui";
import { AdminLogo } from "./ui";

export function AdminLogin() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      setError("This account is not an administrator");
      logout();
    }
  }, [user, logout]);

  if (user?.role === "ADMIN") return <Navigate to="/admin" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate("/admin");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "Invalid login or password" : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-login">
      <div className="adm-login-top">
        <div className="brand">
          <AdminLogo />
        </div>
        <div className="bar" />
      </div>
      <form className="adm-login-box" onSubmit={submit}>
        <h1>Login</h1>
        <input
          className="adm-input-dark"
          placeholder="Email or phone"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
        />
        <input
          className="adm-input-dark"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
        <button className="adm-btn-dark" type="submit" disabled={busy || !email || !password}>
          {busy ? "Please wait..." : "Login"}
        </button>
        {error && <div className="adm-err">{error}</div>}
        <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
          <a href="/forgot-password">Forgot Password?</a>
        </p>
      </form>
    </div>
  );
}

export function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const [hint, setHint] = useState(false);

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "ADMIN") return <Forbidden />;

  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="brand">
          <AdminLogo />
        </div>
        <nav className="adm-nav">
          <div className="group">Lists</div>
          <NavLink to="/admin/users">User</NavLink>
          <NavLink to="/admin/translators">Translator</NavLink>
          <NavLink to="/admin/calls">Calls</NavLink>
          <div className="group" style={{ marginTop: 14 }}>
            Finance
          </div>
          <NavLink to="/admin/topups">Top-up requests</NavLink>
          <NavLink to="/admin/payouts">Withdrawals</NavLink>
          <div className="group" style={{ marginTop: 14 }}>
            Translation topics
          </div>
          <NavLink to="/admin/themes">Themes</NavLink>
          <NavLink to="/admin/categories">Categories</NavLink>
          <NavLink to="/admin/languages">Languages</NavLink>
        </nav>
        <div className="bottom">
          <button className="adm-add" onClick={() => setHint(true)}>
            <span className="ic">
              <Icon name="plus" size={14} />
            </span>
            Add
          </button>
          <Icon name="gear" size={20} />
        </div>
      </aside>

      <div className="adm-main">
        <div className="adm-top">
          <div className="adm-user">
            <Icon name="user" size={16} />
            {user.fullName || "Admin"}
            <button onClick={logout}>Log out</button>
          </div>
        </div>
        <div className="adm-content">
          <Outlet />
        </div>
      </div>

      {hint && (
        <Modal onClose={() => setHint(false)}>
          <h3>Add</h3>
          <p style={{ marginTop: 12, lineHeight: 1.6, fontSize: 13 }}>
            Users and translators create their own accounts through the app registration with an SMS code, so they are
            not added here. An administrator can top up a user (User list, eye icon, Charge) and approve translators
            (Translator list, eye icon, Status).
          </p>
        </Modal>
      )}
    </div>
  );
}
