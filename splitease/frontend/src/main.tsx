import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { supabase } from "./lib/supabase";
import { clearRetiredTestData, setPrivateAccount } from "./lib/privateStorage";
import "./styles/globals.css";
const root = createRoot(document.getElementById("root")!);
root.render(<p className="wrap" role="status">Opening your account...</p>);
clearRetiredTestData();
let ready = false;
supabase?.auth.onAuthStateChange((event, session) => {
  if (ready) {
    if (event === "SIGNED_OUT") { try { sessionStorage.removeItem("splitease-oauth-return"); sessionStorage.removeItem("splitease-invite-return"); } catch { /* No persisted return route. */ } }
    setPrivateAccount(session?.user.id || null, event === "SIGNED_IN");
  }
});
async function start() {
  if (supabase) {
    try { const { data } = await supabase.auth.getSession(); setPrivateAccount(data.session?.user.id || null); }
    catch { setPrivateAccount(null); }
  }
  ready = true;
  root.render(<StrictMode><App /></StrictMode>);
}
void start();
