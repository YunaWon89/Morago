import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { categoryEmoji } from "../../lib/topics";
import type { CategoriesResponse } from "../../lib/types";

export function Topics() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [data, setData] = useState<CategoriesResponse | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(
    params.get("category") ? Number(params.get("category")) : null,
  );

  useEffect(() => {
    api<CategoriesResponse>("GET", "/categories")
      .then(setData)
      .catch(() => undefined);
  }, []);

  const query = search.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!data) return [];
    return data.categories
      .map((category) => ({
        ...category,
        themes: category.themes.filter(
          (theme) =>
            !query ||
            theme.name.toLowerCase().includes(query) ||
            (theme.nameKo ?? "").toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.themes.length > 0);
  }, [data, query]);

  return (
    <div className="screen">
      <header className="header">
        <div className="header-row">
          <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <span className="logo">morago</span>
          <span style={{ width: 36 }} />
        </div>
      </header>

      <div className="body">
        <div className="input-wrap" style={{ background: "var(--surface)", border: 0 }}>
          <Icon name="search" size={18} />
          <input placeholder="Search topics" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        <h2 className="section-title">Select a topic to translate</h2>
        {groups.length === 0 && data && <div className="empty">Nothing found</div>}
        {groups.map((category) => {
          const expanded = query !== "" || open === category.id;
          return (
            <div key={category.id} style={{ marginBottom: 14 }}>
              <button
                className="list-item"
                style={{ marginBottom: 0, fontWeight: 700, fontSize: 14, justifyContent: "space-between" }}
                onClick={() => setOpen(expanded && query === "" ? null : category.id)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="emoji" style={{ width: 40, height: 40, borderRadius: 13, background: "var(--teal-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {categoryEmoji(category.name)}
                  </span>
                  {category.name}
                </span>
                <span className="subtle" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}>{"\u25BC"}</span>
              </button>
              {expanded && (
                <div className="grid" style={{ marginTop: 12 }}>
                  {category.themes.map((theme) => (
                    <button
                      key={theme.id}
                      className={selected === theme.id ? "tile selected" : "tile"}
                      onClick={() => setSelected(theme.id)}
                    >
                      <span className="emoji">{categoryEmoji(category.name)}</span>
                      {theme.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <button
          className="btn"
          style={{ marginTop: 18 }}
          disabled={selected === null}
          onClick={() => navigate(`/translators?themeId=${selected}`)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
