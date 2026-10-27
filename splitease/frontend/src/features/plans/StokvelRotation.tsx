import { useEffect, useState } from "react";
import { rotationMonths, monthEnd, type Plan, type PlanAction } from "./plans";
import { formatZAR } from "../../lib/money";
import { displayDate } from "../payments/paymentPlans";
import { Button } from "../../components/ui/Button";
export function StokvelRotation({
  plan: p,
  busy,
  act,
}: {
  plan: Plan;
  busy: boolean;
  act: (
    action: PlanAction,
    member?: string,
    period?: string,
    data?: Record<string, unknown>,
  ) => Promise<boolean>;
}) {
  const [order, setOrder] = useState(p.rotation?.order || []);
  useEffect(() => setOrder(p.rotation?.order || []), [p.rotation?.revision]);
  const me = p.members.find((m) => m.isMe),
    complete =
      p.rotation?.payouts.length === p.members.length &&
      p.rotation?.payouts.every((x) => x.received);
  function swap(index: number, id: string) {
    setOrder((old) => {
      const next = [...old],
        other = next.indexOf(id);
      [next[index], next[other]] = [next[other], next[index]];
      return next;
    });
  }
  return (
    <section
      className="panel stokvel-rotation"
      aria-label="Stokvel payout order"
    >
      <div className="rowtitle">
        <h2>Payout order</h2>
        <span className="pill">
          {complete
            ? "Round finished"
            : p.active
              ? "Order locked"
              : "Everyone must agree"}
        </span>
      </div>
      <p className="muted">
        Each person receives the full monthly pot once in this{" "}
        {p.members.length}-month round. Everyone keeps contributing after their
        own turn.
      </p>
      <ol className="rotation-list">
        {rotationMonths(p).map((turn, i) => {
          const member = p.members.find((m) => m.id === turn.recipient)!,
            payout = p.rotation?.payouts.find((x) => x.month === turn.month);
          return (
            <li key={turn.recipient}>
              <span className="section-number">{i + 1}</span>
              <div>
                <strong>
                  {member.name}
                  {member.isMe ? " (you)" : ""}
                </strong>
                <small>Month-end {displayDate(monthEnd(turn.month))}</small>
              </div>
              <span className="pill">
                {payout
                  ? payout.received
                    ? "Recorded"
                    : "Ready to record"
                  : "Scheduled"}
              </span>
              {payout && member.isMe && !payout.received && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    act("receive", undefined, undefined, { month: turn.month })
                  }
                >
                  Acknowledge {formatZAR(payout.cents / 100)} payout
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      <p className="notice">
        Records only. Arrange payouts outside SplitEase.
      </p>
      {!p.active && me && (
        <details>
          <summary>Propose a different order</summary>
          <p className="muted small">
            Any member can propose an order before the round starts. A change
            needs fresh acceptance from everyone.
          </p>
          {order.map((id, i) => (
            <label className="field" key={i}>
              Recipient {i + 1}
              <select value={id} onChange={(e) => swap(i, e.target.value)}>
                {p.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <Button
            disabled={
              busy || order.every((id, i) => id === p.rotation?.order[i])
            }
            onClick={() =>
              act("order", undefined, undefined, {
                order,
                revision: p.rotation?.revision,
              })
            }
          >
            Propose payout order
          </Button>
        </details>
      )}
      {complete && (
        <p className="notice">
          Everyone has had a turn. This round is complete and creates no further
          monthly dues. Create a new plan and agree again for another round.
        </p>
      )}
    </section>
  );
}
