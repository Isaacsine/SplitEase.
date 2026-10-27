import { useEffect, useState } from "react";
import {
  roomRefs,
  roomLink,
  type Room,
  type RoomRef,
} from "../features/rooms/rooms";
import { ownedRoomRefs, readRoom } from "../features/rooms/rooms.api";
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
      <p className="muted">Your groups, together. Stripe test results are shown on receipts.</p>
      {busy && <p role="status">Loading balances...</p>}
      {errors.length > 0 && (
        <p className="error" role="alert">
          Some rooms could not be loaded: {errors.join(" ")}
        </p>
      )}
      <h3>Your groups</h3>
      {entries.length
        ? entries.map(({ room, ref }) => (
            <article className="funding-person" key={room.key}>
              <div>
                <strong>{room.title}</strong>
                <small>
                  {room.mode === "demo" ? "On this device" : "Shared group"} -{" "}
                  Saved group
                </small>
              </div>
              <span className="pill">
                Test payments
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
