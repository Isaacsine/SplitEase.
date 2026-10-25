import { useEffect, useState } from "react";
import {
  roomRefs,
  roomLink,
  roomCoverage,
  memberBalance,
  type Room,
  type RoomRef,
} from "../features/rooms/rooms";
import { ownedRoomRefs, readRoom } from "../features/rooms/rooms.api";
import { formatZAR } from "../lib/money";
import { displayDate } from "../features/payments/paymentPlans";
import { Button } from "../components/ui/Button";
export function BalancesPage() {
  const [entries, setEntries] = useState<{ room: Room; ref: RoomRef }[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    async function load() {
      const refs = roomRefs(),
        warnings: string[] = [];
      try {
        for (const ref of await ownedRoomRefs())
          if (!refs.some((r) => r.key === ref.key)) refs.push(ref);
      } catch (e) {
        warnings.push(
          e instanceof Error ? e.message : "Could not load saved rooms.",
        );
      }
      const results = await Promise.allSettled(
        refs.map(async (ref) => ({ room: await readRoom(ref), ref })),
      );
      if (active) {
        setEntries(
          results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
        );
        setErrors([
          ...warnings,
          ...results.flatMap((r) =>
            r.status === "rejected" ? [String(r.reason.message)] : [],
          ),
        ]);
        setBusy(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [version]);
  let contributions = 0,
    remaining = 0,
    completed = 0;
  const upcoming: {
    title: string;
    amount: number;
    due: string;
    url: string;
  }[] = [];
  for (const { room, ref } of entries) {
    const mine = room.members.find((m) => m.isMe);
    if (!mine) continue;
    if (["covered", "credit_funded"].includes(mine.state))
      contributions += mine.shareCents;
    if (room.completed) completed++;
    const balance = memberBalance(mine, room.createdAt.slice(0, 10));
    remaining += balance.remaining;
    if (mine.state === "credit_funded")
      for (const p of balance.plan.slice(mine.repaid))
        upcoming.push({
          title: room.title,
          amount: p.amount,
          due: p.due,
          url: roomLink(ref),
        });
  }
  upcoming.sort((a, b) => a.due.localeCompare(b.due));
  return (
    <section className="panel">
      <div className="rowtitle">
        <div>
          <span className="pill">YOUR MONEY</span>
          <h2 className="requestheading">Balances</h2>
        </div>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setVersion((v) => v + 1)}
        >
          Refresh balances
        </Button>
      </div>
      <p className="muted">
        Your contributions and upcoming repayments, all in one place. Amounts
        are simulated.
      </p>
      <div className="credit-stats">
        <div>
          <small>Contributions</small>
          <strong>{formatZAR(contributions / 100)}</strong>
        </div>
        <div>
          <small>Repayments remaining</small>
          <strong data-testid="dashboard-credit">
            {formatZAR(remaining / 100)}
          </strong>
        </div>
        <div>
          <small>Completed splits</small>
          <strong>{completed}</strong>
        </div>
      </div>
      {busy && <p role="status">Loading balances...</p>}
      {errors.length > 0 && (
        <p className="error" role="alert">
          Some rooms could not be loaded: {errors.join(" ")}
        </p>
      )}
      <h3>Upcoming repayments</h3>
      {upcoming.length ? (
        upcoming.map((p, i) => (
          <div className="funding-person" key={i}>
            <div>
              <strong>{p.title}</strong>
              <small>{displayDate(p.due)}</small>
            </div>
            <strong>{formatZAR(p.amount)}</strong>
            <a className="button secondary" href={p.url}>
              View plan
            </a>
          </div>
        ))
      ) : (
        <p className="notice">You have no upcoming repayments.</p>
      )}
      <h3>Your groups</h3>
      {entries.length
        ? entries.map(({ room, ref }) => (
            <article className="funding-person" key={room.key}>
              <div>
                <strong>{room.title}</strong>
                <small>
                  {room.mode === "demo" ? "On this device" : "Shared group"} -{" "}
                  {roomCoverage(room).percent}% covered (simulation)
                </small>
              </div>
              <span className="pill">
                {room.completed ? "Completed" : "In progress"}
              </span>
              <a className="button secondary" href={roomLink(ref)}>
                View group
              </a>
            </article>
          ))
        : !busy && (
            <p className="notice">
              Your groups will appear here once you create or join a split.
            </p>
          )}
      <a className="button ghost" href="#pay">
        Back to split
      </a>
    </section>
  );
}
