# SplitEase: problems, fixes and verification

Prepared: 27 October 2026

This document explains the issues addressed in the app, how they were fixed, how to check the results, and what still requires setup. It records completed code changes separately from provider configuration and database work that has not been applied. No API keys or credentials belong in this document.

## 1. Google sign-in returned to an app that still showed ?Sign in?

### Problem

After completing Google sign-in, the account button could still display ?Sign in?. The callback URL included `#account`, while Supabase also uses the URL fragment to return authentication tokens. This was an identified callback conflict; the previous browser mock replaced the fragment, so it did not exercise that case. Account initialization also allowed an older session lookup to overwrite a newer authentication event.

### How it was fixed

1. Inspected the Supabase client, startup code, account component and authentication tests.
2. Removed `#account` from the Google `redirectTo` URL in `frontend/src/components/layout/Account.tsx`. The callback now uses the current origin and pathname.
3. Kept the original app route in temporary session storage before leaving for Google.
4. Let Supabase process the returned tokens before restoring the app route.
5. Subscribed to authentication changes before completing the account component's initial session lookup.
6. Added guards so a stale lookup cannot replace a newer authentication event or update an unmounted component.
7. Based the signed-in state on the existence of a user, with a fallback label when an email is absent.
8. Changed the Google test to model an authentication server appending a token fragment instead of silently replacing the app fragment.
9. Checked that the account button, email, original route and session survive the callback and a reload.

### Verification and remaining setup

Frontend TypeScript checks and all 15 targeted authentication/privacy browser tests passed after this change. These tests mock provider responses; they do not prove that the owner's real Google/Supabase configuration is correct.

To verify manually:

1. In Supabase, open Authentication ? URL Configuration.
2. Allow the exact app callback URL, including the correct protocol, host, port and path. `localhost` and `127.0.0.1` are different hosts.
3. Open that same app URL and choose Continue with Google.
4. Complete Google sign-in. Confirm that the header shows Account instead of Sign in.
5. Open Account, confirm your email, then reload and check that you remain signed in.
6. Sign out and check that the account controls return to the signed-out state.

