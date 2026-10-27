# Test payment rollout

Pay now uses Stripe test Checkout for invitations and the current participant in shared group rooms. Payment previews, cash simulation buttons, instalment/credit controls, wallet payment controls, and simulated group completion are no longer exposed. Old invitation preferences do not restore retired payment methods. The wallet route displays an unavailable notice; stored wallet/group history is retained.

The app remains labelled Test payments. The Stripe frontend flag controls availability: when disabled, checkout displays an unavailable message rather than falling back to simulated payment success. Both backend sandbox credentials and the frontend flag must still be configured as described in stripe-sandbox.md.

Stripe's backend-verified receipt confirms only a test checkout. It does not update group contributions or balances. Monthly plans continue to support their manual declaration/confirmation workflow; no wallet, lending, automatic debit or live settlement is introduced.

The former wallet/credit/group-payment UI tests are preserved under tests/legacy and excluded from the active browser suite because their controls have been retired. Receipt review was retained as an active test. New checkout, hidden-feature, legacy-link and failure regressions replace the retired simulation coverage. SQL and underlying legacy data tests remain available separately.
