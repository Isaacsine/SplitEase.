import { useEffect, useState } from "react";
import { listRequests } from "../features/invitations/invitations.api";
import { formatZAR } from "../lib/money";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { listGroupHistory } from "../features/rooms/rooms.api";
import type { Room } from "../features/rooms/rooms";
export function ActivityPage() {
  const [requests, setRequests] = useState<
      Awaited<ReturnType<typeof listRequests>>
    >([]),
    [groups, setGroups] = useState<Room[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true,
      sequence = 0;
    const load = () => {
      if (!active) return;
      const current = ++sequence;
      setLoading(true);
      setError("");
      setRequests([]);
      Promise.all([listRequests(), listGroupHistory()])
        .then(([r, g]) => {
          if (active && current === sequence) {
            setRequests(r);
            setGroups(g);
          }
        })
        .catch((e) => {
          if (active && current === sequence) setError(e.message);
        })
        .finally(() => {
          if (active && current === sequence) setLoading(false);
        });
    };
    load();
    const sub = supabase?.auth.onAuthStateChange(() => {
      sequence++;
      setRequests([]);
      setTimeout(load, 0);
    });
    return () => {
      active = false;
      sequence++;
      sub?.data.subscription.unsubscribe();
    };
  }, [version]);
  return (
    <section className="panel">
      <div className="rowtitle">
        <h2>Your activity</h2>
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => setVersion((v) => v + 1)}
        >
          Refresh
        </Button>
      </div>
      <p className="muted">Your shared payment requests.</p>
      {loading ? (
        <p role="status">Loading requests...</p>
      ) : error ? (
        <div className="error" role="alert">
          {error}
          <Button variant="secondary" onClick={() => setVersion((v) => v + 1)}>
            Try again
          </Button>
        </div>
      ) : requests.length ? (
        requests.map((r) => (
          <article className="person" key={r.id}>
            <div className="details">
              <strong>{r.title}</strong>
              <small className="muted">
                {r.recipient_name} -{" "}
                {new Date(r.created_at).toLocaleDateString("en-ZA")}
              </small>
            </div>
            <strong>{formatZAR(r.amount_cents / 100)}</strong>
            <span className="pill">
              {new Date(r.expires_at).getTime() < Date.now()
                ? "Expired"
                : "Not paid"}
            </span>
            {new Date(r.expires_at).getTime() >= Date.now() && (
              <a className="button secondary" href={"#invite=" + r.token}>
                Open request
              </a>
            )}
          </article>
        ))
      ) : (
        <div className="notice">
          No requests yet. Create a split and share an invitation to get
          started. Sign in to keep requests in your account.
        </div>
      )}
      <a className="button secondary" href="#pay">
        Create a split
      </a>
      <section className="group-history" aria-labelledby="group-history-heading">
        <div className="rowtitle">
          <div>
            <h2 id="group-history-heading">Previous groups</h2>
            <p className="muted">
              Read-only history of groups, participants, payment amounts, and
              times.
            </p>
          </div>
        </div>
        {groups.length ? (
          <div className="table-scroll">
            <table className="history-table">
              <caption>Previous groups and participant payments</caption>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Person added</th>
                  <th>Added at</th>
                  <th>Amount due</th>
                  <th>Amount paid</th>
                  <th>Status</th>
                  <th>Payment time</th>
                </tr>
              </thead>
              <tbody>
                {groups.flatMap((room, groupIndex) => {
                  const paidStates = ["covered", "credit_funded"];
                  const relevantActions = ["pay", "cash", "credit", "repay"];
                  const date = (value: string) =>
                    new Intl.DateTimeFormat("en-ZA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Africa/Johannesburg",
                    }).format(new Date(value));
                  const rows = room.members.map((member) => {
                    const joined = room.events?.find(
                      (event) =>
                        event.memberId === member.id &&
                        event.action === "joined",
                    );
                    const payment = room.events?.find(
                      (event) =>
                        event.memberId === member.id &&
                        relevantActions.includes(event.action),
                    );
                    const paid = paidStates.includes(member.state);
                    return (
                      <tr key={room.key + ":" + member.id}>
                        <td>
                          <strong>{room.title}</strong>
                          <small className="muted">
                            {room.mode === "cloud" ? "Shared" : "Device"} ·{" "}
                            {formatZAR(room.totalCents / 100)} total
                          </small>
                        </td>
                        <td>{member.name}</td>
                        <td>{date(joined?.createdAt || room.createdAt)}</td>
                        <td>{formatZAR(member.shareCents / 100)}</td>
                        <td>{formatZAR(paid ? member.shareCents / 100 : 0)}</td>
                        <td>
                          <span className="pill">{paid ? "Paid" : "Pending"}</span>
                        </td>
                        <td>{payment ? date(payment.createdAt) : "Not paid"}</td>
                      </tr>
                    );
                  });
                  return [
                    <tr className="history-group-row" key={room.key}>
                      <th colSpan={7} scope="rowgroup">
                        <strong>
                          Group {groupIndex + 1}: {room.title}
                        </strong>
                        <small>
                          Created {date(room.createdAt)} ·{" "}
                          {room.mode === "cloud" ? "Shared group" : "Device group"}{" "}
                          · {formatZAR(room.totalCents / 100)} total
                        </small>
                      </th>
                    </tr>,
                    ...rows,
                  ];
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="notice">
            No previous groups yet. Start a group split to create an immutable
            history record.
          </div>
        )}
      </section>
    </section>
  );
}
