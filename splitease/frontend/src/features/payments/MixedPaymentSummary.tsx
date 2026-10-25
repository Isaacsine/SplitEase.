import { useState } from "react";
import { useShop } from "../shops/useShop";
import { validateShop } from "../shops/shops.api";
import { repaymentPlan, paymentLabels } from "./paymentPlans";
import { formatZAR } from "../../lib/money";
import { Button } from "../../components/ui/Button";
export function MixedPaymentSummary() {
  const { shop } = useShop();
  const [funded, setFunded] = useState(false),
    [cashReceived, setCashReceived] = useState<string[]>([]);
  const people = shop.participants;
  const cash = people.filter((p) => p.paymentChoice === "cash");
  const credit = people.filter((p) => p.paymentChoice === "instalments");
  const cashTotal = cash.reduce((s, p) => s + Math.round(p.share * 100), 0);
  const creditTotal = credit.reduce((s, p) => s + Math.round(p.share * 100), 0);
  const nowTotal = people
    .filter((p) => !p.paymentChoice || p.paymentChoice === "now")
    .reduce((s, p) => s + Math.round(p.share * 100), 0);
  const cashCovered = cash
    .filter((p) => cashReceived.includes(p.id))
    .reduce((s, p) => s + Math.round(p.share * 100), 0);
  const covered = (funded ? nowTotal + creditTotal : 0) + cashCovered;
  const total = Math.round(shop.totalAmount * 100);
  const outstanding = credit.reduce((s, p) => {
    const plan = repaymentPlan(p.share, p.instalmentCount || 3);
    return (
      s + Math.round(p.share * 100) - Math.round((plan[0]?.amount || 0) * 100)
    );
  }, 0);
  const valid =
    !validateShop(shop) &&
    credit.every((p) => repaymentPlan(p.share, p.instalmentCount || 3).length);
  return (
    <section className="mixed-payment">
      <div className="rowtitle">
        <h3>One bill. Different ways to pay.</h3>
        <span className="badge">Prototype illustration</span>
      </div>
      <p className="muted">
        Each person chooses their own method. Any credit would belong to the
        person borrowing, not to the rest of the group.
      </p>
      <div className="credit-stats">
        <div>
          <small>Pay now</small>
          <strong>{formatZAR(nowTotal / 100)}</strong>
        </div>
        <div>
          <small>Cash to collect</small>
          <strong>{formatZAR(cashTotal / 100)}</strong>
        </div>
        <div>
          <small>Credit provider funds</small>
          <strong>{formatZAR(creditTotal / 100)}</strong>
        </div>
      </div>
      {credit.length > 0 && (
        <p className="muted">
          Illustrative credit remaining after first repayments:{" "}
          <strong>{formatZAR(outstanding / 100)}</strong>. A future provider
          would have to approve and fund these shares upfront.
        </p>
      )}
      <div className="actions">
        <Button
          variant="secondary"
          disabled={!valid || funded}
          onClick={() => setFunded(true)}
        >
          {funded
            ? "Upfront funding previewed"
            : "Preview upfront payments & credit funding"}
        </Button>
        {(funded || cashReceived.length > 0) && (
          <Button
            variant="ghost"
            onClick={() => {
              setFunded(false);
              setCashReceived([]);
            }}
          >
            Reset coverage preview
          </Button>
        )}
      </div>
      {people.map((p) => {
        const kind = p.paymentChoice || "now";
        const done = kind === "cash" ? cashReceived.includes(p.id) : funded;
        return (
          <div className="funding-person" key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <small>
                {paymentLabels[kind]} - {formatZAR(p.share)}
              </small>
            </div>
            <span className="pill">
              {done
                ? kind === "instalments"
                  ? "Credit funded (preview)"
                  : "Covered (preview)"
                : kind === "cash"
                  ? "Cash not received"
                  : "Not covered"}
            </span>
            {kind === "cash" && !done && (
              <Button
                variant="secondary"
                disabled={!valid}
                onClick={() => setCashReceived((ids) => [...ids, p.id])}
              >
                Preview cash received from {p.name}
              </Button>
            )}
          </div>
        );
      })}
      <div className="coverage-total">
        <strong>
          {valid && covered === total
            ? "Bill covered in preview"
            : "Bill coverage preview"}
        </strong>
        <span>
          {formatZAR(covered / 100)} / {formatZAR(shop.totalAmount)}
        </span>
      </div>
      <p className="muted small">
        No real cash receipt, loan, approval or settlement is recorded. This
        illustration stays on this screen and does not update anyone's
        invitation or account.
      </p>
    </section>
  );
}
