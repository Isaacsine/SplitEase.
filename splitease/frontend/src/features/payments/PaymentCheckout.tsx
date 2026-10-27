import { StripeSandboxCheckout } from "./StripeSandboxCheckout";
export function PaymentCheckout({ share }: { share: number }) {
  return <section className="payment-checkout" aria-label="Your contribution">
    <strong>Your contribution</strong>
    <p>Your share. One checkout.</p>
    <StripeSandboxCheckout cents={Math.round(share * 100)} />
  </section>;
}
