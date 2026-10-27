# Review notes

## Current experience

- Purple-and-black split S logo and matching favicon.
- Shorter screens, with detailed guidance under Help.
- Help contacts: sinethembankosi70@gmail.com and WhatsApp +27 72 681 6869, supplied by the app owner.
- Visible, labelled bottom navigation on phones/tablets and top navigation on desktop. The split action bar sits above the phone navigation, with content space reserved for both and safe-area padding.
- No visible demo, simulation or prototype branding on active screens. Stripe remains clearly labelled Test payments.
- Unfinished wallet and credit controls remain unavailable; existing records are retained.

## Correctness and accessibility

Closed dialogs no longer expose hidden form controls. Browser-storage failures no longer break auth cleanup or account settings. Fetch supports all standard Headers inputs. Page import/render failures provide recovery actions. API parse and size errors return JSON without internal stacks. Both projects enforce unused-local and unused-parameter checks. Keyboard skip navigation, focus visibility and reduced-motion settings are supported.

## Validation

Run `npm run check` from splitease for the production builds, backend tests and browser suite. The completed validation covered 57 browser tests and 6 backend tests; production dependency audit reported zero known vulnerabilities. Phone and desktop screenshots were also inspected.

Browser tests run on their own port (5175), with dummy Supabase settings and mocked provider responses. They do not reuse the developer's app or require secrets from private .env files. Retired wallet/credit UI tests remain under tests/legacy, as documented in test-payment-rollout.md.

## Remaining integration limits

This is not a live-money release. Stripe receipts verify test checkout, but group balances are not reconciled with those receipts yet. Google provider configuration, physical-phone passkeys, and deployed webhook delivery still need validation against the owner's actual provider accounts. Monthly plans are manual records; the app does not collect automatically, hold pots or send payouts. No automated test suite substitutes for an independent human review of live settlement/accounting before production payments.
