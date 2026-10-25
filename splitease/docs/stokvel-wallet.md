# Stokvel and wallet prototypes

Apply supabase/migrations/202610240006_stokvel_wallet.sql after migration 005 for shared stokvels and private account wallets. Device-only versions work without it. The migration has not been applied automatically.

## Stokvel

Choose Plans, New plan, Stokvel. Add people with equal monthly amounts. Each person receives one turn in a round lasting as many months as there are members. Before activation, any member can propose a different order. Every change requires fresh approval from everyone. Shared-plan acceptance requires each participant's own signed-in account.

After everyone accepts their contribution and the latest order, the organiser starts the round. Contributions and order stay fixed. Everyone keeps contributing after their own turn. No new monthly dues are generated after the final recipient's month; unpaid earlier dues stay outstanding. A new round needs a new plan and agreement.

A simulated payout becomes available at month-end in South African time only after every contribution for that month is confirmed. Opening or refreshing the plan creates one payout preview for the scheduled recipient. Only that recipient can acknowledge it. The organiser cannot acknowledge someone else's payout.

No bank transfer, collection or background task runs. Payout previews do not credit wallets. A future approved provider would handle real automatic collections and payouts.

## Wallet

Account wallets are private to the signed-in account. Device wallets are saved in this browser and accessible to people sharing it. The two storage options have separate balances; switching storage does not move money.

Add, Move out and Use are simulated ledger actions requiring explicit review and confirmation. Cancelling changes nothing. Insufficient funds and duplicate requests are rejected. There are no automatic withdrawals, fees or interest. Choosing Pay from wallet now intentionally funds a bill, plan or stokvel contribution; those debits require separate confirmation. See wallet-payments.md and migration 007. No actual funds are accepted, held or transferred.

## Verification

Run npm run build and npm test. SQL checks run against a temporary local PostgreSQL engine, never hosted Supabase:

1. npm install --prefix .tmp-plan-sql --no-save --package-lock=false @electric-sql/pglite
2. node tests/monthly-plans.sql.cjs
3. node tests/stokvel-wallet.sql.cjs

Tests cover fresh order approval, locked rounds, month-end/full-pot gating, recipient-only acknowledgement, stopped dues after one round, account privacy, wallet confirmation/cancellation, idempotency, insufficient balance and responsive layouts. Hosted verification across separate signed-in devices remains necessary after applying the migrations.
