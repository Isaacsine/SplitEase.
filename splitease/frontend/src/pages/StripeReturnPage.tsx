import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { formatZAR } from "../lib/money";
type Result = { status: "succeeded" | "pending" | "expired"; amountCents: number; sandbox: true };
export function StripeReturnPage({ hash }: { hash: string }) {
  const id = hash.slice("#stripe-return=".length);
  const cancelled = id === "cancelled";
  const [result, setResult] = useState<Result | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const check = useCallback(async (signal?: AbortSignal) => {
    if (cancelled) return;
    setBusy(true); setError("");
    try {
      if (!/^cs_test_[a-zA-Z0-9]+$/.test(id)) throw new Error("Invalid sandbox checkout link.");
      const response = await api<Result>(`/api/stripe/sessions/${encodeURIComponent(id)}`, { signal });
      if (!response.sandbox || !["succeeded", "pending", "expired"].includes(response.status)) throw new Error("Invalid sandbox status response.");
      if (!signal?.aborted) setResult(response);
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Could not verify checkout."); }
    finally { if (!signal?.aborted) setBusy(false); }
  }, [cancelled, id]);
  useEffect(() => { const controller = new AbortController(); void check(controller.signal); return () => controller.abort(); }, [check]);
  return <section className="panel">
    <span className="pill">Test payment</span>
    <h2>{cancelled ? "Checkout cancelled" : result?.status === "succeeded" ? "Test payment confirmed" : result?.status === "expired" ? "Test checkout expired" : "Check your test payment"}</h2>
    <p className="muted">No real money moves. Group totals are not linked yet.</p>
    {result?.status === "succeeded" && <p role="status">Stripe confirmed a test payment of {formatZAR(result.amountCents / 100)}.</p>}
    {result?.status === "pending" && <p role="status">Stripe has not confirmed payment. Complete checkout, then check again.</p>}
    {busy && <p role="status">Checking with Stripe...</p>}
    {error && <p role="alert">{error}</p>}
    {!cancelled && result?.status !== "succeeded" && <Button disabled={busy} onClick={() => void check()}>Check payment status</Button>}
    <a className="button secondary" href="#pay">Back to your split</a>
  </section>;
}
