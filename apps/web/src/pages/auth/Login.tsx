import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { AuthShell } from "../../components/Layout";
import { Field } from "../../components/Field";
import { ApiError, errorMessage } from "../../lib/api";

export function Login() {
  const { user, login, logout } = useAuth();
  const [role, setRole] = useState<"USER" | "TRANSLATOR">("USER");
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const loggedIn = await login(phone.trim(), password);
      if (loggedIn.role !== "ADMIN" && loggedIn.role !== role) {
        logout();
        setError(
          loggedIn.role === "TRANSLATOR"
            ? "This is a translator account. Choose \"I am a translator\"."
            : "This is a client account. Choose \"I am a user\".",
        );
        return;
      }
      navigate("/");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "Invalid number or password" : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell plain variant={role === "TRANSLATOR" ? "translator" : "client"}>
      <form className="auth-page" onSubmit={submit}>
        <h1>Log in</h1>
        <p className="subtle">Log in to take advantage of all the app's features.</p>

        <div className="segmented">
          <button type="button" className={role === "USER" ? "active" : ""} onClick={() => setRole("USER")}>
            I am a user
          </button>
          <button type="button" className={role === "TRANSLATOR" ? "active" : ""} onClick={() => setRole("TRANSLATOR")}>
            I am a translator
          </button>
        </div>

        <Field
          label="Phone number or email"
          icon="phone"
          placeholder="Phone number, digits only"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={error ? " " : null}
          autoComplete="username"
        />
        <Field
          label="Password"
          icon="lock"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={error}
          autoComplete="current-password"
        />

        <button className={role === "TRANSLATOR" ? "btn orange" : "btn"} type="submit" disabled={busy || !phone || !password} style={{ marginTop: 8 }}>
          {busy ? "Please wait..." : "Log in"}
        </button>
        <Link to="/register" className="btn secondary">
          Register
        </Link>
        <Link to="/forgot-password" className="link">
          Forgot password
        </Link>
      </form>
    </AuthShell>
  );
}
