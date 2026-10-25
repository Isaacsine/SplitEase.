# Prototype payment flow

1. Create a split and add participants.
2. Choose equal amounts, custom amounts or percentages.
3. Create individual invitation links. Copy/share them, or generate an invitation QR code.
4. A recipient opens a link or scans a SplitEase QR code and reviews their share.
5. Preview a successful or failed payment locally. The screen explicitly says no money moves.
6. Try the preview again or reload to reset it. The request remains unpaid in Supabase.

There is no gateway, bank debit, card collection, merchant QR settlement, server payment API, or payment webhook. Phone numbers are unverified contact details. Supabase accounts and tracked invitations remain available; they store requests, not payment completion.

## Flexible payment choices

Each participant can suggest Pay now, Cash, or Pay in instalments. Instalments use an illustrative three- or four-month schedule, with the first repayment today and no fees or interest included in the example. Whole-cent amounts sum exactly to the participant's share; future dates clamp to the end of the month when necessary.

The group coverage preview treats cash as pending until a local cash-received preview is selected. Instalment shares are shown as covered only when simulated upfront funding is previewed. The borrower owes the illustrative credit provider the remaining balance after the first repayment. This is no real approval, loan, cash receipt or settlement, and no credit liability is created. No Payflex/PayJustNow integration is active.

Preferences are saved in the local split draft and suggested in invitation links (including tracked link parameters). They are not stored as credit agreements in Supabase. Recipients can change their local preference. Repayment simulations and cash confirmation do not sync between devices or update real payment status.
