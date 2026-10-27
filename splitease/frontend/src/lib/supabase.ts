import { authStorage } from "./authStorage";
import { createClient } from "@supabase/supabase-js";
const env = (import.meta as unknown as { env: Record<string, string> }).env;
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          detectSessionInUrl: true,
          experimental: { passkey: true },
          persistSession: true,
          storage: authStorage,
          autoRefreshToken: true,
        },
      })
    : null;
