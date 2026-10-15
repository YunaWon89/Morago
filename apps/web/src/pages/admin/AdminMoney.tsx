import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../../lib/api";
import type { Paginated } from "../../lib/types";
import { Crumbs, PageHead, Pager, Th, dateTime, money, usePaged } from "./ui";

interface Payout {
  id: number;
  translatorId: number;
  translatorName: string;
  translatorPhone: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  createdAt: string;
}

const PAYOUT_LABEL: Record<Payout["status"], string> = {
  PENDING: "Request",
  APPROVED: "Approved",
  REJECTED: "Declined",
  PAID: "Transfer completed",
};

export function AdminPayouts() {
  const [status, setStatus] = useState("");
  const list = usePaged<Payout>(
    (page) => api<Paginated<Payout>>("GET", `/admin/payouts?page=${page}&limit=10${status ? `&status=${status}` : ""}`),
    [status],
  );

  return (
    <>
      <PageHead
        title="Withdrawals"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Finance" }, { label: "Withdrawals" }]}
        filter={{
          value: status,
          onChange: setStatus,
          placeholder: "Filter",
          options: [
            { value: "PENDING", label: "Waiting" },
            { value: "PAID", label: "Paid" },
            { value: "REJECTED", label: "Declined" },
          ],
        }}
      />
      <table className="adm-table">
        <thead>
          <tr>
            <Th>Translator</Th>
            <Th>Phone</Th>
            <Th>Bank</Th>
            <Th>Account</Th>
            <Th>Date</Th>
            <Th>Coins</Th>
            <Th>Status</Th>
            <Th sortable={false} />
          </tr>
        </thead>
        <tbody>
          {(list.items ?? []).map((payout) => (
            <tr key={payout.id}>
              <td>{payout.translatorName}</td>
              <td>{payout.translatorPhone}</td>
              <td>{payout.bankName}</td>
              <td>{payout.accountNumber}</td>
              <td>{dateTime(payout.createdAt)}</td>
              <td>- {money(payout.amount)}</td>
              <td>
                <span className={payout.status === "PENDING" ? "adm-pill pending" : payout.status === "PAID" ? "adm-pill ok" : "adm-pill bad"}>
                  {PAYOUT_LABEL[payout.status]}
                </span>
              </td>
              <td>
                {payout.status === "PENDING" ? (
                  <Link className="adm-link" to={`/admin/payouts/${payout.id}`}>
                    Open {"›"}
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.items !== null && list.items.length === 0 && <div className="adm-empty">No withdrawal requests</div>}
      <Pager page={list.page} totalPages={list.totalPages} onChange={list.setPage} />
    </>
  );
}

// "Withdraw" screen from the mockups: the admin sees the bank data and confirms the transfer.
export function AdminPayoutDetails() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [payout, setPayout] = useState<Payout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Paginated<Payout>>("GET", "/admin/payouts?limit=100")
      .then((data) => setPayout(data.items.find((item) => item.id === id) ?? null))
      .catch(() => undefined);
  }, [id]);

  async function process(status: "PAID" | "REJECTED") {
    setBusy(true);
    setError(null);
    try {
      await api("PATCH", `/admin/payouts/${id}`, { status });
      navigate("/admin/payouts");
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
          <h1>Withdraw</h1>
          <Crumbs items={[{ label: "Home", to: "/admin" }, { label: "Lists", to: "/admin/translators" }, { label: "Translators", to: "/admin/translators" }, { label: "Withdraw" }]} />
        </div>
      </div>
      <div className="adm-card">
        <div className="f">
          <label>User Name</label>
          <input readOnly value={payout?.translatorName ?? ""} />
        </div>
        <div className="f">
          <label>Bank Name</label>
          <input readOnly value={payout?.bankName ?? ""} />
        </div>
        <div className="f">
          <label>Bank Account</label>
          <input readOnly value={payout?.accountNumber ?? ""} />
        </div>
        <div className="f">
          <label>Withdrawal Amount</label>
          <input readOnly value={payout ? money(payout.amount) : ""} />
        </div>
      </div>
      {error && <div className="adm-err" style={{ maxWidth: 460, margin: "14px auto 0" }}>{error}</div>}
      <div className="adm-buttons">
        <button className="adm-gray" onClick={() => navigate(-1)}>
          Back
        </button>
        <button className="adm-gray" style={{ color: "var(--red)" }} disabled={busy || payout?.status !== "PENDING"} onClick={() => process("REJECTED")}>
          Reject
        </button>
        <button className="adm-black" disabled={busy || payout?.status !== "PENDING"} onClick={() => process("PAID")}>
          Transfer completed
        </button>
      </div>
    </>
  );
}

export function AdminWithdrawHistory() {
  const id = Number(useParams().id);
  const [name, setName] = useState("");
  const list = usePaged<Payout>(async () => {
    const data = await api<Paginated<Payout>>("GET", "/admin/payouts?limit=100");
    const mine = data.items.filter((item) => item.translatorId === id);
    setName(mine[0]?.translatorName ?? "");
    return { items: mine, totalPages: 1 };
  }, [id]);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Withdraw history {name && `[${name}]`}</h1>
          <Crumbs items={[{ label: "Home", to: "/admin" }, { label: "Lists", to: "/admin/translators" }, { label: "Translators", to: "/admin/translators" }, { label: "Withdraw history" }]} />
        </div>
      </div>
      <table className="adm-table">
        <thead>
          <tr>
            <Th sortable={false} />
            <Th>Withdraw</Th>
            <Th>Date</Th>
            <Th>Coins</Th>
            <Th>Withdraw request</Th>
          </tr>
        </thead>
        <tbody>
          {(list.items ?? []).map((payout) => (
            <tr key={payout.id}>
              <td className="cb">
                <input type="checkbox" />
              </td>
              <td>Withdraw</td>
              <td>{dateTime(payout.createdAt)}</td>
              <td>- {money(payout.amount)}</td>
              <td>{PAYOUT_LABEL[payout.status] === "Request" ? "Waiting" : PAYOUT_LABEL[payout.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.items !== null && list.items.length === 0 && <div className="adm-empty">No withdrawals yet</div>}
    </>
  );
}

interface Topup {
  id: number;
  userId: number;
  userName: string;
  phone: string;
  amount: number;
  senderName: string | null;
  status: "PENDING" | "COMPLETED" | "FAILED";
  createdAt: string;
}

export function AdminTopups() {
  const [status, setStatus] = useState("PENDING");
  const [error, setError] = useState<string | null>(null);
  const list = usePaged<Topup>(
    (page) => api<Paginated<Topup>>("GET", `/admin/topups?page=${page}&limit=10${status ? `&status=${status}` : ""}`),
    [status],
  );

  async function process(id: number, next: "COMPLETED" | "FAILED") {
    setError(null);
    try {
      await api("PATCH", `/admin/topups/${id}`, { status: next });
      list.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHead
        title="Top-up requests"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Finance" }, { label: "Top-up requests" }]}
        filter={{
          value: status,
          onChange: setStatus,
          placeholder: "All",
          options: [
            { value: "PENDING", label: "Waiting" },
            { value: "COMPLETED", label: "Confirmed" },
            { value: "FAILED", label: "Declined" },
          ],
        }}
      />
      {error && <div className="adm-err">{error}</div>}
      <table className="adm-table">
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Phone</Th>
            <Th>Sender</Th>
            <Th>Date</Th>
            <Th>Coins</Th>
            <Th>Status</Th>
            <Th sortable={false} />
          </tr>
        </thead>
        <tbody>
          {(list.items ?? []).map((row) => (
            <tr key={row.id}>
              <td>{row.userName}</td>
              <td>{row.phone}</td>
              <td>{row.senderName ?? "-"}</td>
              <td>{dateTime(row.createdAt)}</td>
              <td>+ {money(row.amount)}</td>
              <td>
                <span className={row.status === "PENDING" ? "adm-pill pending" : row.status === "COMPLETED" ? "adm-pill ok" : "adm-pill bad"}>
                  {row.status === "PENDING" ? "Waiting" : row.status === "COMPLETED" ? "Confirmed" : "Declined"}
                </span>
              </td>
              <td>
                {row.status === "PENDING" && (
                  <span style={{ display: "inline-flex", gap: 8 }}>
                    <button className="adm-black" style={{ padding: "7px 14px" }} onClick={() => process(row.id, "COMPLETED")}>
                      Confirm
                    </button>
                    <button className="adm-gray" style={{ padding: "7px 14px" }} onClick={() => process(row.id, "FAILED")}>
                      Decline
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.items !== null && list.items.length === 0 && <div className="adm-empty">No requests</div>}
      <Pager page={list.page} totalPages={list.totalPages} onChange={list.setPage} />
    </>
  );
}
