export function UnavailableFeaturePage() {
  return <section className="panel">
    <span className="pill">Test payments</span>
    <h2>Wallet is unavailable</h2>
    <p>Use Pay now on your payment invitation to open Stripe test checkout.</p>
    <a className="button secondary" href="#pay">Back to your split</a>
  </section>;
}
