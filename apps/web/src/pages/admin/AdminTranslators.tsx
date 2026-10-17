import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { api, errorMessage } from "../../lib/api";
import type { TranslatorCard } from "../../lib/types";
import { Modal, PageHead, Pager, PhotoPlaceholder, Th, money } from "./ui";

type Verification = "REGISTERED" | "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED";

interface Row {
  id: number;
  fullName: string;
  phone: string;
  email: string | null;
  userStatus: "ACTIVE" | "BLOCKED";
  verificationStatus: Verification;
  topikLevel: number | null;
  pricePerMinute: number;
  isOnline: boolean;
}

interface PayoutRow {
  id: number;
  translatorId: number;
  status: string;
}

const LABEL: Record<Verification, string> = {
  APPROVED: "Verified",
  REGISTERED: "Unverified",
  INTERVIEW_SCHEDULED: "Interview",
  REJECTED: "Rejected",
};

export function AdminTranslators() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pending, setPending] = useState<Map<number, number>>(new Map());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    api<{ items: Row[] }>("GET", `/admin/translators?limit=100${status ? `&status=${status}` : ""}`)
      .then((data) => setRows(data.items))
      .catch((e) => {
        setRows([]);
        setError(errorMessage(e));
      });
    api<{ items: PayoutRow[] }>("GET", "/admin/payouts?status=PENDING&limit=100")
      .then((data) => setPending(new Map(data.items.map((item) => [item.translatorId, item.id]))))
      .catch(() => undefined);
  };
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const text = search.toLowerCase();
    return (rows ?? []).filter(
      (row) => !text || row.fullName.toLowerCase().includes(text) || row.phone.includes(text) || (row.email ?? "").toLowerCase().includes(text),
    );
  }, [rows, search]);

  useEffect(() => setPage(1), [search, status]);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((page - 1) * perPage, page * perPage);

  async function apply(action: string) {
    if (selected.length === 0) {
      setMessage("Select translators with the checkboxes first");
      return;
    }
    const results = await Promise.allSettled(
      selected.map((id) => api("PATCH", `/admin/translators/${id}/verification`, { status: action })),
    );
    const failed = results.filter((result) => result.status === "rejected").length;
    setMessage(failed ? `${failed} of ${selected.length} could not be changed` : "Done");
    setSelected([]);
    load();
  }

  return (
    <>
      <PageHead
        title="Translators list"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Lists", to: "/admin/users" }, { label: "Translators" }]}
        onSearch={setSearch}
        filter={{
          value: status,
          onChange: setStatus,
          placeholder: "Filter",
          options: [
            { value: "REGISTERED", label: "Unverified" },
            { value: "INTERVIEW_SCHEDULED", label: "Interview" },
            { value: "APPROVED", label: "Verified" },
            { value: "REJECTED", label: "Rejected" },
          ],
        }}
        actions={[
          { value: "APPROVED", label: "Approve selected" },
          { value: "INTERVIEW_SCHEDULED", label: "Schedule interview" },
          { value: "REJECTED", label: "Reject selected" },
        ]}
        onApply={apply}
      />
      {message && <div className="adm-err" style={{ background: "#eef6ff", color: "#245" }}>{message}</div>}
      {error && <div className="adm-err">{error}</div>}

      <table className="adm-table">
        <thead>
          <tr>
            <Th sortable={false}>
              <input
                type="checkbox"
                checked={visible.length > 0 && selected.length === visible.length}
                onChange={(event) => setSelected(event.target.checked ? visible.map((row) => row.id) : [])}
              />
            </Th>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Email</Th>
            <Th>Topik</Th>
            <Th>Status</Th>
            <Th>Withdraw request</Th>
            <Th>Call</Th>
            <Th>Withdraw</Th>
            <Th sortable={false} />
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id}>
              <td className="cb">
                <input
                  type="checkbox"
                  checked={selected.includes(row.id)}
                  onChange={(event) =>
                    setSelected((current) => (event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)))
                  }
                />
              </td>
              <td>{row.fullName}</td>
              <td>{row.phone}</td>
              <td>{row.email ?? "-"}</td>
              <td>{row.topikLevel ? `${row.topikLevel} level` : "-"}</td>
              <td>{LABEL[row.verificationStatus]}</td>
              <td>
                {pending.has(row.id) ? (
                  <Link to={`/admin/payouts/${pending.get(row.id)}`} className="adm-pill pending">
                    Request {"›"}
                  </Link>
                ) : (
                  "None"
                )}
              </td>
              <td>
                <Link className="adm-link" to={`/admin/translators/${row.id}/calls`}>
                  View {"›"}
                </Link>
              </td>
              <td>
                <Link className="adm-link" to={`/admin/translators/${row.id}/withdrawals`}>
                  View {"›"}
                </Link>
              </td>
              <td>
                <Link className="adm-link" to={`/admin/translators/${row.id}/documents`}>
                  Docs
                </Link>{" "}
                <button className="adm-eye" onClick={() => setOpen(row)} aria-label="Open">
                  <Icon name="eye" size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows !== null && filtered.length === 0 && <div className="adm-empty">No translators found</div>}
      <Pager page={page} totalPages={totalPages} onChange={setPage} />

      {open && <TranslatorModal row={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}

function TranslatorModal({ row, onClose, onChanged }: { row: Row; onClose: () => void; onChanged: () => void }) {
  const [card, setCard] = useState<TranslatorCard | null>(null);
  const [status, setStatus] = useState<Verification>(row.verificationStatus);
  const [error, setError] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    api<{ translator: TranslatorCard }>("GET", `/translators/${row.id}`)
      .then((data) => setCard(data.translator))
      .catch(() => undefined);
  }, [row.id]);

  async function setVerification(next: "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED") {
    setError(null);
    try {
      await api("PATCH", `/admin/translators/${row.id}/verification`, { status: next });
      setStatus(next);
      setShowStatus(false);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="cover">
        <PhotoPlaceholder name={row.fullName} />
        <div className="actions">
          <button onClick={() => setShowStatus((value) => !value)}>
            Status
            <Icon name="gear" size={16} />
          </button>
          {showStatus && (
            <>
              <button onClick={() => setVerification("APPROVED")}>Approve</button>
              <button onClick={() => setVerification("INTERVIEW_SCHEDULED")}>Interview scheduled</button>
              <button onClick={() => setVerification("REJECTED")}>Reject</button>
            </>
          )}
        </div>
      </div>
      <div className="cols">
        <div>
          <h3>{row.fullName}</h3>
          <dl>
            <dt>Translations:</dt>
            <dd>Topics for translation</dd>
            {(card?.themes ?? []).map((theme) => (
              <dd key={theme.id}>
                {theme.name}
                {theme.withCertificate ? " (certificate)" : ""}
              </dd>
            ))}
            <dt>Language:</dt>
            {(card?.languages ?? []).map((language) => (
              <dd key={language.id}>{language.name}</dd>
            ))}
          </dl>
        </div>
        <dl>
          <dt style={{ marginTop: 0 }}>Phone:</dt>
          <dd>{row.phone}</dd>
          <dt>Email:</dt>
          <dd>{row.email ?? "-"}</dd>
          <dt>TOPIK</dt>
          <dd>{row.topikLevel ? `Level ${row.topikLevel}` : "-"}</dd>
          <dt>Price:</dt>
          <dd>{money(row.pricePerMinute)} won / minute</dd>
          <dt>Status:</dt>
          <dd>{LABEL[status]}</dd>
        </dl>
      </div>
      {error && <div className="adm-err">{error}</div>}
    </Modal>
  );
}
