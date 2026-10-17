import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { AvatarPicker } from "../../components/AvatarPicker";
import { Field } from "../../components/Field";
import { TopBar } from "../../components/Layout";
import { useToast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import type { CategoriesResponse, Language, OwnTranslatorProfile } from "../../lib/types";

const STATUS_TEXT: Record<string, string> = {
  REGISTERED: "Waiting for review. Save your profile, the administrator will check it.",
  INTERVIEW_SCHEDULED: "An interview is scheduled.",
  APPROVED: "Approved. You can go online on the home screen.",
  REJECTED: "Not approved.",
};

export function TranslatorProfileEdit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<OwnTranslatorProfile | null>(null);
  const [topics, setTopics] = useState<CategoriesResponse | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);

  const [birth, setBirth] = useState("");
  const [topik, setTopik] = useState("");
  const [price, setPrice] = useState("");
  const [themes, setThemes] = useState<Record<number, boolean>>({});
  const [langIds, setLangIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ profile: OwnTranslatorProfile }>("GET", "/translators/me").then((data) => {
      const p = data.profile;
      setProfile(p);
      setBirth(p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "");
      setTopik(p.topikLevel ? String(p.topikLevel) : "");
      setPrice(p.pricePerMinute ? String(p.pricePerMinute) : "");
      setThemes(Object.fromEntries(p.themes.map((theme) => [theme.id, theme.withCertificate])));
      setLangIds(p.languages.map((language) => language.id));
    }).catch((e) => setError(errorMessage(e)));
    api<CategoriesResponse>("GET", "/categories").then(setTopics).catch(() => undefined);
    api<{ languages: Language[] }>("GET", "/languages").then((data) => setLanguages(data.languages)).catch(() => undefined);
  }, []);

  function toggleTheme(id: number) {
    setSaved(false);
    setThemes((current) => {
      const next = { ...current };
      if (id in next) delete next[id];
      else next[id] = false;
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const data = await api<{ profile: OwnTranslatorProfile }>("PATCH", "/translators/me", {
        dateOfBirth: birth || null,
        topikLevel: topik ? Number(topik) : null,
        pricePerMinute: Number(price || 0),
        languageIds: langIds,
        themes: Object.entries(themes).map(([id, withCertificate]) => ({ themeId: Number(id), withCertificate })),
      });
      setProfile(data.profile);
      setSaved(true);
      toast.success("Saved");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Themes without a category (for example the emergency call) are shown as their own group.
  const themeGroups = topics
    ? [
        ...topics.categories,
        ...(topics.uncategorizedThemes.length > 0
          ? [{ id: -1, name: "Other topics", themes: topics.uncategorizedThemes }]
          : []),
      ]
    : [];
  const complete = langIds.length > 0 && Object.keys(themes).length > 0 && Number(price) > 0;

  return (
    <div className="screen no-tabs">
      <TopBar title="Complete your profile" backTo="/profile" />
      <div className="body">
        {profile && <div className="alert info">{STATUS_TEXT[profile.verificationStatus]}</div>}
        {error && <div className="alert error">{error}</div>}
        {saved && (
          <div className="alert ok">
            Saved.{" "}
            <button style={{ textDecoration: "underline" }} onClick={() => navigate("/")}>
              Go to the home screen
            </button>
          </div>
        )}

        <AvatarPicker />
        <Field label="Full name" icon="user" value={user?.fullName ?? ""} readOnly />
        <Field label="Phone number" icon="phone" value={user?.phone ?? ""} readOnly />
        <Field label="Date of birth" icon="info" type="date" value={birth} onChange={(e) => { setBirth(e.target.value); setSaved(false); }} />
        <div className="field">
          <label>Korean level (TOPIK)</label>
          <div className="input-wrap">
            <select value={topik} onChange={(e) => { setTopik(e.target.value); setSaved(false); }}>
              <option value="">Not specified</option>
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <option key={level} value={level}>
                  Level {level}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Field label="Price per minute (won)" icon="plus" inputMode="numeric" placeholder="For example 1500" value={price} onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setSaved(false); }} />

        <h2 className="section-title">Available translation languages</h2>
        <div className="chips">
          {languages.map((language) => (
            <button
              key={language.id}
              className={langIds.includes(language.id) ? "chip active" : "chip"}
              onClick={() => {
                setSaved(false);
                setLangIds((current) =>
                  current.includes(language.id) ? current.filter((id) => id !== language.id) : [...current, language.id],
                );
              }}
            >
              {language.name}
            </button>
          ))}
        </div>

        <h2 className="section-title">Topics for translation</h2>
        {themeGroups.map((category) => (
          <div key={category.id} style={{ marginBottom: 14 }}>
            <p className="subtle" style={{ marginBottom: 6, fontWeight: 700 }}>
              {category.name}
            </p>
            {category.themes.map((theme) => (
              <div key={theme.id} className="row" style={{ padding: "6px 0" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input type="checkbox" checked={theme.id in themes} onChange={() => toggleTheme(theme.id)} />
                  {theme.name}
                </label>
                {theme.id in themes && (
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
                    <input
                      type="checkbox"
                      checked={themes[theme.id] === true}
                      onChange={(e) => {
                        setSaved(false);
                        setThemes((current) => ({ ...current, [theme.id]: e.target.checked }));
                      }}
                    />
                    with certificate
                  </label>
                )}
              </div>
            ))}
          </div>
        ))}

        {!complete && <p className="subtle" style={{ marginTop: 10 }}>Choose at least one language, one topic and set a price.</p>}
        <button className="btn orange" style={{ marginTop: 10 }} disabled={busy || !complete} onClick={save}>
          {busy ? "Please wait..." : "Save"}
        </button>
      </div>
    </div>
  );
}
