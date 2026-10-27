import { useEffect, useState } from "react";
import { listRequests } from "../features/invitations/invitations.api";
import { formatZAR } from "../lib/money";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/Button";
export function ActivityPage() {
  const [requests, setRequests] = useState<
      Awaited<ReturnType<typeof listRequests>>
    >([]),
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
      listRequests()
        .then((r) => {
          if (active && current === sequence) {
            setRequests(r);
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
      <p className="muted">Private to your account. Only sent invitations are shared.</p>
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
                : "Shared request"}
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

    </section>
  );
}
