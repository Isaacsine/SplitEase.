export function PaymentReturnPage({ hash: _hash }: { hash: string }) {
  return (
    <section className="panel">
      <span className="pill">Payment link</span>
      <h2>Payment processing is paused</h2>
      <p className="muted">
        This link has expired. Ask for a fresh invitation.
      </p>
      <a className="button secondary" href="#pay">
        Back to your split
      </a>
    </section>
  );
}
