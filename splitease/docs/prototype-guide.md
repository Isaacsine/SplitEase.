# SplitEase prototype

The app opens with an expense workspace: enter the expense, add people, review the summary, then share invitations or create a shared group. The product no longer exposes a guided scenario, sample-receipt launcher or standalone funding simulator. Local sample-room creation remains an internal browser-test fixture.

## Shared groups

Apply migrations 202610240003_live_group_rooms.sql and 202610240004_room_activity.sql in order. Configure the frontend Supabase public URL and publishable key. Sign in, enter a split, and choose Create group. Share individual participant links or their QR codes. Activity, choices and coverage sync through Supabase, with a five-second refresh fallback. Cash confirmation and group completion require the organiser.

## Receipt workflow

Upload a receipt or paste its text. Review item descriptions and amounts, assign every item and verify the total before applying the shares. Recognition runs in the browser and downloads its language files on first use. No sample receipt is loaded by the product.

## Payment boundary

Payments, cash confirmations and instalments remain simulated and are labelled in the app. No real money moves and no credit is issued. Individual invitation previews do not sync choices to the organiser; shared groups provide that collaboration.

## Cross-device verification

Use a signed-in laptop and an anonymous phone. Open a participant link on the phone; change its choice and declare cash. Check both histories and the pending coverage. Confirm cash only on the laptop. Disconnect the phone, make a change on the laptop, reconnect and verify automatic recovery. Reload both and verify persistence, with no duplicate joined event. These physical-device checks remain manual; automated browser checks cover separate tabs and responsive layouts.
