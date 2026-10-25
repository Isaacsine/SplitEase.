export function PaymentReturnPage({ hash: _hash }: { hash: string }) {
  return (
    <section className="panel">
      <span className="pill">Prototype</span>
      <h2>Payment processing is paused</h2>
      <p className="muted">
        The previous gateway checkout is no longer connected. No payment is
        confirmed by this link.
      </p>
      <a className="button secondary" href="#pay">
        Back to your split
      </a>
    </section>
  );
}
