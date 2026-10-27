# Google and phone sign-in

Email and password sign-in remain available. Google is offered on phones and laptops. Phone passkey registration and sign-in are offered only on iPhone/iPod or Android Mobile browsers with a user-verifying platform authenticator, WebAuthn, and a secure context. A narrow laptop window does not enable the phone option. Device detection controls the UI; it cannot enforce a server-side device policy or distinguish every spoofed browser.

## Supabase setup

1. In Authentication > Sign In / Providers, enable Google and enter your Google OAuth client ID and secret. Configure the Google client with the Supabase callback URL displayed there. Never put the Google client secret in frontend environment variables.
2. In Authentication > URL Configuration, set your Site URL and allow your application callback URL, including `https://your-domain/#account` and your local development URL if needed. Google sign-in returns users to the split or page they were viewing and respects Keep me signed in.
3. In Authentication > Passkeys, enable passkey authentication. Set display name to SplitEase, RP ID to your stable bare domain (for example `splitease.tech`), and origins to your exact HTTPS application origins. Local loopback testing requires separate matching RP configuration. Phone testing over a LAN HTTP address will not work; use HTTPS.
4. The installed Supabase SDK supports passkeys. The client explicitly opts into its experimental passkey API; no custom credential database or service-role key is needed in the frontend.

## Using phone sign-in

Sign in on the phone using Google or email first, then select Enable phone sign-in in Your account. Confirm the phone's native passkey prompt. On subsequent visits select Sign in with phone passkey. The OS may approve with fingerprint, Face ID, or device PIN/screen lock; websites cannot require fingerprint specifically or inspect biometric data. Supabase verifies the signed challenge before issuing a session. Cancelling does not sign the user in.

Passkey support in Supabase is experimental. Test on actual Android and iPhone hardware after enabling the providers. Automated tests use a virtual WebAuthn authenticator and mocked Supabase challenge/verification endpoints; they do not verify your hosted project's provider configuration.

References: https://supabase.com/docs/guides/auth/passkeys and https://supabase.com/docs/guides/auth/social-login/auth-google
