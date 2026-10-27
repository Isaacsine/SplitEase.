import { useEffect, useState } from "react";
import {
  parseInvite,
  readInvite,
  type Invite,
} from "../features/invitations/invitations.api";
import { formatZAR } from "../lib/money";
import { PaymentCheckout } from "../features/payments/PaymentCheckout";
import { Button } from "../components/ui/Button";
export function JoinShopPage({
  hash,
  landing = false,
}: {
  hash: string;
  landing?: boolean;
}) {
  const [data, setData] = useState<Invite | null>(() =>
      hash.startsWith("#join=") ? parseInvite(hash) : null,
    ),
    [loading, setLoading] = useState(hash.startsWith("#invite=")),
    [error, setError] = useState("");
  const [accepted, setAccepted] = useState(!landing);
  useEffect(() => {
    if (!hash.startsWith("#invite=")) return;
    let active = true;
    readInvite(hash.slice(8))
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hash]);
  if (loading)
    return (
      <section className="panel">
        <p role="status">Loading your invitation...</p>
      </section>
    );
  if (!data)
    return (
      <section className="panel">
        <h2>This invite is unavailable.</h2>
        <p className="muted">{error || "Ask the organiser for a new link."}</p>
        <a href="#pay">Create your own split</a>
      </section>
    );
  return (
    <section className="panel">
      <span className="pill">Payment request</span>
      <h2 className="requestheading">Hi {data.name}, here is your share.</h2>
      <p className="muted">{data.shopName}</p>
      <div className="amount">{formatZAR(data.share)}</div>
      <p className="muted">
        Your contribution towards a total of {formatZAR(data.totalAmount)}
      </p>
      {!data.verified && (
        <div className="notice">
          Untracked request. Check the amount with the sender.
        </div>
      )}
      {landing && !accepted ? (
        <div className="notice invite-landing">
          <strong>Would you like to accept this invitation?</strong>
          <p>
            No app download needed. Sign in to save this invitation.
          </p>
          <div className="actions">
            <Button onClick={() => setAccepted(true)}>Accept invitation</Button>
            <Button
              variant="ghost"
              onClick={() => {
                sessionStorage.setItem(
                  "splitease-invite-return",
                  location.hash,
                );
                location.hash = "#account";
              }}
            >
              Sign in to continue
            </Button>
            <Button variant="secondary" onClick={() => (location.hash = "#pay")}>
              Decline
            </Button>
          </div>
        </div>
      ) : (
        <PaymentCheckout share={data.share} />
      )}
      <p className="muted small">
        Test cards only. Need help? Open Help below.
      </p>
      <a className="button ghost" href="#pay">
        Create your own split
      </a>
    </section>
  );
}
