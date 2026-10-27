# SplitEase prototype

Split any expense using equal, custom-amount or percentage shares. Invite participants by link, bank-linked cellphone number or email, share via WhatsApp or email, and scan SplitEase invitation QR codes.

## Run

From splitease:

    npm install
    npm run dev

In a second terminal, run `npm run dev:backend` for the mock API on `http://localhost:3001`.

No payment gateway or payment credentials are required. The backend uses an in-memory mock provider and never moves money. `npm run build:backend` builds the API; `npm run build` builds the frontend.

## Prototype payments

Open an invitation and select Preview payment or Preview failed payment. Both run locally, transfer no money, collect no banking/card details and never mark a database request as paid. Reloading resets the preview. Old gateway return links cannot confirm payments.

## Optional Supabase accounts

Supabase sign-in and tracked invitations remain available. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.local. Only the first migration (202610240001_payment_requests.sql) is needed. Do not run it again if already applied. The previous sandbox migration is retained as history; it is not needed for the prototype. No existing database tables were removed.

Local split drafts exclude phone numbers/email contacts. Contacts remain unverified. Tracked invitations require sign-in; ordinary invitation links and payment previews can be explored without an account. Previews are not synced as real payments.

## Mock backend API

`POST /api/payments` accepts `{ amountCents, currency, description, simulate }`. Use `simulate: "failure"` to exercise a failed payment and an `Idempotency-Key` header for safe retries. `GET /api/payments/:id` reads a payment and `POST /api/payments/:id/refund` simulates a refund. With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured, payment records and immutable audit events persist in Supabase; without them, the API intentionally falls back to memory for local development.

## Supabase backend persistence

Apply `supabase/migrations/202610250001_backend_persistence.sql` after the existing migrations. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` or the backend deployment environment. The service-role key is backend-only and must never be exposed through `frontend/.env.local`. Existing group rooms, members and invitation data continue to use the earlier Supabase migrations.

## Render

`render.yaml` defines both the frontend Static Site and a `splitease-api` Node Web Service. Set the frontend `VITE_API_URL` to the API service URL and the API `CORS_ORIGIN` to the frontend URL.

If you previously created a Render gateway backend, it is not used by the prototype. Update existing frontend environment settings and redeploy; this source change does not delete or modify existing Render services automatically.

## Flexible contributions

Each person can choose Pay now, Cash, or an illustrative instalment plan. Mixed-method coverage and 3/4-month credit schedules are prototype-only. Cash stays pending until a cash-received preview; credit funding is simulated upfront, with the remaining borrower balance shown after the first repayment. No real loan, BNPL integration, repayment collection, or settlement occurs.

## Collaborative prototype

The expense workspace, shared groups, balances and receipt review are described in [the prototype guide](docs/prototype-guide.md). Apply the new live-room migration before using Supabase rooms across devices. All payment and credit activity remains simulated.

Group photo albums use Supabase Storage and the migration `supabase/migrations/202610250002_group_room_photos.sql`. Apply it after the live-room migrations. Photos are available to anyone holding the group link; use a private bucket with signed URLs before production if albums must be strictly private.

Group chat uses `supabase/migrations/202610250003_group_room_chat.sql`. Apply it after the photo migration. The prototype keeps the latest 100 messages per group and refreshes shared-room chat every five seconds.

Monthly plans and stokvel circles have separate chats through `supabase/migrations/202610250004_plan_chats.sql`. Stokvel chat is labelled as a circle chat so members can keep payout-order decisions and monthly updates together.

## Monthly plans

Plans supports monthly expenses and savings goals, accepted contributions, separate monthly records, private payment/reminder preferences and calendar reminder export. Device-only plans work immediately; shared plans require migration 202610240005_monthly_plans.sql and member accounts. See [monthly plans](docs/monthly-plans.md). Automatic debit remains a preview and no funds are held.

## Stokvel and wallet

Stokvel adds agreed payout rotations and month-end payout previews. Wallet adds a personal simulated balance with explicit add/move/use actions. Shared versions require migration 006 after 005. No real funds are held or transferred. See [stokvel and wallet](docs/stokvel-wallet.md).

## Pay from wallet

Deposits need only an amount. Wallet balances can fund bills, live room shares, monthly plans and stokvel contributions after explicit confirmation. Insufficient balance leaves the direct-bank preview available without deducting from the wallet. Shared payments require migration 007 after 006. See [wallet payments](docs/wallet-payments.md). All funds and bank payments remain simulated.

## Google and phone sign-in

Google sign-in and phone-only passkey sign-in are available through Supabase Auth. Enable the providers and configure the callback URL and passkey relying party before testing live. See [sign-in setup](docs/sign-in.md).
