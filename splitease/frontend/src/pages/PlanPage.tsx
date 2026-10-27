import { StokvelRotation } from "../features/plans/StokvelRotation";
import { PlanChat } from "../features/plans/PlanChat";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  readPlan,
  changePlan,
  subscribePlan,
} from "../features/plans/plans.api";
import {
  parsePlan,
  rememberPlan,
  planLink,
  thisMonth,
  moneyCents,
  calendar,
  type Plan,
  type PlanAction,
  type PlanMember,
} from "../features/plans/plans";
import { formatZAR } from "../lib/money";
import {
  displayDate,
  todayInSouthAfrica,
} from "../features/payments/paymentPlans";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
function Preferences({
  member: m,
  plan,
  disabled,
  save,
}: {
  member: PlanMember;
  plan: Plan;
  disabled: boolean;
  save: (data: Record<string, unknown>) => Promise<boolean>;
}) {
  const [method, setMethod] = useState("manual" as PlanMember["method"]),
    [reminders, setReminders] = useState(m.reminders ?? true),
    [days, setDays] = useState(m.days ?? 3),
    [message, setMessage] = useState("");
  useEffect(() => {
    setMethod("manual" as PlanMember["method"]);
    setReminders(m.reminders ?? true);
    setDays(m.days ?? 3);
  }, [m.method, m.reminders, m.days]);
  function exportDates() {
    const blob = new Blob([calendar(plan)], {
        type: "text/calendar;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "splitease-reminders.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Calendar file downloaded. Import it into your calendar and enable its alerts. Changes to this plan need a fresh export.",
    );
  }
  return (
    <section className="panel plan-preferences">
      <h2>Your preferences</h2>
      <p className="muted small">
        Visible only in your participant view. The organiser cannot change these
        for you.
      </p>
      <label className="field">
        How you want to pay
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
        >
          <option value="manual">Manual payment</option>
        </select>
      </label>
      <label className="assignment-choice">
        <input
          type="checkbox"
          checked={reminders}
          onChange={(e) => setReminders(e.target.checked)}
        />
        Remind me about contributions
      </label>
      <label className="field">
        Reminder timing
        <select
          value={days}
          disabled={!reminders}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={0}>On the due date</option>
          <option value={1}>1 day before</option>
          <option value={3}>3 days before</option>
          <option value={7}>7 days before</option>
        </select>
      </label>
      <div className="actions">
        <Button
          disabled={disabled}
          onClick={async () => {
            setMessage("");
            if (await save({ method, reminders, days }))
              setMessage("Preferences saved.");
          }}
        >
          Save preferences
        </Button>
        <Button
          variant="secondary"
          disabled={!m.reminders || disabled}
          onClick={exportDates}
        >
          Export calendar reminders
        </Button>
      </div>
      <p className="muted small">
        Save first, then export the next 12 dates to your calendar. In-app
        reminders work when you open Plans; background push, email and SMS are
        not connected.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function PlanPage({ hash }: { hash: string }) {
  const ref = useMemo(() => parsePlan(hash), [hash]);
  const [plan, setPlan] = useState<Plan | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [month, setMonth] = useState(thisMonth()),
    [selected, setSelected] = useState(""),
    [copied, setCopied] = useState(""),
    [pending, setPending] = useState<{
      member: PlanMember;
      cents: number;
    } | null>(null),
    [online, setOnline] = useState(navigator.onLine);
  const alive = useRef(true),
    lock = useRef(false),
    seq = useRef(0);
  async function refresh() {
    if (!ref || lock.current) return false;
    const request = ++seq.current;
    try {
      const p = await readPlan(ref);
      if (alive.current && request === seq.current) {
        setPlan(p);
        setError("");
      }
    } catch (e) {
      if (alive.current && request === seq.current)
        setError(e instanceof Error ? e.message : "Could not load plan.");
    }
  }
  useEffect(() => {
    alive.current = true;
    if (!ref) {
      setError("Invalid plan link.");
      return;
    }
    rememberPlan(ref);
    void refresh();
    const stop = subscribePlan(ref, () => void refresh());
    const network = () => setOnline(navigator.onLine);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    return () => {
      alive.current = false;
      seq.current++;
      stop();
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, [ref]);
  async function act(
    action: PlanAction,
    member?: string,
    period?: string,
    data: Record<string, unknown> = {},
  ) {
    if (!ref || lock.current) return false;
    lock.current = true;
    setBusy(true);
    seq.current++;
    try {
      const p = await changePlan(ref, action, member, period, data);
      if (alive.current) {
        setPlan(p);
        setError("");
        setPending(null);
      }
      return true;
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Could not save change.");
      return false;
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!plan)
    return (
      <section className="panel">
        <h2>Monthly plan</h2>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          <p role="status">Loading plan...</p>
        )}
        <Button variant="secondary" onClick={refresh}>
          Try again
        </Button>
        <a className="button ghost" href="#plans">
          Back to plans
        </a>
      </section>
    );
  const me = plan.members.find((m) => m.isMe),
    paid = plan.periods
      .filter((p) => p.status === "confirmed")
      .reduce((s, p) => s + p.cents, 0),
    months = [...new Set([thisMonth(), ...plan.periods.map((p) => p.month)])]
      .sort()
      .reverse(),
    periods = plan.periods.filter((p) => p.month === month),
    invite = plan.members.find((m) => m.id === selected) || plan.members[0],
    link = ref && invite?.token ? planLink({ ...ref, seat: invite.token }) : "",
    waiting = plan.members.filter(
      (m) =>
        !m.proposal.accepted || (plan.kind === "stokvel" && !m.orderAccepted),
    ).length,
    disabled = busy || (!online && plan.mode === "cloud");
  function propose(e: FormEvent<HTMLFormElement>, m: PlanMember) {
    e.preventDefault();
    try {
      const cents = moneyCents(
        String(new FormData(e.currentTarget).get("amount")),
      );
      if (cents === m.proposal.cents) throw Error("Enter a different amount.");
      setPending({ member: m, cents });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the amount.");
    }
  }
  return (
    <section className="monthly-plan">
      <a className="button ghost" href="#plans">
        &#8592; All plans
      </a>
      <div className="workspace-heading">
        <div>
          <span className="pill">
            {plan.kind === "stokvel"
              ? "Stokvel"
              : plan.kind === "savings"
                ? "Savings goal"
                : "Monthly expense"}
          </span>
          <h1>{plan.title}</h1>
          <p className="muted">
            Due on day {plan.day} each month -{" "}
            {plan.mode === "local" ? "On this device only" : "Shared online"}
          </p>
        </div>
        <span className="pill">
          {plan.active ? "Active" : "Awaiting agreements"}
        </span>
      </div>
      {!online && plan.mode === "cloud" && (
        <p className="notice" role="status">
          You're offline. Saved information stays visible. Reconnect to make
          changes.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="payment-disclosure">
        Contribution records only. SplitEase does not hold funds or collect
        payments. The organiser confirms receipt into the group's separately
        agreed account.
      </p>
      {plan.kind === "savings" && (
        <section className="panel savings-progress">
          <div className="coverage-total">
            <strong>{formatZAR(paid / 100)} saved</strong>
            <span>of {formatZAR(plan.target / 100)}</span>
          </div>
          <progress
            aria-label="Savings progress"
            max={plan.target}
            value={Math.min(paid, plan.target)}
          />
          <p className="muted small">
            Only organiser-confirmed contributions count towards the goal.
          </p>
        </section>
      )}
      {plan.kind === "stokvel" && (
        <StokvelRotation plan={plan} busy={disabled} act={act} />
      )}
      {ref && <PlanChat ref={ref} kind={plan.kind} />}
      <div className="plan-detail-grid">
        <div>
          <section className="panel">
            <h2>Monthly agreements</h2>
            <p className="muted">
              {plan.active
                ? "An existing agreement stays in place until a new amount is accepted. Changes apply from a future month; previous records stay unchanged."
                : "Each person must accept their own amount before the organiser starts the plan."}
            </p>
            {plan.members.map((m) => (
              <article className="plan-agreement" key={m.id}>
                <div className="rowtitle">
                  <strong>
                    {m.name}
                    {m.isMe ? " (you)" : ""}
                  </strong>
                  <strong>{formatZAR(m.proposal.cents / 100)} / month</strong>
                </div>
                <p className="muted small">
                  {m.proposal.accepted &&
                  (plan.kind !== "stokvel" || m.orderAccepted)
                    ? "Accepted"
                    : "Needs acceptance"}{" "}
                  - From {m.proposal.effective}
                </p>
                {m.isMe &&
                  (!m.proposal.accepted ||
                    (plan.kind === "stokvel" && !m.orderAccepted)) && (
                    <Button
                      disabled={disabled}
                      onClick={() =>
                        act("accept", m.id, undefined, {
                          revision: m.proposal.revision,
                          orderRevision: plan.rotation?.revision,
                        })
                      }
                    >
                      {plan.kind === "stokvel"
                        ? "Accept contribution & order"
                        : "Accept my contribution"}
                    </Button>
                  )}
                {plan.owner && !(plan.kind === "stokvel" && plan.active) && (
                  <details>
                    <summary>Change amount for {m.name}</summary>
                    <form onSubmit={(e) => propose(e, m)}>
                      <label className="field">
                        New monthly amount for {m.name} (R)
                        <input
                          name="amount"
                          type="number"
                          min="0.01"
                          max="1000000"
                          step="0.01"
                          required
                          defaultValue={m.proposal.cents / 100}
                        />
                      </label>
                      <Button
                        type="submit"
                        variant="secondary"
                        disabled={disabled}
                      >
                        Review amount change
                      </Button>
                    </form>
                  </details>
                )}
              </article>
            ))}
            {!plan.active && plan.owner && (
              <>
                <p className="muted small">
                  {waiting
                    ? waiting + " people still need to accept."
                    : "Everyone has accepted. You can start the plan."}
                </p>
                <Button
                  disabled={disabled || waiting > 0}
                  onClick={() => act("start")}
                >
                  Start monthly plan
                </Button>
              </>
            )}
          </section>
          <section className="panel monthly-ledger">
            <div className="rowtitle">
              <h2>Monthly contributions</h2>
              <label className="field">
                Month
                <select
                  aria-label="Month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {months.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>
            {!plan.active ? (
              <p className="muted">
                Contributions begin once everyone agrees and the organiser
                starts the plan.
              </p>
            ) : !periods.length ? (
              <p className="muted">
                {plan.kind === "stokvel" && month > plan.start
                  ? "No contribution is due for this month outside the agreed round."
                  : "Nothing is due for this month. The plan starts in " +
                    plan.start +
                    "."}
              </p>
            ) : (
              periods.map((x) => {
                const member = plan.members.find((m) => m.id === x.memberId)!;
                return (
                  <article className="plan-period" key={x.id}>
                    <div>
                      <strong>{member.name}</strong>
                      <small>Due {displayDate(x.due)}</small>
                    </div>
                    <strong>{formatZAR(x.cents / 100)}</strong>
                    <span className="pill">
                      {x.status === "confirmed"
                        ? "Received"
                        : x.status === "declared"
                          ? "Awaiting confirmation"
                          : x.due < todayInSouthAfrica()
                            ? "Overdue"
                            : "Due"}
                    </span>
                    {member.isMe && x.status === "due" && (
                      <Button
                        variant="secondary"
                        disabled={disabled}
                        onClick={() => act("declare", undefined, x.id)}
                      >
                        I have paid for {x.month}
                      </Button>
                    )}
                    {plan.owner && x.status !== "confirmed" && (
                      <Button
                        variant="secondary"
                        disabled={disabled}
                        onClick={() => act("confirm", undefined, x.id)}
                      >
                        Confirm {member.name} for {x.month}
                      </Button>
                    )}
                  </article>
                );
              })
            )}
            <p className="muted small">
              Each month has its own record. Marking a contribution as sent does
              not confirm receipt.
            </p>
          </section>
        </div>
        <aside>
          {me && (plan.mode === "local" || me.method != null) && (
            <Preferences
              key={me.id}
              member={me}
              plan={plan}
              disabled={disabled}
              save={(data) => act("preferences", me.id, undefined, data)}
            />
          )}
          {plan.mode === "cloud" && (!me || me.method == null) && (
            <section className="panel">
              <h2>Your account</h2>
              <p className="muted">
                Sign in and accept your contribution to manage your private
                payment and reminder preferences. A participant link already
                claimed by another account cannot be claimed again.
              </p>
            </section>
          )}
          {plan.owner && (
            <section className="panel plan-invites">
              <h2>Invite your people</h2>
              <label className="field">
                Participant
                <select
                  aria-label="Participant"
                  value={invite?.id}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setCopied("");
                  }}
                >
                  {plan.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Plan participant link
                <input readOnly value={link} />
              </label>
              <div className="actions">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      setCopied("Link copied.");
                    } catch {
                      setCopied("Select the link and copy it manually.");
                    }
                  }}
                >
                  Copy invitation
                </Button>
                <a
                  className="button secondary"
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open participant view
                </a>
              </div>
              {copied && <p role="status">{copied}</p>}
              <p className="muted small">
                Each private link lets that person accept their amount and set
                their own preferences. Keep it with its intended recipient.
              </p>
              {plan.mode === "local" && (
                <p className="notice">
                  This plan is stored in this browser. Links work between tabs
                  here, not across devices. Local device storage is not a secure
                  boundary between people sharing this browser.
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Confirm contribution change"
      >
        {pending && (
          <>
            <p>
              Propose{" "}
              <strong>{formatZAR(pending.cents / 100)} per month</strong> for{" "}
              {pending.member.name}, replacing{" "}
              {formatZAR(pending.member.proposal.cents / 100)}.
            </p>
            <p className="muted">
              {plan.active
                ? "This takes effect no earlier than next month, after acceptance. Existing monthly records will not change."
                : "They must accept the new amount before the plan can start."}
            </p>
            <Button
              disabled={disabled}
              onClick={() =>
                act("propose", pending.member.id, undefined, {
                  cents: pending.cents,
                  revision: pending.member.proposal.revision,
                })
              }
            >
              Send new proposal
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </>
        )}
      </Modal>
    </section>
  );
}
