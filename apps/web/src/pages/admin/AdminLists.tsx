import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { api, errorMessage } from "../../lib/api";
import { formatDuration } from "../../lib/format";
import type { CallDto, Paginated } from "../../lib/types";
import { Modal, PageHead, Pager, Th, dateTime, money, usePaged } from "./ui";

export function AdminCalls() {
  const [status, setStatus] = useState("");
  const list = usePaged<CallDto>(
    (page) => api<Paginated<CallDto>>("GET", `/admin/calls?page=${page}&limit=10${status ? `&status=${status}` : ""}`),
    [status],
  );

  return (
    <>
      <PageHead
        title="Calls"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Lists", to: "/admin/users" }, { label: "Calls" }]}
        filter={{
          value: status,
          onChange: setStatus,
          placeholder: "Filter",
          options: [
            { value: "ENDED", label: "Finished" },
            { value: "MISSED", label: "Missed" },
            { value: "REJECTED", label: "Declined" },
            { value: "ACTIVE", label: "In progress" },
          ],
        }}
      />
      <table className="adm-table">
        <thead>
          <tr>
            <Th>Client</Th>
            <Th>Translator</Th>
            <Th>Date</Th>
            <Th>Duration</Th>
            <Th>Coins</Th>
            <Th>Theme</Th>
            <Th>Status</Th>
            <Th>Rating</Th>
          </tr>
        </thead>
        <tbody>
          {(list.items ?? []).map((call) => (
            <tr key={call.id}>
              <td>{call.client.fullName}</td>
              <td>{call.translator.fullName}</td>
              <td>{dateTime(call.requestedAt)}</td>
              <td>{call.durationSec ? formatDuration(call.durationSec) : "-"}</td>
              <td>{call.totalCost ? money(call.totalCost) : "-"}</td>
              <td>{call.theme.name}</td>
              <td>{call.status.toLowerCase()}</td>
              <td>
                {call.review ? (
                  <span className="adm-star">
                    {"★".repeat(call.review.rating)}
                    <span style={{ color: "#ddd" }}>{"★".repeat(5 - call.review.rating)}</span>
                  </span>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.items !== null && list.items.length === 0 && <div className="adm-empty">No calls yet</div>}
      <Pager page={list.page} totalPages={list.totalPages} onChange={list.setPage} />
    </>
  );
}

interface AdminCategory {
  id: number;
  name: string;
  isActive: boolean;
  _count: { themes: number };
}

interface AdminTheme {
  id: number;
  name: string;
  nameKo: string | null;
  description: string | null;
  categoryId: number | null;
  isEmergency: boolean;
  isActive: boolean;
  category: { id: number; name: string } | null;
}

function useAdminList<T>(path: string, key: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api<Record<string, T[]>>("GET", path)
      .then((data) => setItems(data[key] ?? []))
      .catch((e) => {
        setItems([]);
        setError(errorMessage(e));
      });
  }, [path, key, tick]);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { items, error, reload };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12, fontSize: 12, fontWeight: 600 }}>
      {label}
      <div style={{ marginTop: 5 }}>{children}</div>
    </label>
  );
}

