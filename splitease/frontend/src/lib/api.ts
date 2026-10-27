import { assertPrivateScope, privateScope } from "./privateStorage";
import { supabase } from "./supabase";
const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const scope = privateScope();
  const headers = new Headers(options.headers);
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  assertPrivateScope(scope);
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  assertPrivateScope(scope);
  if (!response.ok)
    throw Error(body.error || `Backend request failed (${response.status}).`);
  return body;
}
