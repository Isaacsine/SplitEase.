import { supabase } from "../../lib/supabase";
import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { formatZAR } from "../../lib/money";
export function StripeSandboxCheckout({ cents }: { cents: number }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{ cents: number; key: string } | null>(null);
  const enabled = import.meta.env.VITE_STRIPE_SANDBOX_ENABLED === "true";
  async function checkout() {
    if (busy || !enabled) return;
    setBusy(true);
    setError("");
    try {
      const accountSession = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!accountSession) {
        sessionStorage.setItem("splitease-invite-return", location.hash);
        location.hash = "#account";
        setBusy(false);
        return;
      }
      if (!attempt.current || attempt.current.cents !== cents)
        attempt.current = { cents, key: crypto.randomUUID() };
      const session = await api<{ url: string; sandbox: boolean }>(
        "/api/stripe/checkout",
        {
          method: "POST",
          headers: { "Idempotency-Key": attempt.current.key },
          body: JSON.stringify({ amountCents: cents }),
        },
      );
      const url = new URL(session.url);
      if (
        !session.sandbox ||
        url.protocol !== "https:" ||
        url.hostname !== "checkout.stripe.com"
      )
        throw new Error("Unexpected checkout response.");
      location.assign(url.href);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not open Stripe sandbox.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="notice stripe-sandbox">
      <strong>Pay now · Test payment</strong>
      <p>Test payment. No real money moves.</p>
      <Button
        disabled={
          !enabled ||
          busy ||
          !Number.isSafeInteger(cents) ||
          cents < 1000 ||
          cents > 10_000_000
        }
        onClick={() => void checkout()}
      >
        {busy
          ? "Opening Stripe..."
          : `Test ${formatZAR(cents / 100)} with Stripe`}
      </Button>
      {(cents < 1000 || cents > 10_000_000) && (
        <p className="muted small">
          Sandbox checkout supports shares from R10 to R100,000.
        </p>
      )}
      {!enabled && (
        <p role="status">
          Test checkout is currently unavailable. Please try again later.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