export function AdminThemes() {
  const themes = useAdminList<AdminTheme>("/admin/themes", "themes");
  const categories = useAdminList<AdminCategory>("/admin/categories", "categories");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ id: number | null; name: string; nameKo: string; categoryId: string; isEmergency: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const text = search.toLowerCase();
    return (themes.items ?? []).filter(
      (theme) => !text || theme.name.toLowerCase().includes(text) || (theme.nameKo ?? "").includes(text),
    );
  }, [themes.items, search]);

  useEffect(() => setPage(1), [search]);
  const perPage = 12;
  const visible = rows.slice((page - 1) * perPage, page * perPage);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setForm(null);
      themes.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!form) return;
    const body = {
      name: form.name.trim(),
      nameKo: form.nameKo.trim() || null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      isEmergency: form.isEmergency,
    };
    void run(() => (form.id ? api("PATCH", `/admin/themes/${form.id}`, body) : api("POST", "/admin/themes", body)));
  }

  return (
    <>
      <PageHead
        title="Themes"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Translation topics" }, { label: "Themes" }]}
        onSearch={setSearch}
        addLabel="Add theme"
        onAdd={() => {
          setError(null);
          setForm({ id: null, name: "", nameKo: "", categoryId: "", isEmergency: false });
        }}
      />
      {themes.error && <div className="alert error">{themes.error}</div>}
      <table className="adm-table">
        <thead>
          <tr>
            <Th>Themes</Th>
            <Th>Korean</Th>
            <Th>Categories</Th>
            <Th>Status</Th>
            <Th sortable={false} />
          </tr>
        </thead>
        <tbody>
          {visible.map((theme) => (
            <tr key={theme.id}>
              <td>{theme.name}</td>
              <td>{theme.nameKo ?? "-"}</td>
              <td>{theme.isEmergency ? "Emergency" : (theme.category?.name ?? "-")}</td>
              <td>{theme.isActive ? "Active" : "Hidden"}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button
                  className="adm-eye"
                  aria-label="Edit"
                  onClick={() => {
                    setError(null);
                    setForm({
                      id: theme.id,
                      name: theme.name,
                      nameKo: theme.nameKo ?? "",
                      categoryId: theme.categoryId ? String(theme.categoryId) : "",
                      isEmergency: theme.isEmergency,
                    });
                  }}
                >
                  <Icon name="eye" size={16} />
                </button>{" "}
                <button
                  className="adm-eye"
                  style={{ fontSize: 11, textDecoration: "underline" }}
                  onClick={() => run(() => api("PATCH", `/admin/themes/${theme.id}`, { isActive: !theme.isActive }))}
                >
                  {theme.isActive ? "Hide" : "Show"}
                </button>{" "}
                <button
                  className="adm-eye"
                  style={{ fontSize: 11, textDecoration: "underline", color: "#c0392b" }}
                  onClick={() => {
                    if (window.confirm(`Delete "${theme.name}"? Used themes are hidden instead.`)) {
                      void run(() => api("DELETE", `/admin/themes/${theme.id}`));
                    }
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {themes.items !== null && rows.length === 0 && <div className="adm-empty">Nothing found</div>}
      <Pager page={page} totalPages={Math.max(1, Math.ceil(rows.length / perPage))} onChange={setPage} />

      {form && (
        <Modal onClose={() => setForm(null)}>
          <div style={{ padding: 22, minWidth: 320 }}>
            <h3 style={{ marginBottom: 14 }}>{form.id ? "Edit theme" : "New theme"}</h3>
            {error && <div className="alert error">{error}</div>}
            <Row label="Name">
              <input className="adm-input-dark" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Row>
            <Row label="Korean name">
              <input className="adm-input-dark" value={form.nameKo} onChange={(e) => setForm({ ...form, nameKo: e.target.value })} />
            </Row>
            <Row label="Category">
              <select className="adm-input-dark" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">No category</option>
                {(categories.items ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Row>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 14 }}>
              <input type="checkbox" checked={form.isEmergency} onChange={(e) => setForm({ ...form, isEmergency: e.target.checked })} />
              Emergency topic
            </label>
            <button className="adm-btn-dark" disabled={busy || form.name.trim().length < 1} onClick={save}>
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AdminCategories() {
  const list = useAdminList<AdminCategory>("/admin/categories", "categories");
  const [form, setForm] = useState<{ id: number | null; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setForm(null);
      list.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Categories"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Translation topics" }, { label: "Categories" }]}
        addLabel="Add category"
        onAdd={() => {
          setError(null);
          setForm({ id: null, name: "" });
        }}
      />
      {list.error && <div className="alert error">{list.error}</div>}
      <table className="adm-table">
        <thead>
          <tr>
            <Th>Categories</Th>
            <Th>Themes</Th>
            <Th>Status</Th>
            <Th sortable={false} />
          </tr>
        </thead>
        <tbody>
          {(list.items ?? []).map((category) => (
            <tr key={category.id}>
              <td>{category.name}</td>
              <td>{category._count.themes}</td>
              <td>{category.isActive ? "Active" : "Hidden"}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button
                  className="adm-eye"
                  aria-label="Edit"
                  onClick={() => {
                    setError(null);
                    setForm({ id: category.id, name: category.name });
                  }}
                >
                  <Icon name="eye" size={16} />
                </button>{" "}
                <button
                  className="adm-eye"
                  style={{ fontSize: 11, textDecoration: "underline" }}
                  onClick={() => run(() => api("PATCH", `/admin/categories/${category.id}`, { isActive: !category.isActive }))}
                >
                  {category.isActive ? "Hide" : "Show"}
                </button>{" "}
                <button
                  className="adm-eye"
                  style={{ fontSize: 11, textDecoration: "underline", color: "#c0392b" }}
                  onClick={() => {
                    if (window.confirm(`Delete "${category.name}"? A category with themes is hidden instead.`)) {
                      void run(() => api("DELETE", `/admin/categories/${category.id}`));
                    }
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.items !== null && list.items.length === 0 && <div className="adm-empty">No categories yet</div>}

      {form && (
        <Modal onClose={() => setForm(null)}>
          <div style={{ padding: 22, minWidth: 320 }}>
            <h3 style={{ marginBottom: 14 }}>{form.id ? "Edit category" : "New category"}</h3>
            {error && <div className="alert error">{error}</div>}
            <Row label="Name">
              <input className="adm-input-dark" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Row>
            <button
              className="adm-btn-dark"
              disabled={busy || form.name.trim().length < 1}
              onClick={() =>
                run(() =>
                  form.id
                    ? api("PATCH", `/admin/categories/${form.id}`, { name: form.name.trim() })
                    : api("POST", "/admin/categories", { name: form.name.trim() }),
                )
              }
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

interface AdminLanguage {
  id: number;
  code: string;
  name: string;
  _count: { translators: number; calls: number };
}

export function AdminLanguages() {
  const list = useAdminList<AdminLanguage>("/admin/languages", "languages");
  const [form, setForm] = useState<{ id: number | null; code: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setForm(null);
      list.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Languages"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Translation topics" }, { label: "Languages" }]}
        addLabel="Add language"
        onAdd={() => {
          setError(null);
          setForm({ id: null, code: "", name: "" });
        }}
      />
      {(list.error || error) && !form && <div className="alert error">{list.error ?? error}</div>}
      <table className="adm-table">
        <thead>
          <tr>
            <Th>Language</Th>
            <Th>Code</Th>
            <Th>Translators</Th>
            <Th>Calls</Th>
            <Th sortable={false} />
          </tr>
        </thead>
        <tbody>
          {(list.items ?? []).map((language) => (
            <tr key={language.id}>
              <td>{language.name}</td>
              <td>{language.code}</td>
              <td>{language._count.translators}</td>
              <td>{language._count.calls}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button
                  className="adm-eye"
                  aria-label="Edit"
                  onClick={() => {
                    setError(null);
                    setForm({ id: language.id, code: language.code, name: language.name });
                  }}
                >
                  <Icon name="eye" size={16} />
                </button>{" "}
                <button
                  className="adm-eye"
                  style={{ fontSize: 11, textDecoration: "underline", color: "#c0392b" }}
                  onClick={() => {
                    if (window.confirm(`Delete "${language.name}"? A language that is already used cannot be deleted.`)) {
                      void run(() => api("DELETE", `/admin/languages/${language.id}`));
                    }
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.items !== null && list.items.length === 0 && <div className="adm-empty">No languages yet</div>}

      {form && (
        <Modal onClose={() => setForm(null)}>
          <div style={{ padding: 22, minWidth: 320 }}>
            <h3 style={{ marginBottom: 14 }}>{form.id ? "Edit language" : "New language"}</h3>
            {error && <div className="alert error">{error}</div>}
            <Row label="Name">
              <input className="adm-input-dark" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Row>
            <Row label="Code (for example en, ru, vi)">
              <input className="adm-input-dark" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Row>
            <button
              className="adm-btn-dark"
              disabled={busy || form.name.trim().length < 1 || form.code.trim().length < 2}
              onClick={() =>
                run(() => {
                  const body = { name: form.name.trim(), code: form.code.trim().toLowerCase() };
                  return form.id ? api("PATCH", `/admin/languages/${form.id}`, body) : api("POST", "/admin/languages", body);
                })
              }
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
