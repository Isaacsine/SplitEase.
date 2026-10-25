# Wallet as a payment source

Depositing a simulated amount needs only an amount, with no description. The activity label is generated automatically. Balances have no expiry and remain available until the user confirms spending or a transfer. Device balances remain subject to browser storage being cleared; account data remains subject to account deletion. No real funds are deposited or held.

## Where it works

Wallet is available on individual bill invitation previews, live group shares set to Pay now, and monthly-plan/stokvel contributions that are still due. The wallet page links to Plans, splits and the QR scanner to find a contribution. Existing scanner restrictions still apply; arbitrary merchant gateways and bank QR schemes are not integrated.

A shared online contribution uses the signed-in account wallet. A device-only contribution uses the device wallet. They never draw from each other. The full contribution must be covered; the prototype does not silently split a payment between wallet and bank.

The user reviews and confirms before a deduction. An insufficient balance disables wallet payment and leaves Direct bank payment (preview) available. A bank preview never deducts from the wallet. For a plan it records the contribution as sent, awaiting organiser confirmation; no bank is actually contacted.

A wallet-funded plan contribution is recorded as confirmed in the simulated ledger, so it counts towards simulated savings/stokvel progress. A wallet-funded room share becomes covered. Individual bill previews stay separate from real bank/payment status and do not mark legacy tracked invitations paid. Stokvel payout previews do not automatically credit the wallet.

## Setup and protection

Apply supabase/migrations/202610240007_wallet_payments.sql after migration 006, with the prior room and plan migrations already installed. It has not been applied to hosted Supabase automatically.

The wallet_pay RPC verifies the payer, destination and exact amount. A single database transaction locks the target and payer wallet, debits the balance, saves a unique receipt and updates the contribution. Any failure rolls back the debit. Retrying a request is idempotent; the same contribution cannot be funded twice with different requests. Wallet receipts are private.

Device payments serialise wallet writes across tabs using Web Locks and restore the old state if persistence fails. Device storage is still a prototype convenience rather than a shared financial database.

## Checks

Browser tests cover description-free deposits, stokvel funding, room coverage, restaurant-style bill previews, insufficient funds with bank fallback, duplicate invoices and concurrent wallet spending. Run npx playwright test tests/wallet-payments.spec.ts. SQL checks cover atomicity, ownership, exact amounts, idempotency and insufficient balance: node tests/wallet-payments.sql.cjs (using the temporary PGlite setup described in monthly-plans.md). No hosted accounts or real transfers are created by these checks.

## Transfer destinations

The wallet Transfer form requires either a bank recipient or a specific unpaid plan/stokvel contribution. Bank previews require the holder, bank name and account number; confirmation names the destination and activity records only masked account details. The full account number is not saved or sent to the API. Bank previews do not send real funds.

Contribution transfers list only the current member's unpaid records in the same wallet storage. Selecting a month fills its agreed amount. Confirmation uses the existing atomic wallet-pay operation, updates that contribution and removes it from the unpaid destination list. No new database migration is required beyond wallet payments migration 007.
