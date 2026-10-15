import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { formatDuration } from "../../lib/format";
import type { CallDto, CategoriesResponse, Category, Paginated, Theme } from "../../lib/types";
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

function useTopics() {
  const [data, setData] = useState<CategoriesResponse | null>(null);
  useEffect(() => {
    api<CategoriesResponse>("GET", "/categories")
      .then(setData)
      .catch(() => setData({ categories: [], uncategorizedThemes: [] }));
  }, []);
  return data;
}

export function AdminThemes() {
  const data = useTopics();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<{ theme: Theme; category: string } | null>(null);

  const rows = useMemo(() => {
    const all = [
      ...(data?.categories ?? []).flatMap((category) => category.themes.map((theme) => ({ theme, category: category.name }))),
      ...(data?.uncategorizedThemes ?? []).map((theme) => ({ theme, category: "-" })),
    ];
    const text = search.toLowerCase();
    return all.filter((row) => !text || row.theme.name.toLowerCase().includes(text) || (row.theme.nameKo ?? "").includes(text));
  }, [data, search]);

  useEffect(() => setPage(1), [search]);
  const perPage = 12;
  const visible = rows.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <PageHead
        title="Themes"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Translation topics" }, { label: "Themes" }]}
        onSearch={setSearch}
      />
      <table className="adm-table">
        <thead>
          <tr>
            <Th sortable={false} />
            <Th>Themes</Th>
            <Th>Korean</Th>
            <Th>Categories</Th>
            <Th>Status</Th>
            <Th sortable={false} />
          </tr>
        </thead>
        <tbody>
          {visible.map(({ theme, category }) => (
            <tr key={theme.id}>
              <td className="cb">
                <input type="checkbox" />
              </td>
              <td>{theme.name}</td>
              <td>{theme.nameKo ?? "-"}</td>
              <td>{theme.isEmergency ? "Emergency" : category}</td>
              <td>Active</td>
              <td>
                <button className="adm-eye" onClick={() => setOpen({ theme, category })} aria-label="Open">
                  <Icon name="eye" size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data !== null && rows.length === 0 && <div className="adm-empty">Nothing found</div>}
      <Pager page={page} totalPages={Math.max(1, Math.ceil(rows.length / perPage))} onChange={setPage} />

      {open && (
        <Modal onClose={() => setOpen(null)}>
          <div className="cover">
            <div className="photo" style={{ background: "#aab5bd" }} />
          </div>
          <div className="cols">
            <h3>{open.theme.name}</h3>
            <dl>
              <dt style={{ marginTop: 0 }}>Category:</dt>
              <dd>{open.category}</dd>
              <dt>Korean name:</dt>
              <dd>{open.theme.nameKo ?? "-"}</dd>
              <dt>Status:</dt>
              <dd>Active</dd>
            </dl>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AdminCategories() {
  const data = useTopics();
  const [open, setOpen] = useState<Category | null>(null);

  return (
    <>
      <PageHead title="Categories" crumbs={[{ label: "Home", to: "/admin" }, { label: "Translation topics" }, { label: "Categories" }]} />
      <table className="adm-table">
        <thead>
          <tr>
            <Th sortable={false} />
            <Th>Categories</Th>
            <Th>Themes</Th>
            <Th>Status</Th>
            <Th sortable={false} />
          </tr>
        </thead>
        <tbody>
          {(data?.categories ?? []).map((category) => (
            <tr key={category.id}>
              <td className="cb">
                <input type="checkbox" />
              </td>
              <td>{category.name}</td>
              <td>{category.themes.length}</td>
              <td>Active</td>
              <td>
                <button className="adm-eye" onClick={() => setOpen(category)} aria-label="Open">
                  <Icon name="eye" size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && (
        <Modal onClose={() => setOpen(null)}>
          <div className="cover">
            <div className="photo" style={{ background: "#aab5bd" }} />
          </div>
          <div className="cols">
            <h3>{open.name}</h3>
            <dl>
              <dt style={{ marginTop: 0 }}>Themes:</dt>
              {open.themes.map((theme) => (
                <dd key={theme.id}>{theme.name}</dd>
              ))}
              <dt>Status:</dt>
              <dd>Active</dd>
            </dl>
          </div>
        </Modal>
      )}
    </>
  );
}
