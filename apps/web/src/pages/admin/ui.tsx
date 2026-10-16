import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";

export function AdminLogo() {
  return (
    <span className="adm-logo">
      m<span className="o1">o</span>rag<span className="o2">o</span>
    </span>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <div className="adm-crumbs">
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 && " / "}
          {item.to ? <Link to={item.to}>{item.label}</Link> : item.label}
        </span>
      ))}
    </div>
  );
}

interface PageHeadProps {
  title: string;
  crumbs: Crumb[];
  search?: string;
  onSearch?: (value: string) => void;
  filter?: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder: string };
  actions?: { value: string; label: string }[];
  onApply?: (action: string) => void;
  addLabel?: string;
  onAdd?: () => void;
}

// Title, breadcrumbs, search and the "Filter / Choose action / Apply" row from the mockups.
export function PageHead({ title, crumbs, search, onSearch, filter, actions, onApply, addLabel, onAdd }: PageHeadProps) {
  const [text, setText] = useState(search ?? "");
  const [action, setAction] = useState("");

  useEffect(() => {
    if (onSearch === undefined) return;
    const id = setTimeout(() => onSearch(text.trim()), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="adm-head">
      <div>
        <h1>{title}</h1>
        <Crumbs items={crumbs} />
      </div>
      {(onSearch || filter || actions || onAdd) && (
        <div className="adm-tools">
          {onAdd && (
            <button className="adm-apply" onClick={onAdd}>
              + {addLabel ?? "Add"}
            </button>
          )}
          {onSearch && (
            <label className="adm-search">
              <Icon name="search" size={15} />
              <input placeholder="Search by name or phone" value={text} onChange={(event) => setText(event.target.value)} />
            </label>
          )}
          <div className="adm-filters">
            {filter && (
              <select className="adm-select" value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
                <option value="">{filter.placeholder}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {actions && (
              <>
                <select className="adm-select" value={action} onChange={(event) => setAction(event.target.value)}>
                  <option value="">Choose action</option>
                  {actions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <button className="adm-apply" disabled={!action} onClick={() => onApply?.(action)}>
                  Apply
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5);
  return (
    <div className="adm-pager">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Prev
      </button>
      {pages.map((value) => (
        <button key={value} className={value === page ? "on" : ""} onClick={() => onChange(value)}>
          {value}
        </button>
      ))}
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function Th({ children, sortable = true }: { children?: ReactNode; sortable?: boolean }) {
  return (
    <th>
      {children}
      {sortable && children ? <span className="sort">{"▾"}</span> : null}
    </th>
  );
}

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="adm-modal-bg" onClick={onClose}>
      <div className="adm-modal" onClick={(event) => event.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">
          {"✕"}
        </button>
        {children}
      </div>
    </div>
  );
}

export function PhotoPlaceholder({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="photo"
      style={{
        background: "linear-gradient(160deg,#c6d6dc,#8fa9b3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 52,
        fontWeight: 800,
        color: "rgba(255,255,255,0.9)",
      }}
    >
      {letter}
    </div>
  );
}

export function usePaged<T>(load: (page: number) => Promise<{ items: T[]; totalPages: number }>, deps: unknown[]) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // A new search or filter always starts again from the first page.
  useEffect(() => {
    setPage(1);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    load(page)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotalPages(Math.max(1, data.totalPages));
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setItems([]);
        setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tick, ...deps]);

  return { page, setPage, items, totalPages, error, reload: () => setTick((value) => value + 1) };
}

export function money(value: number): string {
  return value.toLocaleString("en-US");
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
