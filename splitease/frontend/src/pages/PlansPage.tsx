import { useEffect, useState, type FormEvent } from "react";
import { createPlan, listPlans } from "../features/plans/plans.api";
import {
  addMonth,
  thisMonth,
  moneyCents,
  planLink,
  remindersFor,
  type Plan,
  type PlanRef,
} from "../features/plans/plans";
import { formatZAR } from "../lib/money";
import {
  displayDate,
  todayInSouthAfrica,
} from "../features/payments/paymentPlans";
import { Button } from "../components/ui/Button";
export function PlansPage() {
  const [entries, setEntries] = useState<{ ref: PlanRef; plan: Plan }[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [kind, setKind] = useState<Plan["kind"]>("expense"),
    [equal, setEqual] = useState(true),
    [people, setPeople] = useState([
      { id: crypto.randomUUID(), name: "You", amount: "500" },
      { id: crypto.randomUUID(), name: "", amount: "500" },
    ]);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await listPlans();
      setEntries(result.entries);
      setError(result.warnings.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plans.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const ref = await createPlan(
        {
          title: String(f.get("title") || ""),
          kind,
          target: kind === "savings" ? moneyCents(String(f.get("target"))) : 0,
          day: Number(f.get("day")),
          start: String(f.get("start")),
          members: people.map((p) => ({
            name: p.name,
            cents: moneyCents(equal ? String(f.get("equalAmount")) : p.amount),
          })),
        },
        f.get("storage") === "local" ? "local" : "cloud",
      );
      location.hash = planLink(ref).split("#")[1];
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create plan.");
    } finally {
      setBusy(false);
    }
  }
  const reminders = entries.flatMap((e) =>
    remindersFor(e.plan).map((x) => ({ ...x, plan: e.plan, ref: e.ref })),
  );
  return (
    <section className="plans-page">
      <div className="workspace-heading">
        <div>
          <p className="workspace-kicker">EVERY MONTH</p>
          <h1>Monthly plans &amp; stokvels</h1>
          <p className="muted">
            Rent, savings and stokvels. Keep each month accounted for.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(!creating);
            setError("");
          }}
        >
          {creating ? "Close form" : "New plan"}
        </Button>
      </div>
      <p className="muted small">
        Agree an amount. Keep track each month.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {creating && (
        <form className="panel plan-create" onSubmit={submit}>
          <h2>Create a monthly plan</h2>
          <div className="payment-options" aria-label="Plan type">
            <button
              type="button"
              className={
                kind === "expense"
                  ? "payment-option selected"
                  : "payment-option"
              }
              aria-pressed={kind === "expense"}
              onClick={() => setKind("expense")}
            >
              Monthly expense<small>Rent and recurring bills</small>
            </button>
            <button
              type="button"
              className={
                kind === "savings"
                  ? "payment-option selected"
                  : "payment-option"
              }
              aria-pressed={kind === "savings"}
              onClick={() => setKind("savings")}
            >
              Savings goal<small>Build towards something together</small>
            </button>
            <button
              type="button"
              className={
                kind === "stokvel"
                  ? "payment-option selected"
                  : "payment-option"
              }
              aria-pressed={kind === "stokvel"}
              onClick={() => {
                setKind("stokvel");
                setEqual(true);
              }}
            >
              Stokvel<small>One recipient each month, in an agreed order</small>
            </button>
          </div>
          <div className="grid">
            <label className="field">
              Plan name
              <input
                name="title"
                required
                maxLength={100}
                placeholder={
                  kind === "expense"
                    ? "e.g. Our monthly rent"
                    : "e.g. Holiday savings"
                }
              />
            </label>
            {kind === "savings" && (
              <label className="field">
                Group savings target (R)
                <input
                  name="target"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                />
              </label>
            )}
            <label className="field">
              First month
              <input
                name="start"
                type="month"
                defaultValue={thisMonth()}
                min={thisMonth()}
                max={addMonth(thisMonth(), 12)}
                required
              />
            </label>
            <label className="field">
              Monthly due day
              <input
                name="day"
                type="number"
                min="1"
                max="31"
                defaultValue="1"
                required
              />
            </label>
          </div>
          <p className="muted small">
            For shorter months, the due date moves to the last day of that
            month.
          </p>
          <h3>People & contributions</h3>
          <label className="assignment-choice">
            <input
              type="checkbox"
              checked={equal}
              disabled={kind === "stokvel"}
              onChange={(e) => setEqual(e.target.checked)}
            />
            Everyone contributes the same amount
          </label>
          {equal && (
            <label className="field">
              Monthly amount per person (R)
              <input
                name="equalAmount"
                defaultValue="500"
                type="number"
                step="0.01"
                min="0.01"
                max="1000000"
                required
              />
            </label>
          )}
          {people.map((p, i) => (
            <div className="plan-person-input" key={p.id}>
              <label className="field">
                {i === 0 ? "Your name" : "Person " + (i + 1)}
                <input
                  value={p.name}
                  maxLength={60}
                  required
                  onChange={(e) =>
                    setPeople((old) =>
                      old.map((x) =>
                        x.id === p.id ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              {!equal && (
                <label className="field">
                  {p.name || "Person " + (i + 1)} monthly amount (R)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="1000000"
                    value={p.amount}
                    required
                    onChange={(e) =>
                      setPeople((old) =>
                        old.map((x) =>
                          x.id === p.id ? { ...x, amount: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
              )}
              {i > 0 && people.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={"Remove person " + (i + 1)}
                  onClick={() =>
                    setPeople((old) => old.filter((x) => x.id !== p.id))
                  }
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={people.length >= 20}
            onClick={() =>
              setPeople((old) => [
                ...old,
                { id: crypto.randomUUID(), name: "", amount: "500" },
              ])
            }
          >
            Add a person
          </Button>
          <label className="field">
            Where to save
            <select name="storage" defaultValue="cloud">
              <option value="cloud">Shared online - sign-in required</option>
              <option value="local">On this device only</option>
            </select>
          </label>
          <p className="muted small">
            A device-only plan works between tabs of this browser. Use a shared
            online plan for other people's devices.
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create plan"}
          </Button>
        </form>
      )}
      {!creating && (
        <>
          <section
            className="panel plan-reminders"
            aria-label="Contribution reminders"
          >
            <h2>Reminders</h2>
            {reminders.length ? (
              reminders.map((x) => (
                <div className="funding-person" key={x.id}>
                  <div>
                    <strong>{x.plan.title}</strong>
                    <small>
                      {x.due < todayInSouthAfrica() ? "Overdue" : "Due soon"} -{" "}
                      {displayDate(x.due)}
                    </small>
                  </div>
                  <strong>{formatZAR(x.cents / 100)}</strong>
                  <a className="button secondary" href={planLink(x.ref)}>
                    View contribution
                  </a>
                </div>
              ))
            ) : (
              <p className="muted">
                You're all caught up. Upcoming and overdue contributions appear
                here when reminders are enabled.
              </p>
            )}
            <p className="muted small">
              In-app reminders update when you open Plans. Export calendar
              reminders from your plan for alerts when the app is closed. Email,
              SMS and background push are not connected.
            </p>
          </section>
          {loading ? (
            <p role="status">Loading plans...</p>
          ) : entries.length ? (
            <div className="plan-list">
              {entries.map(({ ref, plan: p }) => (
                <a className="panel plan-tile" key={p.key} href={planLink(ref)}>
                  <span className="pill">
                    {p.kind === "stokvel"
                      ? "Stokvel"
                      : p.kind === "savings"
                        ? "Savings goal"
                        : "Monthly expense"}
                  </span>
                  <h2>{p.title}</h2>
                  <p className="muted">
                    {p.members.length} people - Due on day {p.day}
                  </p>
                  <div className="receipt">
                    <span>
                      {p.active ? "Active" : "Waiting for agreements"}
                    </span>
                    <strong>View plan &#8594;</strong>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="panel empty-plans">
              <h2>Make a monthly plan</h2>
              <p className="muted">
                Agree what each person contributes, then track every month
                separately.
              </p>
              <Button variant="secondary" onClick={() => setCreating(true)}>
                Create your first plan
              </Button>
            </div>
          )}
          <Button variant="ghost" disabled={loading} onClick={load}>
            Refresh plans
          </Button>
        </>
      )}
    </section>
  );
}
