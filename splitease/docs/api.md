# Prototype integrations

Supabase is used directly from the frontend for optional account registration/sign-in and tracked invitations. Owner-only request policies and the limited token-based read function remain in the first migration.

Payment gateways and payment API calls are removed. PaymentCheckout implements local preview state only. No payment backend or VITE_API_URL is required. backend/src/app.ts is an optional health-only scaffold; payment paths return 404. The Render configuration deploys only the Static Site.

The previous sandbox migration is retained as database history. Existing database data/tables were not changed or removed.
