# Monthly plans

Open Plans to create a Monthly expense or Savings goal. Enter people, equal or individual monthly amounts, a due day and a first month. Savings goals also have a group target. Due days 29-31 clamp to the last day of shorter months.

## Storage and accounts

On this device works immediately and shares between tabs of the same browser. Device storage is not a security boundary between people sharing that browser.

Shared online uses the configured Supabase project. Apply supabase/migrations/202610240005_monthly_plans.sql in the SQL editor. The migration is prepared but not applied automatically. The organiser signs in to create a plan and shares each member's private invitation link. Each participant signs in to accept their proposed amount. Acceptance binds that seat to their account; one account can have one seat per plan. Accepted plans appear in that member's Plans list after signing in on another device.

Payment and reminder preferences are returned only to the bound member account. Even the organiser using someone else's link cannot read or update those preferences. Link holders can read group contribution amounts and receipt statuses, so invitation links must stay with their intended recipients. The prototype does not verify bank identities or deliver invitations automatically.

## Agreements and changes

Every member, including the organiser, accepts their own proposal before the organiser starts the plan. A delayed activation begins in the current month rather than generating surprise debt for months before activation.

An amount change has a review confirmation and creates a new revision needing acceptance. Until accepted, the existing agreement continues. Active-plan changes take effect no earlier than the next month. Current and past contribution records never change; unpaid future records can follow a newly accepted agreement. Already declared or confirmed future contributions keep their original amount.

## Monthly records and savings

Each member/month has its own amount, due date and status. Members can declare their own contribution sent; only the organiser confirms receipt. Confirming February leaves unpaid January untouched. Confirmed receipts alone count towards savings progress, including separately confirmed advance contributions.

This tracks contributions to an account agreed outside SplitEase. SplitEase never holds funds, collects payments, issues credit or creates debit mandates. Automatic debit is a private preview preference only. Real deductions need a future provider and a separate authorised mandate.

## Reminders

In-app reminders appear on Plans for the current member's due/overdue records when enabled. Timing is on the due date or 1, 3 or 7 days before. The ledger also prepares the following month, so early-month reminders can appear before that month begins. Online detail views refresh automatically and catch up after reconnecting. Months are materialised when a plan is read; no background worker is required.

Save preferences and export a calendar file to import the next 12 dates, at 09:00 South African time, with calendar alerts. The file contains reminders only, not payment instructions. Calendar app settings determine delivery. Re-export after changes; turning off in-app reminders does not delete previously imported calendar events. Email, SMS and background push delivery are not connected.

## Validation

Browser tests cover acceptance, privacy, independent monthly debt, organiser-only confirmations, savings progress, amount revisions, calendar alerts, reminder opt-out, month-end/leap-year dates and phone/tablet/laptop layouts. The SQL permission test uses a temporary local PostgreSQL engine, never the hosted project. To reproduce:

1. npm install --prefix .tmp-plan-sql --no-save --package-lock=false @electric-sql/pglite
2. node tests/monthly-plans.sql.cjs
3. npx playwright test tests/monthly-plans.spec.ts

After applying the migration, verify a shared plan using two separate signed-in accounts on different devices. Hosted email, payment-provider and background-notification integration are outside this prototype.
