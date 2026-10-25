import { useEffect, useRef, useState } from "react";
import { readWallet, type WalletMode } from "./wallet.api";
import {
  paymentMode,
  payFromWallet,
  type WalletTarget,
} from "./walletPayments";
import { formatZAR } from "../../lib/money";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
export function WalletPayment({
  target,
  cents,
  onPaid,
  onBank,
  disabled = false,
}: {
  target: WalletTarget;
  cents: number;
  onPaid: () => void | Promise<unknown>;
  onBank?: () => void | Promise<unknown>;
  disabled?: boolean;
}) {
  const [balance, setBalance] = useState<number | null>(null),
    [mode, setMode] = useState<WalletMode>("local"),
    [error, setError] = useState(""),
    [review, setReview] = useState<"wallet" | "bank" | null>(null),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    request = useRef(crypto.randomUUID()),
    alive = useRef(true);
  const identity = JSON.stringify(target);
  async function load() {
    try {
      const m = await paymentMode(target),
        w = await readWallet(m);
      if (alive.current) {
        setMode(m);
        setBalance(w.balance);
        setError("");
      }
    } catch {
      if (alive.current) {
        setBalance(null);
        setError(
          "Wallet unavailable. Sign in for an account wallet, or continue with the bank preview.",
        );
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    request.current = crypto.randomUUID();
    setReview(null);
    setBalance(null);
    void load();
    const refresh = () => {
      if (!lock.current) void load();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      alive.current = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [identity, cents]);
  async function confirm() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (review === "wallet") {
        const w = await payFromWallet(target, mode, cents, request.current);
        if (alive.current) setBalance(w.balance);
        await onPaid();
      } else await onBank?.();
      if (alive.current) setReview(null);
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Payment could not be recorded.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="wallet-payment" aria-label="Choose payment source">
      <p className="muted small">
        {mode === "cloud" ? "Account wallet" : "Device wallet"}{" "}
        {balance === null
          ? "not available"
          : formatZAR(balance / 100) + " available"}
      </p>
      {balance !== null && balance < cents && (
        <p className="muted small">
          Not enough in your wallet. Pay the full amount directly from your bank
          instead; your wallet stays untouched.
        </p>
      )}
      <div className="actions">
        <Button
          variant="secondary"
          disabled={disabled || busy || balance === null || balance < cents}
          onClick={() => {
            setError("");
            setReview("wallet");
          }}
        >
          Pay {formatZAR(cents / 100)} from wallet
        </Button>
        {onBank && (
          <Button
            variant="ghost"
            disabled={disabled || busy}
            onClick={() => {
              setError("");
              setReview("bank");
            }}
          >
            Direct bank payment (preview)
          </Button>
        )}
      </div>
      {error && !review && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={!!review}
        onClose={() => {
          if (!busy) setReview(null);
        }}
        title={review === "wallet" ? "Pay from wallet" : "Direct bank payment"}
      >
        <p>
          Pay <strong>{formatZAR(cents / 100)}</strong>{" "}
          {review === "wallet"
            ? "using your wallet balance"
            : "directly from your bank"}
          ?
        </p>
        <p className="muted">
          {review === "wallet"
            ? "This deducts the full amount from your simulated wallet and records this contribution."
            : "This previews an external bank payment. Nothing is deducted from your wallet."}{" "}
          No real money moves; bank payments and wallet funds are simulated.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Button disabled={busy} onClick={confirm}>
          {busy ? "Saving..." : "Confirm payment preview"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setReview(null)}>
          Cancel
        </Button>
      </Modal>
    </div>
  );
}
