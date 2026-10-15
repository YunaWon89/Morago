import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Icon } from "../../components/Icon";
import { BrandHeader, Sheet, SuccessArt, TopBar } from "../../components/Layout";
import { useCall } from "../../call/CallContext";
import { api, errorMessage } from "../../lib/api";
import { formatDate, formatWon } from "../../lib/format";
import type { PayoutDto, TransactionDto, WalletResponse } from "../../lib/types";
import { useSocketEvent } from "../../realtime/RealtimeContext";

function describe(tx: TransactionDto): string {
  const pending = tx.status === "PENDING" ? " (pending)" : tx.status === "FAILED" ? " (declined)" : "";
  switch (tx.type) {
    case "CALL_CHARGE":
      return `Call #${tx.callId}`;
    case "CALL_EARNING":
      return `Call #${tx.callId}`;
    case "COMMISSION":
      return `Service fee, call #${tx.callId}`;
    case "ADMIN_CHARGE":
      return "Top-up by administrator";
    case "TOPUP":
      return `Top-up request${pending}`;
    case "PAYOUT":
      return `Withdrawal${pending}`;
    case "REFUND":
      return "Refund";
  }
}

export function Balance() {
  const { user } = useAuth();
  const { callEpoch } = useCall();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const isTranslator = user?.role === "TRANSLATOR";

  const load = () => {
    api<WalletResponse>("GET", "/wallet?limit=30")
      .then(setWallet)
      .catch(() => undefined);
  };
  useEffect(load, [callEpoch]);
  useSocketEvent("notification:new", load);

  return (
    <div className="screen">
      <BrandHeader>
        <div className="balance-card">
          <div>
            <div className="label">My balance</div>
            <div className="amount">
              <span className="coin">{"\u20A9"}</span>
              {wallet ? wallet.balance.toLocaleString("en-US") : "..."}
            </div>
          </div>
        </div>
        <Link
          to={isTranslator ? "/balance/withdraw" : "/balance/topup"}
          className="btn outline"
          style={{ marginTop: 14 }}
        >
          {isTranslator ? "Withdrawal of funds" : "Top up balance"}
        </Link>
      </BrandHeader>

      <div className="body">
        <h2 className="section-title" style={{ marginTop: 4 }}>
          Details
        </h2>
        {wallet && wallet.transactions.items.length === 0 && <div className="empty">No operations yet</div>}
        {wallet?.transactions.items.map((tx) => (
          <div key={tx.id} className="list-item">
            <span
              className="coin"
              style={{ width: 38, height: 38, fontSize: 16, background: tx.amount < 0 ? "#eef1f5" : "#e5f6da", color: tx.amount < 0 ? "#6b7585" : "#2e8a00", boxShadow: "none" }}
            >
              {tx.amount < 0 ? "\u2193" : "\u2191"}
            </span>
            <div className="grow">
              <div className="name">{describe(tx)}</div>
              <div className="sub">{formatDate(tx.createdAt)}</div>
            </div>
            <div style={{ fontWeight: 800, color: tx.amount < 0 ? "var(--ink)" : "var(--green)" }}>
              {tx.amount > 0 ? "+" : ""}
              {formatWon(tx.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const AMOUNTS = [10000, 30000, 50000, 100000];

export function TopUp() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<{ bankName: string; accountNumber: string; minAmount: number } | null>(null);
  const [sender, setSender] = useState("");
  const [amount, setAmount] = useState(AMOUNTS[0]!);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<typeof info>("GET", "/wallet/topup-info")
      .then(setInfo)
      .catch(() => undefined);
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/wallet/topups", { amount, senderName: sender.trim() });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen no-tabs">
      <TopBar title="" />
      <div className="body" style={{ paddingTop: 0 }}>
        <h1 className="page-title">Top up balance</h1>
        <p className="subtle" style={{ margin: "8px 0 18px" }}>
          The minimum top-up amount is {formatWon(info?.minAmount ?? 10000)}. Funds will be credited to the account
          within one working day.
        </p>

        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Account for top-up</p>
        <div className="bank-card">
          <div className="number">
            <span>{info?.accountNumber ?? "..."}</span>
            <button
              style={{ color: "#fff", opacity: 0.8, fontSize: 12 }}
              onClick={() => {
                navigator.clipboard?.writeText(info?.accountNumber ?? "").catch(() => undefined);
                setCopied(true);
              }}
            >
              <Icon name="copy" size={14} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div style={{ textAlign: "right", fontSize: 13 }}>{info?.bankName}</div>
        </div>

        <div className="field">
          <label>Sender's name</label>
          <div className="input-wrap">
            <Icon name="user" size={18} />
            <input placeholder="Last Name First Name" value={sender} onChange={(e) => setSender(e.target.value)} />
          </div>
        </div>

        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Amount to top up</p>
        {AMOUNTS.map((value) => (
          <button key={value} className={amount === value ? "radio-row active" : "radio-row"} onClick={() => setAmount(value)}>
            <span>
              <span className="coin" style={{ marginRight: 8 }}>
                {"\u20A9"}
              </span>
              {value.toLocaleString("en-US")} won
            </span>
            {amount === value && <Icon name="check" size={16} />}
          </button>
        ))}

        {error && <div className="alert error">{error}</div>}
        <button className="btn" style={{ marginTop: 14 }} disabled={busy || sender.trim().length < 2} onClick={submit}>
          {busy ? "Please wait..." : "Request top-up"}
        </button>
      </div>

      {done && (
        <Sheet onClose={() => navigate("/balance")}>
          <div className="success">
            <SuccessArt />
            <h2>Top-up request completed successfully</h2>
            <p className="subtle">Funds will be credited to your balance within one working day.</p>
            <button className="btn" style={{ marginTop: 20 }} onClick={() => navigate("/balance")}>
              Great!
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

const BANKS = ["KEB Hana Bank", "KB Kookmin Bank", "Shinhan Bank", "Woori Bank", "NH Nonghyup Bank", "IBK Industrial Bank", "Kakao Bank", "Toss Bank"];

export function Withdraw() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [minAmount, setMinAmount] = useState(50000);
  const [history, setHistory] = useState<PayoutDto[]>([]);
  const [account, setAccount] = useState("");
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api<WalletResponse>("GET", "/wallet?limit=1").then((data) => setBalance(data.balance)).catch(() => undefined);
    api<{ minAmount: number }>("GET", "/payouts/info").then((data) => setMinAmount(data.minAmount)).catch(() => undefined);
    api<{ items: PayoutDto[] }>("GET", "/payouts?limit=10").then((data) => setHistory(data.items)).catch(() => undefined);
  };
  useEffect(load, []);
  useSocketEvent("payout:updated", load);

  const value = Number(amount.replace(/\D/g, ""));
  const tooLow = amount !== "" && value < minAmount;
  const tooHigh = value > balance;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/payouts", { amount: value, bankName: bank, accountNumber: account.trim() });
      setDone(true);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen no-tabs">
      <TopBar title="" />
      <div className="body" style={{ paddingTop: 0 }}>
        <h1 className="page-title">Withdrawal of funds</h1>
        <p className="subtle" style={{ margin: "8px 0 18px" }}>
          The minimum withdrawal amount is {formatWon(minAmount)}. Enter your account number and the funds will be
          credited to you within one working day.
        </p>

        <div className="field">
          <label>Bank account number</label>
          <div className="input-wrap">
            <Icon name="lock" size={18} />
            <input placeholder="Bank account number" value={account} onChange={(e) => setAccount(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Bank name</label>
          <div className="input-wrap">
            <Icon name="info" size={18} />
            <select value={bank} onChange={(e) => setBank(e.target.value)}>
              <option value="">Your bank name</option>
              {BANKS.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>
            Amount to withdraw <span className="subtle">(Balance {formatWon(balance)})</span>
          </label>
          <div className={tooLow || tooHigh ? "input-wrap invalid" : "input-wrap"}>
            <Icon name="plus" size={18} />
            <input inputMode="numeric" placeholder="Amount to withdraw" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {tooLow && <div className="error-text">The minimum is {formatWon(minAmount)}</div>}
          {!tooLow && tooHigh && <div className="error-text">Not enough funds</div>}
        </div>

        {error && <div className="alert error">{error}</div>}
        <button
          className="btn orange"
          disabled={busy || !account.trim() || !bank || !value || tooLow || tooHigh}
          onClick={submit}
        >
          {busy ? "Please wait..." : "Withdraw"}
        </button>

        {history.length > 0 && (
          <>
            <h2 className="section-title">Withdrawal requests</h2>
            {history.map((payout) => (
              <div key={payout.id} className="list-item">
                <div className="grow">
                  <div className="name">{formatWon(payout.amount)}</div>
                  <div className="sub">
                    {payout.bankName} · {formatDate(payout.createdAt)}
                  </div>
                </div>
                <div className="meta">{payout.status === "PAID" ? "Paid" : payout.status === "REJECTED" ? "Declined" : "Pending"}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {done && (
        <Sheet onClose={() => navigate("/balance")}>
          <div className="success">
            <SuccessArt />
            <h2>Withdrawal of funds succeeded</h2>
            <p className="subtle">The funds will be credited to your account within one working day.</p>
            <button className="btn orange" style={{ marginTop: 20 }} onClick={() => navigate("/balance")}>
              Great!
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
