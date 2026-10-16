import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Field } from "../../components/Field";
import { Icon } from "../../components/Icon";
import { Otp } from "../../components/Otp";
import { AuthShell, SuccessArt } from "../../components/Layout";
import { api, errorMessage } from "../../lib/api";

type RecoveryStep = "phone" | "code" | "password" | "done";

function clock(total: number): string {
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// Restore password: phone number -> SMS code -> new password -> done.
export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<RecoveryStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== "code" || left <= 0) return;
    const id = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [step, left]);

  const cleanPhone = phone.replace(/[\s\-().]/g, "");
  const phoneError = phone && !/^\+?\d{8,15}$/.test(cleanPhone) ? "Invalid number format" : null;
  const passwordError = password && password.length < 8 ? "Password must be at least 8 characters" : null;
  const mismatch = repeat && repeat !== password ? "Passwords do not match" : null;
  // The server accepts a new code one minute after the previous one.
  const canResend = left <= 240;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function sendCode(event?: FormEvent) {
    event?.preventDefault();
    return run(async () => {
      const data = await api<{ devCode?: string; expiresInSec: number }>("POST", "/auth/forgot-password/phone", {
        phone: cleanPhone,
      });
      setDevCode(data.devCode ?? null);
      setCode("");
      setLeft(data.expiresInSec ?? 300);
      setStep("code");
    });
  }

  function confirmCode(event: FormEvent) {
    event.preventDefault();
    return run(async () => {
      const data = await api<{ token: string }>("POST", "/auth/forgot-password/verify", { phone: cleanPhone, code });
      setToken(data.token);
      setStep("password");
    });
  }

  function savePassword(event: FormEvent) {
    event.preventDefault();
    return run(async () => {
      await api("POST", "/auth/reset-password", { token, password });
      setStep("done");
    });
  }

  if (step === "done") {
    return (
      <AuthShell plain>
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

  if (step === "password") {
    return (
      <AuthShell plain>
        <form className="auth-page" onSubmit={savePassword}>
          <h1>New password</h1>
          <p className="subtle">Enter a new password to access your account</p>
          {error && <div className="alert error">{error}</div>}
          <Field label="Password" icon="lock" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} error={passwordError} />
          <Field label="Repeat password" icon="lock" type="password" placeholder="Repeat again" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={mismatch} />
          <button className="btn" type="submit" disabled={busy || password.length < 8 || password !== repeat}>
            {busy ? "Please wait..." : "Log in"}
          </button>
        </form>
      </AuthShell>
    );
  }

  if (step === "code") {
    return (
      <AuthShell plain>
        <form className="auth-page" onSubmit={confirmCode}>
          <button type="button" className="back-circle" onClick={() => setStep("phone")} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <h1 style={{ marginTop: 22, fontSize: 24 }}>Code to reset password</h1>
          <p className="subtle">We have sent the code to reset the password to your phone number</p>
          {devCode && (
            <div className="alert info">
              Development mode: the SMS is not sent, your code is <b>{devCode}</b>.
            </div>
          )}
          {error && <div className="alert error">{error}</div>}
          <Otp value={code} onChange={setCode} />
          <p className="subtle" style={{ textAlign: "center", margin: "14px 0", fontSize: 15, color: "var(--ink)" }}>
            {left > 0 ? clock(left) : "The code has expired"}
          </p>
          <button className="btn" type="submit" disabled={busy || code.length !== 6 || left <= 0}>
            {busy ? "Please wait..." : "Confirm"}
          </button>
          <button type="button" className="link" style={{ width: "100%" }} disabled={!canResend || busy} onClick={() => sendCode()}>
            Did not receive the code? Try again
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell plain>
      <form className="auth-page" onSubmit={sendCode}>
        <h1>Restore password</h1>
        <p className="subtle">Enter the phone number you registered with. We will send you an SMS code.</p>
        {error && <div className="alert error">{error}</div>}
        <Field label="Phone number" icon="phone" type="tel" inputMode="numeric" placeholder='Enter your phone number without "-"' value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneError} />
        <button className="btn" type="submit" disabled={busy || !cleanPhone || !!phoneError}>
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
