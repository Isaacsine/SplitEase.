export type AppEnv = { port: number; corsOrigin: string; paymentMode: "mock"; webhookSecret?: string; supabaseUrl?: string; supabaseServiceRoleKey?: string; persistence: "supabase" | "memory" };
export function readEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || undefined;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || undefined;
  if (Boolean(supabaseUrl) !== Boolean(supabaseServiceRoleKey)) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together.");
  return { port, corsOrigin: env.CORS_ORIGIN || "http://localhost:5173", paymentMode: "mock", webhookSecret: env.WEBHOOK_SECRET || undefined, supabaseUrl, supabaseServiceRoleKey, persistence: supabaseUrl && supabaseServiceRoleKey ? "supabase" : "memory" };
}
