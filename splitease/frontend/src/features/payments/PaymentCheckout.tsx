import { useEffect } from "react";
import { WalletPayment } from "../wallet/WalletPayment";
import { paymentReference } from "../wallet/walletPayments";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { formatZAR } from "../../lib/money";
import {
  repaymentPlan,
  displayDate,
  paymentLabels,
  type PaymentChoice,
  type InstalmentCount,
} from "./paymentPlans";
export function PaymentCheckout({
  share,
  preferredChoice = "now",
  preferredCount = 3,
  onComplete,
}: {
  token: string | null;
  share: number;
  preferredChoice?: PaymentChoice;
  preferredCount?: InstalmentCount;
  onComplete?: () => void;
}) {
  const [choice, setChoice] = useState<PaymentChoice>(preferredChoice),
    [count, setCount] = useState<InstalmentCount>(preferredCount),
    [status, setStatus] = useState<"idle" | "success" | "failed">("idle"),
    [repaid, setRepaid] = useState(0);
  const [walletReference, setWalletReference] = useState("");
  useEffect(() => {
    let live = true;
    void paymentReference(location.hash + "|" + Math.round(share * 100)).then(
      (id) => {
        if (live) setWalletReference(id);
      },
    );
    return () => {
      live = false;
    };
  }, [share]);
  const plan = repaymentPlan(share, count);
  const paid =
    plan.slice(0, repaid).reduce((s, p) => s + Math.round(p.amount * 100), 0) /
    100;
  const remaining = Math.max(
    0,
    (Math.round(share * 100) - Math.round(paid * 100)) / 100,
  );
  function reset() {
    setStatus("idle");
    setRepaid(0);
  }
  function success() {
    setStatus("success");
    if (choice === "instalments") setRepaid(1);
    onComplete?.();
  }
  return (
    <div className="notice payment-preview">
      <strong>Your contribution</strong>
      <p>
        Choose how you would cover your share. No real money moves and no credit
        is issued.
      </p>
      <div className="payment-options" aria-label="Payment options">
        {Object.entries(paymentLabels).map(([key, label]) => (
          <button
            className={
              choice === key ? "payment-option selected" : "payment-option"
            }
            aria-label={label}
            aria-pressed={choice === key}
            key={key}
            onClick={() => {
              setChoice(key as PaymentChoice);
              reset();
            }}
          >
            {label}
            <small>
              {key === "now"
                ? "Cover your share today"
                : key === "cash"
                  ? "Hand cash to the organiser"
                  : "Spread your share over time"}
            </small>
          </button>
        ))}
      </div>
      {choice === "instalments" && (
        <>
          <div className="field">
            <label htmlFor="repayment-count">Repayment plan</label>
            <select
              id="repayment-count"
              value={count}
              onChange={(e) => {
                setCount(Number(e.target.value) as InstalmentCount);
                reset();
              }}
            >
              <option value={3}>3 monthly instalments</option>
              <option value={4}>4 monthly instalments</option>
            </select>
          </div>
          <div className="credit-explanation">
            <strong>
              The bill is covered; your balance is repaid over time.
            </strong>
            <p>
              This illustration assumes a credit provider funds your full share
              upfront. You repay that provider, rather than leaving the group
              short. The first repayment is due today.
            </p>
            <small>
              Sample schedule with no interest or fees included. Actual
              approval, rates, fees and dates would depend on a future credit
              provider. No credit provider is connected.
            </small>
          </div>
          {plan.length ? (
            <>
              <div className="credit-stats">
                <div>
                  <small>Share covered upfront</small>
                  <strong>{formatZAR(share)}</strong>
                </div>
                <div>
                  <small>First payment today</small>
                  <strong>{formatZAR(plan[0].amount)}</strong>
                </div>
                <div>
                  <small>Outstanding credit after today</small>
                  <strong>
                    {formatZAR(
                      (Math.round(share * 100) -
                        Math.round(plan[0].amount * 100)) /
                        100,
                    )}
                  </strong>
                </div>
              </div>
              <table className="repayment-table">
                <caption>Illustrative repayment schedule</caption>
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Due date</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((p, i) => (
                    <tr key={p.number}>
                      <td data-label="Payment">{p.number}</td>
                      <td data-label="Due date">
                        {i === 0 ? "Today" : displayDate(p.due)}
                      </td>
                      <td data-label="Amount">{formatZAR(p.amount)}</td>
                      <td data-label="Status">
                        {status === "success" && i < repaid
                          ? "Preview paid"
                          : "Scheduled"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="error" role="alert">
              This share is too small to divide into {count} positive
              instalments. Choose Pay now or Cash.
            </p>
          )}
        </>
      )}
      {choice === "cash" && (
        <p className="muted">
          Give {formatZAR(share)} to the organiser. The group still needs the
          organiser to confirm receipt; selecting cash alone does not cover the
          bill. This preview only illustrates that confirmation.
        </p>
      )}
      {status === "idle" && choice === "now" && walletReference && (
        <WalletPayment
          target={{ kind: "payment", item: walletReference }}
          cents={Math.round(share * 100)}
          onPaid={success}
          onBank={success}
        />
      )}
      {status === "idle" ? (
        <div className="actions">
          <Button
            disabled={choice === "instalments" && !plan.length}
            onClick={success}
          >
            {choice === "instalments"
              ? "Preview credit approval"
              : choice === "cash"
                ? "Preview cash received"
                : "Preview payment of " + formatZAR(share)}
          </Button>
        </div>
      ) : (
        <>
          <p role="status">
            {status === "failed"
              ? "Payment preview failed. No money was charged."
              : choice === "instalments"
                ? "Illustrative credit approved and first repayment previewed. No real credit was issued."
                : choice === "cash"
                  ? "Cash receipt preview complete. No real receipt has been recorded."
                  : "Payment preview complete. No money was sent or collected."}
          </p>
          {status === "success" && choice === "instalments" && (
            <div className="notice">
              <div className="receipt">
                <strong>Remaining credit balance (preview)</strong>
                <strong data-testid="remaining-credit">
                  {formatZAR(remaining)}
                </strong>
              </div>
              {repaid < count ? (
                <Button
                  variant="secondary"
                  onClick={() => setRepaid((n) => Math.min(count, n + 1))}
                >
                  Preview next repayment
                </Button>
              ) : (
                <p>Illustrative credit balance cleared.</p>
              )}
            </div>
          )}
          <Button variant="secondary" onClick={reset}>
            Try preview again
          </Button>
        </>
      )}
      <p className="muted small">
        Choices and preview results on this invitation stay on this screen. They
        do not sync to the organiser, approve credit, or mark a request paid.
      </p>
    </div>
  );
}
