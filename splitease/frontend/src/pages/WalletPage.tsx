import { listPlans } from "../features/plans/plans.api";
import {
  payFromWallet,
  type WalletTarget,
} from "../features/wallet/walletPayments";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  readWallet,
  walletAction,
  type Wallet,
  type WalletMode,
  type WalletKind,
} from "../features/wallet/wallet.api";
import { moneyCents } from "../features/plans/plans";
import { supabase } from "../lib/supabase";
import { formatZAR } from "../lib/money";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
export function WalletPage() {
  const [mode, setMode] = useState<WalletMode>("local"),
    [user, setUser] = useState(""),
    [wallet, setWallet] = useState<Wallet | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [kind, setKind] = useState<WalletKind>("add"),
    [pending, setPending] = useState<{
      kind: WalletKind;
      cents: number;
      label: string;
      request: string;
      destination?: string;
      target?: WalletTarget;
    } | null>(null);
  const [transferTo, setTransferTo] = useState(""),
    [destinationId, setDestinationId] = useState(""),
    [destinations, setDestinations] = useState<
      { id: string; label: string; cents: number; target: WalletTarget }[]
    >([]),
    [destinationError, setDestinationError] = useState(""),
    [loadingDestinations, setLoadingDestinations] = useState(false);
  const amountInput = useRef<HTMLInputElement>(null),
    destinationSeq = useRef(0);
  async function loadDestinations() {
    const request = ++destinationSeq.current;
    setLoadingDestinations(true);
    setDestinationError("");
    try {
      const result = await listPlans();
      const items = result.entries
        .filter(
          (e) =>
            (e.ref.mode === "cloud" ? "cloud" : "local") === mode &&
            e.plan.active,
        )
        .flatMap((e) => {
          const me = e.plan.members.find((m) => m.isMe);
          return e.plan.periods
            .filter((p) => p.memberId === me?.id && p.status === "due")
            .map((p) => ({
              id: p.id,
              label: e.plan.title + " - " + p.month + " - " + me!.name,
              cents: p.cents,
              target: { kind: "plan" as const, ref: e.ref, item: p.id },
            }));
        });
      if (alive.current && request === destinationSeq.current) {
        setDestinations(items);
        setDestinationError(result.warnings.join(" "));
      }
    } catch (e) {
      if (alive.current && request === destinationSeq.current)
        setDestinationError(
          e instanceof Error ? e.message : "Could not load destinations.",
        );
    } finally {
      if (alive.current && request === destinationSeq.current)
        setLoadingDestinations(false);
    }
  }
  useEffect(() => {
    destinationSeq.current++;
    setDestinationId("");
    setDestinations([]);
    if (kind === "move" && transferTo === "plan") void loadDestinations();
    return () => {
      destinationSeq.current++;
    };
  }, [mode, user, kind, transferTo]);
  const seq = useRef(0),
    uid = useRef(""),
    lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const sub = supabase?.auth.onAuthStateChange((_, session) => {
      const id = session?.user.id || "";
      if (uid.current !== id) {
        uid.current = id;
        seq.current++;
        setWallet(null);
        setPending(null);
        setUser(id);
        setMode(id ? "cloud" : "local");
      }
    });
    return () => {
      alive.current = false;
      seq.current++;
      sub?.data.subscription.unsubscribe();
    };
  }, []);
  async function load() {
    const n = ++seq.current;
    setWallet(null);
    setError("");
    try {
      const data = await readWallet(mode);
      if (alive.current && n === seq.current) setWallet(data);
    } catch (e) {
      if (alive.current && n === seq.current)
        setError(e instanceof Error ? e.message : "Could not load wallet.");
    }
  }
  useEffect(() => {
    localStorage.setItem("splitease-wallet-choice", mode);
    void load();
  }, [mode, user]);
  useEffect(() => {
    const refresh = (e: StorageEvent) => {
      if (mode === "local" && e.key === "splitease-wallet-v1" && !lock.current)
        void load();
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [mode]);
  function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget),
        cents = moneyCents(String(f.get("amount")));
      if (kind !== "add" && cents > (wallet?.balance || 0))
        throw Error("Not enough available balance.");
      if (kind === "add")
        setPending({
          kind: "add",
          cents,
          label: "Deposit",
          request: crypto.randomUUID(),
        });
      else if (transferTo === "bank") {
        const holder = String(f.get("holder") || "").trim(),
          bank = String(f.get("bank") || "").trim(),
          account = String(f.get("account") || "").replace(/\s+/g, "");
        if (!holder || !bank || !/^\d{6,20}$/.test(account))
          throw Error(
            "Enter the account holder, bank and an account number with 6 to 20 digits.",
          );
        const destination =
          holder + " at " + bank + " (ending " + account.slice(-4) + ")";
        setPending({
          kind: "move",
          cents,
          destination,
          label:
            "To " +
            holder.slice(0, 24) +
            " | " +
            bank.slice(0, 24) +
            " *" +
            account.slice(-4),
          request: crypto.randomUUID(),
        });
      } else if (transferTo === "plan") {
        const destination = destinations.find((d) => d.id === destinationId);
        if (!destination) throw Error("Choose a contribution to transfer to.");
        if (cents !== destination.cents)
          throw Error("Transfer the exact agreed contribution amount.");
        setPending({
          kind: "use",
          cents,
          destination: destination.label,
          label: destination.label.slice(0, 80),
          target: destination.target,
          request: crypto.randomUUID(),
        });
      } else throw Error("Choose where to transfer your money.");
      setError("");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your amount.");
    }
  }
  async function confirm() {
    if (!pending || lock.current) return;
    lock.current = true;
    setBusy(true);
    const n = ++seq.current;
    try {
      const data = pending.target
        ? await payFromWallet(
            pending.target,
            mode,
            pending.cents,
            pending.request,
          )
        : await walletAction(
            mode,
            pending.kind,
            pending.cents,
            pending.label,
            pending.request,
          );
      if (alive.current && n === seq.current) {
        setWallet(data);
        setPending(null);
        setMessage(
          pending.kind === "add"
            ? "Deposit recorded."
            : pending.target
              ? "Transfer to " + pending.destination + " recorded."
              : "Transfer to " +
                pending.destination +
                " recorded as a preview. No bank transfer was sent.",
        );
        if (pending.target) {
          setDestinationId("");
          void loadDestinations();
        }
        setError("");
      }
    } catch (e) {
      if (alive.current && n === seq.current)
        setError(e instanceof Error ? e.message : "Could not update wallet.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="wallet-page">
      <div className="workspace-heading">
        <div>
          <p className="workspace-kicker">MONEY SET ASIDE</p>
          <h1>Wallet</h1>
          <p className="muted">Keep a balance until you choose to use it.</p>
        </div>
        <label className="field">
          Wallet storage
          <select
            value={mode}
            disabled={busy}
            onChange={(e) => {
              setPending(null);
              setMessage("");
              setMode(e.target.value as WalletMode);
            }}
          >
            <option value="local">This device</option>
            <option value="cloud">My account</option>
          </select>
        </label>
      </div>
      <p className="notice">
        Payments are not connected yet. This prototype does not accept, hold or
        transfer real funds.
      </p>
      {mode === "local" && (
        <p className="muted small">
          Saved only in this browser. People using this browser can access this
          device wallet. Use your signed-in account for a private online wallet.
        </p>
      )}
      {error && !pending && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {wallet ? (
        <>
          <div className="wallet-grid">
            <section className="panel wallet-balance">
              <p className="workspace-kicker">AVAILABLE BALANCE</p>
              <h2>{formatZAR(wallet.balance / 100)}</h2>
              <p className="muted">
                No automatic withdrawals. No automatic spending.
              </p>
              <p className="muted small">
                Deposits stay available without an expiry date. You choose when
                to pay or transfer; no interest or fees are applied.
              </p>
            </section>
            <form className="panel" onSubmit={review}>
              <h2>Your money, your choice</h2>
              <label className="field">
                Wallet action
                <select
                  value={kind}
                  disabled={busy}
                  onChange={(e) => setKind(e.target.value as WalletKind)}
                >
                  <option value="add">Deposit</option>
                  <option value="move">Transfer</option>
                </select>
              </label>
              {kind === "move" && (
                <>
                  <label className="field">
                    Transfer to
                    <select
                      aria-label="Transfer to"
                      value={transferTo}
                      required
                      disabled={busy}
                      onChange={(e) => {
                        setTransferTo(e.target.value);
                        setDestinationId("");
                      }}
                    >
                      <option value="" disabled>
                        Choose a destination
                      </option>
                      <option value="bank">Bank account</option>
                      <option value="plan">Plan or stokvel contribution</option>
                    </select>
                  </label>
                  {transferTo === "bank" && (
                    <>
                      <label className="field">
                        Account holder
                        <input
                          name="holder"
                          maxLength={60}
                          required
                          disabled={busy}
                          autoComplete="off"
                        />
                      </label>
                      <label className="field">
                        Bank name
                        <input
                          name="bank"
                          maxLength={50}
                          required
                          disabled={busy}
                          autoComplete="off"
                        />
                      </label>
                      <label className="field">
                        Account number
                        <input
                          name="account"
                          inputMode="numeric"
                          pattern="[0-9 ]{6,25}"
                          maxLength={25}
                          required
                          disabled={busy}
                          autoComplete="off"
                        />
                      </label>
                      <p className="muted small">
                        Bank details are not verified. Only the holder, bank and
                        last four digits are saved in your private activity.
                        This is a bank-transfer preview.
                      </p>
                    </>
                  )}
                  {transferTo === "plan" && (
                    <>
                      <label className="field">
                        Contribution
                        <select
                          aria-label="Contribution"
                          value={destinationId}
                          required
                          disabled={busy || loadingDestinations}
                          onChange={(e) => {
                            setDestinationId(e.target.value);
                            const d = destinations.find(
                              (d) => d.id === e.target.value,
                            );
                            if (d && amountInput.current)
                              amountInput.current.value = String(d.cents / 100);
                          }}
                        >
                          <option value="" disabled>
                            {loadingDestinations
                              ? "Loading contributions..."
                              : "Choose a contribution"}
                          </option>
                          {destinations.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.label} - {formatZAR(d.cents / 100)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!loadingDestinations && !destinations.length && (
                        <p className="muted small">
                          No unpaid contributions in this wallet's storage.
                          Start or join a plan or stokvel first.
                        </p>
                      )}
                      {destinationError && (
                        <p className="error" role="alert">
                          {destinationError}
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy || loadingDestinations}
                        onClick={loadDestinations}
                      >
                        Refresh destinations
                      </Button>
                    </>
                  )}
                </>
              )}
              <label className="field">
                Amount (R)
                <input
                  ref={amountInput}
                  readOnly={
                    kind === "move" && transferTo === "plan" && !!destinationId
                  }
                  name="amount"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                  disabled={busy}
                />
              </label>
              <Button type="submit" disabled={busy}>
                {kind === "add" ? "Review deposit" : "Review transfer"}
              </Button>
            </form>
          </div>
          <section className="panel wallet-destinations">
            <h2>Pay with your wallet</h2>
            <p className="muted">
              Choose Wallet when paying a contribution. If the balance is too
              low, use the direct bank payment preview.
            </p>
            <div className="actions">
              <a className="button secondary" href="#plans">
                Plans & stokvels
              </a>
              <a className="button secondary" href="#pay">
                Split a bill
              </a>
              <a className="button secondary" href="#scan">
                Scan a payment QR
              </a>
            </div>
          </section>
          <section className="panel wallet-history">
            <h2>Recent activity</h2>
            {wallet.entries.length ? (
              wallet.entries.slice(0, 100).map((e) => (
                <article className="funding-person" key={e.id}>
                  <div>
                    <strong>{e.label}</strong>
                    <small>
                      {new Date(e.createdAt).toLocaleString("en-ZA", {
                        timeZone: "Africa/Johannesburg",
                      })}{" "}
                    </small>
                  </div>
                  <strong>
                    {e.kind === "add" ? "+" : "-"} {formatZAR(e.cents / 100)}
                  </strong>
                </article>
              ))
            ) : (
              <p className="muted">
                No activity yet. Make your first deposit to get started.
              </p>
            )}
          </section>
        </>
      ) : (
        !error && <p role="status">Loading wallet...</p>
      )}
      <Button variant="ghost" disabled={busy} onClick={load}>
        Refresh wallet
      </Button>
      <Modal
        open={!!pending}
        onClose={() => {
          if (!busy) setPending(null);
        }}
        title={pending?.kind === "add" ? "Confirm deposit" : "Confirm transfer"}
      >
        {pending && (
          <>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <p>
              {pending.kind === "add" ? "Deposit" : "Transfer"}{" "}
              <strong>{formatZAR(pending.cents / 100)}</strong>
              {pending.kind === "add"
                ? " into your wallet?"
                : " to " + pending.destination + "?"}
            </p>
            <p className="muted">
              {pending.label}. This changes your prototype balance only. No real
              money moves.
            </p>
            <Button disabled={busy} onClick={confirm}>
              {busy
                ? "Saving..."
                : pending.kind === "add"
                  ? "Deposit"
                  : "Confirm transfer"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
          </>
        )}
      </Modal>
    </section>
  );
}
