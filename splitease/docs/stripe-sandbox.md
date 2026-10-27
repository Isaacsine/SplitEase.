# Stripe sandbox setup

This integration uses Stripe-hosted Checkout for an invitation's Pay now share. It accepts ZAR amounts from R10 to R100,000, requires test secret keys, rejects live sessions/events, and never funds wallets or marks group bills paid. Pay now uses Stripe test checkout. Wallet and credit controls are hidden; there is no simulated-success fallback.

## 1. Create your Stripe sandbox

Open https://dashboard.stripe.com/sandboxes and create/select a sandbox from the account picker. Inside that sandbox, open Developers / API keys (the dashboard may place this under Workbench). Copy its secret key starting with `sk_test_`. Use the same sandbox for the API key, CLI and webhook endpoint. Do not use `sk_live_` keys. No publishable key or Stripe.js is required for this hosted redirect flow.

If your account cannot create a sandbox, resolve account access with Stripe rather than selecting an inaccurate business country. Sandbox preparation does not establish eligibility for live Stripe processing in South Africa.

## 2. Install and connect the Stripe CLI

Install the official CLI using https://docs.stripe.com/cli/install, then run:

```powershell
stripe login
stripe login list
stripe switch
stripe listen --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to http://127.0.0.1:3001/api/stripe/webhook
```

Use `stripe login list` to inspect available environments and `stripe switch` to select the same sandbox in the CLI. New CLI versions may require an administrator to enable Settings > Team and security > MCP and CLI access first. If your CLI is connected to a different account or sandbox, follow `stripe login --help` / the CLI's sandbox selection instructions before continuing. Keep this terminal running. Copy the `whsec_...` signing secret printed by this listener. It is different from an endpoint secret in the dashboard.

## 3. Configure the backend

From the `splitease` folder, create `backend/.env` if it does not exist. If it already exists, edit only these settings and preserve existing account settings:

```dotenv
PORT=3001
CORS_ORIGIN=http://127.0.0.1:5173
APP_URL=http://127.0.0.1:5173
STRIPE_SANDBOX_ENABLED=true
STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_YOUR_SANDBOX_SECRET
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_YOUR_LISTENER_SECRET
```

Keep both secrets backend-only, out of Git, logs, screenshots and chat. The template `backend/.env.example` contains blank keys and defaults to disabled. Supabase authentication is required for checkout and receipts. Configure the backend SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), and the matching frontend Supabase URL and public key. Sign in before starting checkout. Never put a server secret in the frontend.

## 4. Enable the frontend button

Create/edit `frontend/.env.local`, preserving your existing Supabase settings:

```dotenv
VITE_STRIPE_SANDBOX_ENABLED=true
```

Leave `VITE_API_URL` blank locally to use Vite's `/api` proxy. Never place a Stripe secret in a `VITE_` variable. `APP_URL` must match the frontend origin you actually open. The default local URL is `http://127.0.0.1:5173`; restart/stop other Vite servers if port 5173 is occupied.

## 5. Run the app

From `splitease`, install dependencies with `npm ci` if needed. In a second terminal:

```powershell
npm run dev:backend
```

In a third terminal:

```powershell
npm run dev
```

Leave the Stripe listener, backend and frontend running. Open `http://127.0.0.1:5173`, create a split, create payment invites, and open an invitation using its Open request action or copied Invite link. Choose Pay now. Select **Test RÃ¢â‚¬Â¦ with Stripe** in the Stripe sandbox panel.

## 6. Complete a test checkout

Use test card `4242 4242 4242 4242`, any future expiry and any three-digit CVC. Enter any required test name/address/email. For a declined payment use `4000 0000 0000 0002`; Stripe should keep the customer on checkout without a successful return. For a 3D Secure authentication scenario use `4000 0025 0000 3155` and complete or fail the test challenge.

After success, the app displays **Test payment confirmed** only when the backend retrieves a complete, paid session from Stripe. A query string saying `status=succeeded` cannot confirm it. The CLI should show the webhook delivery with HTTP 200; the backend logs only the event ID, session ID and sandbox status. Cancelling returns to **Checkout cancelled**. Retry a pending status using **Check payment status**.

Sessions remain visible in your Stripe sandbox after an app restart. Do not publish/share session IDs: they act as identifiers for the limited status endpoint. The webhook verifies Stripe's raw-body signature and acknowledges events; it does not fulfil orders or mutate balances. Retry delivery is safe because it has no monetary/database side effects.

## 7. Hosted sandbox on Render (optional)

For combined frontend/backend hosting, set backend `APP_URL` and `CORS_ORIGIN` to the exact frontend HTTPS origin, set the three backend Stripe variables above, and set frontend build variable `VITE_STRIPE_SANDBOX_ENABLED=true`. For separate services, also set frontend `VITE_API_URL` to the backend HTTPS URL. Redeploy the frontend after changing any `VITE_` variables.

Inside the SAME Stripe sandbox, add an event destination/webhook with **snapshot events**, pointing to `https://YOUR-API/api/stripe/webhook`. Select the four `checkout.session.*` events listed in step 2. Use that endpoint's `whsec_...` secret in Render, replacing the local CLI listener secret. The endpoint must be on the backend service, not the frontend Static Site. No database migration is required for this sandbox integration.

## Verification commands

```powershell
npm run test:stripe --workspace backend
npm run build:backend
npm run build
$env:VITE_STRIPE_SANDBOX_ENABLED='true'
npm test -- tests/stripe-sandbox.spec.ts --workers=1
```

Automated tests mock Stripe API responses and use the real SDK signature verifier. A real hosted checkout needs your own sandbox credentials; it has not been exercised against your account.

## Troubleshooting

- Button missing: set the frontend flag and restart Vite / rebuild the frontend.
- Sandbox disabled / 503: enable the BACKEND flag and restart it.
- Invalid API key / checkout 502: use an actual `sk_test_` key from the intended sandbox; confirm Cards is enabled in that sandbox and inspect Stripe request logs. The installed SDK uses its bundled API version.
- Webhook 400: use the exact signing secret for the listener/endpoint delivering the event. Preserve the raw body; the app already mounts the webhook before JSON parsing.
- Status 404: the backend key is from a different sandbox, the session is missing, or it belongs to another integration.
- Redirect reaches the wrong site: correct backend `APP_URL` and create a NEW checkout.

This is an isolated sandbox demonstration with a client-supplied amount, not a live settlement integration. A live version needs server-owned bill amounts, authenticated payer/recipient records, durable accounting, webhook fulfilment, onboarding and provider approval for the intended funds flow.

References: [Stripe sandboxes](https://docs.stripe.com/sandboxes), [test cards](https://docs.stripe.com/testing), [CLI listener](https://docs.stripe.com/cli/listen), [webhook verification](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors).
