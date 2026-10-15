import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Field } from "../../components/Field";
import { Icon } from "../../components/Icon";
import { AuthShell } from "../../components/Layout";
import { api, errorMessage } from "../../lib/api";

type Step = "form" | "code" | "done";

export function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [role, setRole] = useState<"USER" | "TRANSLATOR">("USER");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const cleanPhone = phone.replace(/[\s\-().]/g, "");
  const errors = {
    phone: phone && !/^\+?\d{8,15}$/.test(cleanPhone) ? "Invalid number format" : null,
    email: email && !/^\S+@\S+\.\S+$/.test(email) ? "Invalid email" : null,
    password: password && password.length < 8 ? "Password must be at least 8 characters" : null,
    repeat: repeat && repeat !== password ? "Passwords do not match" : null,
  };
  const formValid =
    fullName.trim().length >= 2 &&
    cleanPhone !== "" &&
    email !== "" &&
    password !== "" &&
    repeat !== "" &&
    !errors.phone &&
    !errors.email &&
    !errors.password &&
    !errors.repeat;

  async function getCode(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ devCode?: string }>("POST", "/auth/send-code", { phone: cleanPhone });
      setDevCode(data.devCode ?? null);
      setCooldown(60);
      setStep("code");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ phone: cleanPhone, code, password, fullName: fullName.trim(), email: email.trim(), role });
      setStep("done");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <AuthShell>
        <div className="auth-page" style={{ textAlign: "center", paddingTop: 120 }}>
          <div className="success">
            <div className="check">
              <Icon name="check" size={30} />
            </div>
            <h2>Registration was successful</h2>
            <p className="subtle">
              {role === "TRANSLATOR"
                ? "Complete your profile, then an administrator will review it."
                : "You can now fully enjoy all the features."}
            </p>
          </div>
          <button
            className="btn"
            style={{ marginTop: 30 }}
            onClick={() => navigate(user?.role === "TRANSLATOR" || role === "TRANSLATOR" ? "/translator/profile" : "/")}
          >
            Great!
          </button>
        </div>
      </AuthShell>
    );
  }

  if (step === "code") {
    return (
      <AuthShell>
        <form className="auth-page" onSubmit={confirm}>
          <button type="button" className="icon-btn light" onClick={() => setStep("form")} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <h1 style={{ marginTop: 24, fontSize: 22 }}>Verification code</h1>
          <p className="subtle">We have sent a verification code to your phone number {cleanPhone}.</p>
          {devCode && (
            <div className="alert info">
              Development mode: the SMS is not sent, your code is <b>{devCode}</b>.
            </div>
          )}
          {error && <div className="alert error">{error}</div>}
          <input
            className="code-input"
            inputMode="numeric"
            maxLength={6}
            placeholder="------"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          <p className="subtle" style={{ textAlign: "center", margin: "14px 0" }}>
            {cooldown > 0 ? `Send again in ${cooldown} s` : ""}
          </p>
          <button className="btn" type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Please wait..." : "Confirm"}
          </button>
          <button
            type="button"
            className="link"
            style={{ width: "100%" }}
            disabled={cooldown > 0 || busy}
            onClick={() => getCode()}
          >
            Did not receive the code? Try again
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form className="auth-page" onSubmit={getCode} style={{ paddingTop: 36 }}>
        <h1>{role === "TRANSLATOR" ? "Translator Registration" : "User Registration"}</h1>
        <p className="subtle">Register to access all the benefits of the app.</p>

        <div className="segmented">
          <button type="button" className={role === "USER" ? "active" : ""} onClick={() => setRole("USER")}>
            I am a user
          </button>
          <button
            type="button"
            className={role === "TRANSLATOR" ? "active" : ""}
            onClick={() => setRole("TRANSLATOR")}
          >
            I am a translator
          </button>
        </div>

        {error && <div className="alert error">{error}</div>}

        <Field label="Full name" icon="user" placeholder="Last name First name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Field label="Phone number" icon="phone" placeholder="Enter your phone number without dashes" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} inputMode="tel" />
        <Field label="Email (for password recovery)" icon="message" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} type="email" />
        <Field label="Password" icon="lock" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Field label="Repeat password" icon="lock" type="password" placeholder="Repeat again" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={errors.repeat} />

        <button className="btn" type="submit" disabled={busy || !formValid} style={{ marginTop: 8 }}>
          {busy ? "Please wait..." : "Get code"}
        </button>
        <Link to="/login" className="link">
          Already have an account
        </Link>
        <p className="subtle" style={{ textAlign: "center", marginTop: 18, fontSize: 11 }}>
          By clicking the button, you consent to the processing of your personal data
        </p>
      </form>
    </AuthShell>
  );
}
