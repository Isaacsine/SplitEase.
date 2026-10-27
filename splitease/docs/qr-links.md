# External QR links

Invitation QR codes contain complete links to the relevant request page. Group and plan links use the same public app address. External phone cameras open these links in the browser; the QR code itself does not confirm or make a payment.

## Setup

1. Deploy the frontend to an HTTPS address accessible from another phone.
2. In the frontend build environment, set `VITE_PUBLIC_APP_URL=https://your-actual-domain.com/`. Include any deployment subdirectory. Do not include a query or `#` fragment. This is a public configuration value, not a secret.
3. Use the same Supabase project for the deployed app. Keep the backend and Google redirect settings consistent with the deployed address.
4. Restart Vite locally, or rebuild and redeploy for production. Vite embeds this value at build time.
5. Create a fresh invitation, select Show invitation QR code, then scan it with a separate phone camera. Confirm the address is your deployed domain and the recipient/amount are correct.
6. Check a private group invitation using separate signed-in accounts. Scanning does not bypass account membership or the required privacy migration.

If the setting is blank, links use the address currently open in the browser. That works on a deployed site, but localhost links cannot be opened on another person's phone. No production domain has been assumed or provisioned by this change: fill in the setting after deployment. Existing printed or saved QR images keep their original URLs and must be regenerated.

Untracked payment invitations include their summary in the link. Tracked invitations load their limited summary from Supabase. Browser-only groups/plans do not become shared databases by changing the URL; use cloud-backed invitations for other devices. The in-app scanner trusts only the current app and the configured public app address, rather than arbitrary external QR destinations.
