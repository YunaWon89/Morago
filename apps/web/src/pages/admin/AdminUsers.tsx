import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { api, errorMessage } from "../../lib/api";
import { formatDuration } from "../../lib/format";
import type { CallDto, Paginated } from "../../lib/types";
import { Crumbs, Modal, PageHead, Pager, PhotoPlaceholder, Th, dateTime, money, usePaged } from "./ui";

interface AdminUser {
  id: number;
  phone: string;
  email: string | null;
  fullName: string;
  role: string;
  status: "ACTIVE" | "BLOCKED";
  blockReason: string | null;
  balance?: number;
}

interface UserDetails extends AdminUser {
  wallet: { balance: number; currency: string } | null;
}

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState<AdminUser | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const list = usePaged<AdminUser>(async (page) => {
    const query = new URLSearchParams({ role: "USER", page: String(page), limit: "10" });
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    const data = await api<Paginated<AdminUser>>("GET", `/admin/users?${query}`);
    const [details, topups] = await Promise.all([
      Promise.all(data.items.map((user) => api<{ user: UserDetails }>("GET", `/admin/users/${user.id}`).catch(() => null))),
      api<{ items: { userId: number }[] }>("GET", "/admin/topups?status=PENDING&limit=100").catch(() => ({ items: [] })),
    ]);
    setPending(new Set(topups.items.map((row) => row.userId)));
    return {
      totalPages: data.totalPages,
      items: data.items.map((user, index) => ({ ...user, balance: details[index]?.user.wallet?.balance ?? 0 })),
    };
  }, [search, status]);

  async function apply(action: string) {
    if (selected.length === 0) {
      setMessage("Select users with the checkboxes first");
      return;
    }
    setMessage(null);
    const results = await Promise.allSettled(
      selected.map((id) =>
        action === "block"
          ? api("POST", `/admin/users/${id}/block`, { reason: "Blocked by administrator" })
          : api("POST", `/admin/users/${id}/unblock`),
      ),
    );
    const failed = results.filter((result) => result.status === "rejected").length;
    setMessage(failed ? `${failed} of ${selected.length} could not be changed` : "Done");
    setSelected([]);
    list.reload();
  }

  const items = list.items ?? [];

  return (
    <>
      <PageHead
        title="Users list"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Lists", to: "/admin/users" }, { label: "Users" }]}
        onSearch={setSearch}
        filter={{
          value: status,
          onChange: setStatus,
          placeholder: "Filter",
          options: [
            { value: "ACTIVE", label: "Active" },
            { value: "BLOCKED", label: "Blocked" },
          ],
        }}
        actions={[
          { value: "block", label: "Block selected" },
          { value: "unblock", label: "Unblock selected" },
        ]}
        onApply={apply}
      />
      {message && <div className="adm-err" style={{ background: "#eef6ff", color: "#245" }}>{message}</div>}
      {list.error && <div className="adm-err">{list.error}</div>}

      <table className="adm-table">
        <thead>
          <tr>
            <Th sortable={false}>
              <input
                type="checkbox"
                checked={items.length > 0 && selected.length === items.length}
                onChange={(event) => setSelected(event.target.checked ? items.map((item) => item.id) : [])}
              />
            </Th>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Balance</Th>
            <Th>Deposit request</Th>
            <Th>Call</Th>
            <Th>Deposit</Th>
            <Th>Status</Th>
            <Th sortable={false} />
          </tr>
        </thead>
        <tbody>
          {items.map((user) => (
            <tr key={user.id}>
              <td className="cb">
                <input
                  type="checkbox"
                  checked={selected.includes(user.id)}
                  onChange={(event) =>
                    setSelected((current) => (event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id)))
                  }
                />
              </td>
              <td>{user.fullName}</td>
              <td>{user.phone}</td>
              <td>{money(user.balance ?? 0)}</td>
              <td>
                {pending.has(user.id) ? (
                  <Link to="/admin/topups" className="adm-pill pending">
                    Request {"›"}
                  </Link>
                ) : (
                  "None"
                )}
              </td>
              <td>
                <Link className="adm-link" to={`/admin/users/${user.id}/calls`}>
                  View {"›"}
                </Link>
              </td>
              <td>
                <Link className="adm-link" to={`/admin/users/${user.id}/deposits`}>
                  View {"›"}
                </Link>
              </td>
              <td>{user.status === "BLOCKED" ? <span className="adm-pill bad">Blocked</span> : "Active"}</td>
              <td>
                <button className="adm-eye" onClick={() => setOpen(user)} aria-label="Open">
                  <Icon name="eye" size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.items !== null && items.length === 0 && <div className="adm-empty">No users found</div>}
      <Pager page={list.page} totalPages={list.totalPages} onChange={list.setPage} />

      {open && <UserModal user={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  );
}

function UserModal({ user, onClose, onChanged }: { user: AdminUser; onClose: () => void; onChanged: () => void }) {
  const navigate = useNavigate();
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<{ user: UserDetails }>("GET", `/admin/users/${user.id}`)
      .then((data) => setDetails(data.user))
      .catch(() => undefined);
  };
  useEffect(load, [user.id]);

  async function toggle() {
    setError(null);
    try {
      if (details?.status === "BLOCKED") {
        await api("POST", `/admin/users/${user.id}/unblock`);
      } else {
        await api("POST", `/admin/users/${user.id}/block`, { reason });
        setBlocking(false);
      }
      load();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const blocked = details?.status === "BLOCKED";

  return (
    <Modal onClose={onClose}>
      <div className="cover">
        <PhotoPlaceholder name={user.fullName} />
        <div className="actions">
          <button onClick={() => (blocked ? toggle() : setBlocking(true))}>
            {blocked ? "Unblock" : "Block"}
            <Icon name="gear" size={16} />
          </button>
        </div>
      </div>
      <div className="cols">
        <h3>{user.fullName}</h3>
        <dl>
          <dt style={{ marginTop: 0 }}>Phone:</dt>
          <dd>{user.phone}</dd>
          <dt>Email:</dt>
          <dd>{user.email ?? "-"}</dd>
          <dt>Coins:</dt>
          <dd>{money(details?.wallet?.balance ?? user.balance ?? 0)}</dd>
          <dt>Status:</dt>
          <dd>{blocked ? `Blocked (${details?.blockReason ?? ""})` : "Active"}</dd>
        </dl>
      </div>
      {blocking && (
        <div style={{ marginTop: 14 }}>
          <input className="adm-input-dark" placeholder="Reason for blocking" value={reason} onChange={(event) => setReason(event.target.value)} />
          <button className="adm-black" disabled={reason.trim().length < 3} onClick={toggle}>
            Confirm block
          </button>
        </div>
      )}
      {error && <div className="adm-err">{error}</div>}
      <div style={{ marginTop: 18 }}>
        <button className="adm-black" onClick={() => navigate(`/admin/users/${user.id}/charge`)}>
          <span style={{ background: "#fff", color: "#111", width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>$</span>
          Charge {"›"}
        </button>
      </div>
    </Modal>
  );
}

function useUser(id: number) {
  const [user, setUser] = useState<UserDetails | null>(null);
  useEffect(() => {
    api<{ user: UserDetails }>("GET", `/admin/users/${id}`)
      .then((data) => setUser(data.user))
      .catch(() => undefined);
  }, [id]);
  return user;
}

export function AdminCharge() {
  const params = useParams();
  const id = Number(params.id);
  const navigate = useNavigate();
  const user = useUser(id);
  const [amount, setAmount] = useState("20000");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ balance: number }>("POST", `/admin/users/${id}/charge`, { amount: Number(amount) });
      setDone(`Done. The new balance is ${money(data.balance)} won.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Charge</h1>
          <Crumbs items={[{ label: "Home", to: "/admin" }, { label: "Lists", to: "/admin/users" }, { label: "Users", to: "/admin/users" }, { label: "Charge" }]} />
        </div>
      </div>
      <div className="adm-card">
        <div className="f">
          <label>User</label>
          <input readOnly value={user?.fullName ?? ""} />
        </div>
        <div className="f">
          <label>Phone</label>
          <input readOnly value={user?.phone ?? ""} />
        </div>
        <div className="f">
          <label>Label</label>
          <small>If the amount is incorrect, specify an arbitrary amount.</small>
          <input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} />
        </div>
        {user?.wallet && <small>Current balance: {money(user.wallet.balance)} won</small>}
      </div>
      {error && <div className="adm-err" style={{ maxWidth: 460, margin: "14px auto 0" }}>{error}</div>}
      {done && <div className="adm-err" style={{ maxWidth: 460, margin: "14px auto 0", background: "#e3f5d9", color: "#2a7a00" }}>{done}</div>}
      <div className="adm-buttons">
        <button className="adm-gray" onClick={() => navigate("/admin/users")}>
          Back
        </button>
        <button className="adm-black" disabled={busy || !Number(amount) || done !== null} onClick={confirm}>
          Deposit Confirm
        </button>
      </div>
    </>
  );
}

// Calls of one person (a client or a translator). Used by both lists.
export function AdminCallHistory({ kind }: { kind: "user" | "translator" }) {
  const id = Number(useParams().id);
  const user = useUser(id);
  const list = usePaged<CallDto>(async (page) => {
    const data = await api<Paginated<CallDto>>("GET", `/admin/calls?userId=${id}&page=${page}&limit=10`);
    return data;
  }, [id]);
  const home = kind === "user" ? "/admin/users" : "/admin/translators";

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Call history [{user?.fullName ?? "..."}]</h1>
          <Crumbs
            items={[
              { label: "Home", to: "/admin" },
              { label: "Lists", to: home },
              { label: kind === "user" ? "Users" : "Translators", to: home },
              { label: "Call history" },
            ]}
          />
        </div>
      </div>
      <table className="adm-table">
        <thead>
          <tr>
            <Th sortable={false} />
            <Th>Call</Th>
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
              <td className="cb">
                <input type="checkbox" />
              </td>
              <td>{kind === "user" ? call.translator.fullName : call.client.fullName}</td>
              <td>{dateTime(call.requestedAt)}</td>
              <td>{call.durationSec ? formatDuration(call.durationSec) : "-"}</td>
              <td>{call.totalCost ? `${kind === "user" ? "-" : "+"} ${money(call.totalCost)}` : "-"}</td>
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

interface TxRow {
  id: number;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
}

export function AdminDepositHistory() {
  const id = Number(useParams().id);
  const user = useUser(id);
  const list = usePaged<TxRow>(async (page) => {
    const data = await api<{ items: TxRow[]; totalPages: number }>("GET", `/admin/users/${id}/transactions?page=${page}&limit=10`);
    return { items: data.items.filter((row) => row.type === "TOPUP" || row.type === "ADMIN_CHARGE"), totalPages: data.totalPages };
  }, [id]);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Deposit history [{user?.fullName ?? "..."}]</h1>
          <Crumbs items={[{ label: "Home", to: "/admin" }, { label: "Lists", to: "/admin/users" }, { label: "Users", to: "/admin/users" }, { label: "Deposit history" }]} />
        </div>
      </div>
      <table className="adm-table">
        <thead>
          <tr>
            <Th sortable={false} />
            <Th>Deposit</Th>
            <Th>Date</Th>
            <Th>Coins</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {(list.items ?? []).map((row) => (
            <tr key={row.id}>
              <td className="cb">
                <input type="checkbox" />
              </td>
              <td>{row.type === "ADMIN_CHARGE" ? "Charge by administrator" : "Top-up by transfer"}</td>
              <td>{dateTime(row.createdAt)}</td>
              <td>+ {money(row.amount)}</td>
              <td>{row.status === "COMPLETED" ? "Confirmed" : row.status === "PENDING" ? "Pending" : "Declined"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.items !== null && list.items.length === 0 && <div className="adm-empty">No deposits yet</div>}
      <Pager page={list.page} totalPages={list.totalPages} onChange={list.setPage} />
    </>
  );
}
