import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Field } from "../../components/Field";
import { AuthShell, SuccessArt } from "../../components/Layout";
import { api, errorMessage } from "../../lib/api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ message: string; devResetLink?: string }>("POST", "/auth/forgot-password", {
        email: email.trim(),
      });
      setMessage(data.message);
      setDevLink(data.devResetLink ?? null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form className="auth-page" onSubmit={submit}>
        <h1>Restore password</h1>
        <p className="subtle">Enter the email you registered with. We will send you a link to set a new password.</p>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert ok">{message}</div>}
        {devLink && (
          <div className="alert info">
            Development mode: the email is not sent. Open the link: <a href={devLink} style={{ textDecoration: "underline", wordBreak: "break-all" }}>reset password</a>
          </div>
        )}
        <Field label="Email" icon="message" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn" type="submit" disabled={busy || !email}>
          {busy ? "Please wait..." : "Reset password"}
        </button>
        <Link to="/login" className="btn secondary">
          Back
        </Link>
      </form>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const mismatch = repeat && repeat !== password ? "Passwords do not match" : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/auth/reset-password", { token, password });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthShell>
        <div className="auth-page" style={{ textAlign: "center" }}>
          <div className="success">
            <SuccessArt />
            <h2>Password has been reset</h2>
            <p className="subtle">You can now log in with your new password</p>
          </div>
          <button className="btn" style={{ marginTop: 30 }} onClick={() => navigate("/login")}>
            OK
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form className="auth-page" onSubmit={submit}>
        <h1>New password</h1>
        <p className="subtle">Enter a new password to access your account</p>
        {!token && <div className="alert error">The reset link is incomplete. Request a new one.</div>}
        {error && <div className="alert error">{error}</div>}
        <Field label="Password" icon="lock" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field label="Repeat password" icon="lock" type="password" placeholder="Repeat again" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={mismatch} />
        <button className="btn" type="submit" disabled={busy || !token || password.length < 8 || password !== repeat}>
          {busy ? "Please wait..." : "Save"}
        </button>
      </form>
    </AuthShell>
  );
}