References: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) and [Supabase implicit flow](https://supabase.com/docs/guides/auth/sessions/implicit-flow).

## 2. Google reported ?Unsupported provider: provider is not enabled?

### Problem

Supabase rejected the Google request before an account session could be created. This message indicates that Google is not enabled for the Supabase project receiving the request.

### Resolution steps

1. Open the Supabase project used by the frontend environment settings.
2. Open Authentication ? Sign In / Providers ? Google.
3. Configure the Google OAuth client credentials and enable the provider.
4. Use the callback URI supplied by Supabase in the Google OAuth client configuration.
5. Configure the app redirect URL as described in section 1.
6. Retry Google sign-in against the same project.

This is an external configuration requirement. The code changes do not enable a provider in the Supabase dashboard. Actual provider configuration still needs a real sign-in check.

## 3. Test payment simulations could look like real transactions

### Problem

The earlier interface exposed simulated payment, credit, wallet and group-completion actions. Users could mistake those states for completed financial transactions.

### How it was fixed

1. Replaced the active Pay now flow with Stripe-hosted test Checkout.
2. Removed simulated-success fallback behavior.
3. Hid unfinished wallet and credit controls and made the old wallet route unavailable.
4. Prevented old invitation preferences and payment-return links from restoring simulated payment behavior.
5. Removed the active backend mock-payment route.
6. Kept the Test payments label visible.
7. Kept monthly plans as manual records, without presenting them as automatic collections or payouts.
8. Added regression checks for unavailable checkout, legacy links and hidden simulation controls.

A successful Stripe test receipt does not currently update group balances. The app is not ready for live settlement.

## 4. Saved test transactions remained in the app/database

### Problem

Test payment history and completed-payment flags could mislead future users. The app owner explicitly requested permanent deletion of saved test transactions.

### How it was fixed

1. Inspected the relevant Supabase tables and payment-related records.
2. Reset four group-member test payment states, including their repaid amounts.
3. Cleared two completed-group test flags.
4. Deleted six existing payment-related group events and removed reset events generated during cleanup.
5. Verified that the targeted payment-event and test-state counts were zero.
6. Added startup cleanup for retired browser wallet data, payment events and test completion states.
7. Removed the misleading group transaction-history display from Activity.

Accounts, groups, messages and photos were preserved. This cleanup did not delete Stripe's own provider history, and it does not guarantee that copies of old browser data have already been cleared on devices that have not reopened the updated app.

## 5. Account data and shared content needed stronger privacy

### Problem

Browser data was not consistently separated by account. Shared-content paths needed stronger checks for signed-in membership, sender identity and private participant settings. The group-photo bucket was public.

### How it was fixed

1. Added `frontend/src/lib/privateStorage.ts` to separate drafts and settings by account.
2. Rotated the guest storage scope on sign-out and remounted account-dependent page content when identity changes.
3. Added account-scope checks to stop delayed requests from continuing under a different signed-in account.
4. Added `frontend/src/lib/privateCloud.ts` to pin cloud operations to the initiating session.
5. Changed the actual Supabase `group-photos` bucket to private.
6. Replaced permanent public photo URLs with authorized, short-lived signed URLs.
7. Wrote `supabase/migrations/202610270001_private_accounts.sql` to bind invitations to signed-in accounts, prevent chat impersonation, protect participant preferences and enforce photo membership.
8. Added group invitation revocation controls and a plan invitation revocation database function.
9. Added a schema-version check so the updated app blocks cloud groups/plans until the privacy migration is installed.
10. Tested the migration in an isolated database with an owner, invited member and unrelated user.

### Required database step ? not yet completed on the live database

The migration was tested but was not applied to the live Supabase database during this work. Available credentials allowed record cleanup and storage changes, but not schema changes.

1. Open the correct Supabase project and its SQL Editor.
2. Confirm earlier project migrations have been applied.
3. Open `supabase/migrations/202610270001_private_accounts.sql` from this repository.
4. Run its complete contents once.
5. Run `select public.private_schema_version();` and confirm the result is `1`.
6. Test with separate real accounts: an owner, an invited member and someone without an invitation.
7. Confirm that the unrelated account cannot read private group content or photos, and that revoking an invitation removes that participant's access.

Browser storage separation is not encryption. Someone controlling a shared device can inspect browser storage. Guest drafts belong to that browser; users should sign in and sign out on shared devices. Invitation links intentionally share their included details, and the first signed-in claimant of a participant invitation receives access.

## 6. Checkout and receipts needed payer ownership checks

### Problem

A payment session or receipt must not be available merely because a caller knows its identifier.

### How it was fixed

1. Required a signed-in bearer token for checkout and receipt requests.
2. Verified the token with Supabase instead of trusting decoded token claims.
3. Stored the verified payer ID in Stripe Checkout and PaymentIntent metadata.
4. Scoped retry/idempotency keys to the payer.
5. Checked receipt/session ownership before returning payment details.
6. Kept webhook requests authenticated by Stripe signature verification.
7. Tested anonymous callers, invalid credentials and access by another payer.

The seven backend tests passed, including ownership and webhook-signature checks. Durable payment accounting and webhook-event deduplication still need implementation before live payments.

## 7. Screens were too wordy and some controls were hidden or difficult to use

### How it was fixed

1. Shortened primary-screen copy and moved detailed guidance into Help.
2. Added the owner-supplied support email and WhatsApp contact.
3. Added the purple-and-black split S logo and matching favicon.
4. Added visible bottom navigation on phones and reserved space so fixed controls do not cover content.
5. Corrected closed-dialog behavior so hidden form controls are not exposed.
6. Added recovery screens for page-loading failures and safer handling for browser-storage failures.
7. Checked keyboard navigation, small-screen layouts and retired-feature routes.

Help contacts are `sinethembankosi70@gmail.com` and WhatsApp `+27 72 681 6869`.

## 8. Validation performed

The full `npm run check` passed before the final Google callback fix:

- Frontend production build and TypeScript checks.
- Backend build and seven backend tests.
- Isolated SQL privacy tests.
- All 62 active browser tests.

After the photo account-switch guard, TypeScript and all five privacy browser tests passed again. After the Google callback/session fix, TypeScript and all 15 targeted authentication/privacy tests passed. The entire 62-test suite was not rerun after that final Google change.

To repeat the complete validation from the `splitease` directory:

```powershell
npm run check
```

For the focused Google/session/privacy checks:

```powershell
npx tsc --noEmit -p frontend/tsconfig.json
npx playwright test tests/auth-methods.spec.ts tests/auth-session.spec.ts tests/privacy.spec.ts
```

Browser tests use a separate test server, dummy Supabase configuration and mocked external-provider responses. SQL tests use an isolated database. These checks do not apply live migrations or substitute for testing deployed OAuth, physical-phone passkeys, webhook delivery or an independent code review.

## 9. Remaining work before live payments

1. Apply and verify the live privacy migration.
2. Verify Google sign-in on the actual deployed app and passkeys on physical supported phones.
3. Add a durable Stripe payment ledger linked to each payer.
4. Store processed webhook event IDs to prevent duplicate accounting updates.
5. Reconcile verified payments with group contributions atomically.
6. Add refund accounting and define retention/deletion rules.
7. Decide whether account preferences need a synced profile table; they currently remain in account-scoped browser storage.
8. Validate deployed webhook delivery and obtain an independent review before enabling live-money flows.

Related documents: [Privacy readiness](privacy-readiness.md), [Stripe sandbox setup](stripe-sandbox.md), [Test payment rollout](test-payment-rollout.md), and [Review notes](review-notes.md). The historical review/rollout notes describe earlier stages; this document records the later test-data cleanup and validation totals.
