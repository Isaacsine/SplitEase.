> Historical audit: the payment gateway was subsequently removed. The current app is a frontend prototype with local payment previews. See payment-flow.md for the active behaviour.

﻿# SplitEase functional audit

Date: 24 October 2026

## Result

14 browser tests passed in installed Microsoft Edge. TypeScript checks and the production build pass. Tests cover each current page and its main controls. Payment processing remains unavailable by design. No accounts were created, emails/messages sent, or database records written during the audit.

## Fixed during this audit

- Corrected frontend/.env.local: VITE_SUPABASE_URL contained /rest/v1/ rather than just the project origin. This caused authentication and request URLs to return 404.
- Reject fractional-cent totals and custom shares; enforce positive percentages up to 100 and a total of 100%.
- Reuse matching, unexpired tracked invitations instead of inserting a new one when publishing the same split again. Block repeated clicks while publishing. Concurrent tabs still need server-side uniqueness before payments are enabled.
- Add Open request, Refresh and Try again to Activity.
- Prevent older Activity responses from repopulating requests after an authentication change or newer refresh.
- Stop native sharing from including the invitation URL twice.
- Avoid applying the new-account password length requirement to existing-account sign-in; trim email input.
- Keep dialogs open when clicking their interior padding; backdrop/close/Escape still close them.
- Validate uploaded image data before QR decoding. A malformed image previously left the scanner stuck on Opening.

## Coverage

| Page or control                                   | Verified                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Header SplitEase / Split / Activity / Scan to pay | Navigation and page content                                                                             |
| Split form                                        | Name, category, total, zero/invalid totals, persistence                                                 |
| Split method buttons                              | Equal splits and cent remainder, custom shares, percentages, validation                                 |
| Add a person                                      | Name, link, phone and email modes; invalid phone error                                                  |
| Remove participant                                | Removal and recalculation; organiser is retained                                                        |
| Dialog controls                                   | Open, Close button and Escape                                                                           |
| Create payment invites                            | Validation errors and request-list transition                                                           |
| Participant selector                              | Correct participant, share and targeted contact links                                                   |
| Copy link                                         | Clipboard write; no private contact details in invitation URL                                           |
| Share                                             | Native-share payload and copy fallback; native OS sheet itself not exercised                            |
| WhatsApp / Email invite                           | Composer URL and recipient; no external delivery attempted                                              |
| Invitation QR details                             | Expand and generated QR image                                                                           |
| Open request                                      | New-tab request details                                                                                 |
| Back to edit split / Start a new split            | Preserve editable split / reset to a new blank split                                                    |
| Your split                                        | Summary dialog and amounts                                                                              |
| Untracked invitation                              | Valid details, invalid-data handling, payment stays disabled                                            |
| Tracked invitation                                | Lookup success and expired/error handling using mocked responses                                        |
| Account                                           | Sign-in, sign-up confirmation response, mode switch, close and sign-out using mocked Supabase responses |
| Publish tracked invitation                        | Create, reuse existing token, and request URL using mocked database responses                           |
| Activity                                          | List, Open request, refresh, failure/retry and clearing after sign-out using mocked responses           |
| Camera                                            | Permission denial; start/stop and stream cleanup with a synthetic camera                                |
| QR upload                                         | Actual QR decoding, unreadable image, oversized file                                                    |
| Paste QR/link                                     | Request recognition and explicit review; executable/unsupported content is not followed                 |
| Mobile                                            | 375px viewport, no horizontal overflow, working dialogs                                                 |

## Live Supabase checks

- Authentication settings endpoint: 200; email registration is enabled.
- read_payment_request with an unknown random token: 200 with an empty result, confirming the function is deployed.
- Anonymous direct payment_requests query: 401 / permission denied. It cannot list requests.

These are read-only checks. Successful real-account sign-in, email confirmation delivery, authenticated inserts, and cross-account owner isolation were not exercised against production. The write-flow browser tests use intercepted Supabase responses, not live records.

## Remaining work

### Before real payments

1. Select and integrate a payment provider: bank-linked cellphone lookup, verified recipients, individual bank/card authorisation, payment sessions and merchant QR formats.
2. Implement trusted server-side payment amounts, signatures/webhooks, idempotency, ledger entries, settlement, failed-payment recovery and refunds. The backend directory is still a scaffold.
3. Verify real account registration/confirmation and authenticated request creation with a test account, plus owner isolation with a second account.
4. Deploy and validate the Render site. localhost invitation links cannot be opened by recipients on other devices. Verify production redirect URLs and Supabase public environment values.

### Missing account and request features

- Password reset/recovery, resend-confirmation and account-management controls.
- Cancel/revoke a tracked invitation. Editing a split currently leaves previously published snapshots valid until their seven-day expiry.
- Cloud save/load of complete split drafts. Only tracked individual invitations are stored in Supabase; the editable split remains local to the browser.
- Edit participant name/contact after adding. Contacts are intentionally memory-only, so phone/email must be re-entered after refresh; currently this requires removing and re-adding the participant.
- Atomic server-side prevention of duplicate requests from simultaneous tabs/clients.
- Optional delivery tracking/notifications. Current WhatsApp/email buttons open the user's composer; they do not guarantee a message was sent or delivered.

### Device and deployment checks still needed

- Physical phone camera/autofocus, real device share sheet, WhatsApp/email applications, and email confirmation delivery.
- Live Supabase account and RLS tests using designated test users.
- Production bundle has a scanner chunk slightly over 500 kB, loaded only when scanning. Further bundle optimisation is possible.

## Re-run

From splitease:

    npm test
    npm run build

Browser tests require Microsoft Edge and a configured Supabase public environment for the mocked account-flow cases. They do not require a real user's password.
