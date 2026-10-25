# Render prototype deployment

Create a Static Site, not a gateway Web Service. Root directory: splitease (blank if this is already the Git repository root). Build command: npm ci && npm run build. Publish directory: frontend/dist.

For Supabase accounts, add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Render's Environment settings. Use the project base URL, not /rest/v1. VITE_API_URL, Peach credentials and a backend deployment are not needed. Frontend variable changes require a rebuild.

Keep localhost credentials in frontend/.env.local. Render does not load .env.example templates automatically. The previous Render backend, if deployed, is no longer used; source configuration changes do not remove an existing hosted service.
