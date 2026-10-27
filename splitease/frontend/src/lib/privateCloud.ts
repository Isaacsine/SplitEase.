import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { assertPrivateScope, privateScope } from "./privateStorage";
let schemaReady = false;
// Pin each operation to the account which started it, even if sign-out happens mid-request.
export async function privateClient() {
  if (!supabase) throw new Error("Shared accounts are unavailable.");
  const scope = privateScope();
  const session = (await supabase.auth.getSession()).data.session;
  assertPrivateScope(scope);
  if (!session) throw new Error("Sign in to open shared content.");
  const client = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { accessToken: async () => session.access_token },
  );
  return { client, scope };
}
export async function privateRpc(
  name: string,
  args: Record<string, unknown> = {},
) {
  const { client, scope } = await privateClient();
  if (!schemaReady) {
    const version = await client.rpc("private_schema_version");
    assertPrivateScope(scope);
    if (version.error || version.data !== 1)
      throw new Error(
        "Private sharing is being updated. Please try again later.",
      );
    schemaReady = true;
  }
  assertPrivateScope(scope);
  const response = await client.rpc(name, args);
  assertPrivateScope(scope);
  return response;
}
