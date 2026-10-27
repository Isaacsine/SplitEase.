# Privacy and database readiness

Saved Supabase test transactions were permanently removed: six payment events, four member payment states and two completed group flags. No rows existed in the legacy backend payment, audit, wallet receipt or wallet-entry tables. Accounts, groups, messages and photos were preserved. Stripe provider history was not deleted.

The group-photos bucket is now private. Browser drafts and settings are scoped to each signed-in account; shared devices still require signing out. Guest drafts belong to the browser. Shared payment-request summaries deliberately reveal the details included in the invitation.

## Required live database step

The new privacy migration is tested but has NOT been applied to the live database. In Supabase SQL Editor, run `supabase/migrations/202610270001_private_accounts.sql` once, after existing migrations. Verify with `select public.private_schema_version();` (expected: 1). Current backend credentials support data access but cannot apply schema changes. Cloud group and plan features fail closed until this migration is installed.

The migration binds invitations to signed-in accounts, prevents sender impersonation, protects participant preferences, restricts photo access and supports invitation revocation. Owners can revoke a selected group participant invitation; the plan revocation RPC is also available. Share participant links only with their intended recipient: the first signed-in claimant receives access.

## Remaining before live payments

The database does not yet cover the full live payment lifecycle. Add a durable payer-linked Stripe payment ledger, webhook-event deduplication, atomic payment reconciliation, refund records and a retention/deletion policy. Verify production RLS with separate real accounts after deploying the migration. Account preferences currently remain in account-scoped browser storage rather than a synced profile table. Stripe checkout stays explicitly in test mode and does not update group balances.
