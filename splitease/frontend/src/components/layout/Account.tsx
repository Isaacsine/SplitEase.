import { supportsPhonePasskeys, phoneAuthError } from "../../lib/phoneAuth";
import { keepsSignedIn, setKeepSignedIn } from "../../lib/authStorage";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

type AccountSettings = {
  displayName: string;
  notifications: boolean;
  currency: "ZAR";
  privateProfile: boolean;
};
const settingsKey = "splitease-account-settings";
function loadSettings(): AccountSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || "null");
    return {
      displayName: typeof saved?.displayName === "string" ? saved.displayName : "",
      notifications: saved?.notifications !== false,
      currency: "ZAR",
      privateProfile: saved?.privateProfile !== false,
    };
  } catch {
    return { displayName: "", notifications: true, currency: "ZAR", privateProfile: true };
  }
}

export function Account({ page = false }: { page?: boolean }) {
  const [open, setOpen] = useState(false), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [user, setUser] = useState(""), [signup, setSignup] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [remember, setRemember] = useState(keepsSignedIn), [settings, setSettings] = useState<AccountSettings>(loadSettings);
  const [phonePasskeys, setPhonePasskeys] = useState(false);
  useEffect(() => {
    let active = true;
    void supportsPhonePasskeys().then((supported) => { if (active) setPhonePasskeys(supported); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user.email || ""));
    const { data } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user.email || ""));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!page || !user) return;
    const returnHash = sessionStorage.getItem("splitease-invite-return");
    if (returnHash) {
      sessionStorage.removeItem("splitease-invite-return");
      location.hash = returnHash;
    }
  }, [page, user]);
  useEffect(() => {
    if (!user) return;
    const returnHash = sessionStorage.getItem("splitease-oauth-return");
    if (returnHash) {
      sessionStorage.removeItem("splitease-oauth-return");
      if (/^#(?:pay|account|activity|scan|balances|receipt|plans|wallet|join=|invite=|room=|plan=)/.test(returnHash)) location.hash = returnHash;
    }
  }, [user]);
  async function googleSignIn() {
    if (!supabase || busy) return;
    setBusy(true); setMessage("");
    try {
      setKeepSignedIn(remember);
      sessionStorage.setItem("splitease-oauth-return", location.hash || "#pay");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + location.pathname + "#account" },
      });
      if (error) throw error;
    } catch (e) {
      sessionStorage.removeItem("splitease-oauth-return");
      setMessage(e instanceof Error ? e.message : "Could not sign in with Google.");
    } finally { setBusy(false); }
  }
  async function phoneSignIn(register = false) {
    if (!supabase || busy) return;
    setBusy(true); setMessage("");
    try {
      if (!await supportsPhonePasskeys()) throw new Error("Phone sign-in is available only on a supported phone with a screen lock.");
      if (!register) setKeepSignedIn(remember);
      const { error } = register ? await supabase.auth.registerPasskey() : await supabase.auth.signInWithPasskey();
      if (error) throw error;
      setPassword("");
      setMessage(register ? "Phone sign-in is ready. Next time, use your phone passkey to sign in." : "Signed in with your phone.");
    } catch (e) { setMessage(phoneAuthError(e)); } finally { setBusy(false); }
  }
  async function submit() {
    if (!supabase) return;
    setBusy(true); setMessage("");
    try {
      setKeepSignedIn(remember);
      const { data, error } = signup ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin + location.pathname } }) : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword(""); setMessage(signup ? data.session ? "Account created. You are signed in." : "Check your email to confirm your account." : "Signed in. Your account is ready.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not sign in."); } finally { setBusy(false); }
  }
  function updateSettings(next: Partial<AccountSettings>) {
    setSettings((current) => {
      const updated = { ...current, ...next };
      localStorage.setItem(settingsKey, JSON.stringify(updated));
      return updated;
    });
  }
  const content = !supabase ? <div className="notice">Account registration needs a Supabase connection. Add the project URL and public key to enable sign-in and tracked invitations.</div> : user ? <>
    <p className="muted">{user}</p>
    {phonePasskeys && <div className="notice phone-sign-in">
      <strong>Phone sign-in</strong>
      <p>Save a passkey to sign in with your fingerprint, Face ID or phone screen lock.</p>
      <Button variant="secondary" disabled={busy} onClick={() => void phoneSignIn(true)}>Enable phone sign-in</Button>
    </div>}
    <fieldset className="account-settings">
      <legend>Account settings</legend>
      <Input label="Display name" value={settings.displayName} placeholder="How should we call you?" maxLength={60} onChange={(e) => updateSettings({ displayName: e.target.value })} />
      <label className="assignment-choice"><input type="checkbox" checked={settings.notifications} onChange={(e) => updateSettings({ notifications: e.target.checked })} />Email and activity notifications</label>
      <label className="assignment-choice"><input type="checkbox" checked={settings.privateProfile} onChange={(e) => updateSettings({ privateProfile: e.target.checked })} />Keep my profile details private</label>
      <label className="field">Currency<select value={settings.currency} onChange={() => updateSettings({ currency: "ZAR" })}><option value="ZAR">South African rand (R)</option></select></label>
      <p className="muted small">These preferences are saved on this browser. Payment previews do not use real bank details.</p>
    </fieldset>
    <label className="assignment-choice"><input type="checkbox" checked={remember} disabled={busy} onChange={(e) => { try { setKeepSignedIn(e.target.checked); setRemember(e.target.checked); setMessage(e.target.checked ? "You will stay signed in on this browser." : "You will stay signed in only for this browser session."); } catch { setMessage("Could not update browser storage. Check your browser settings."); } }} />Keep me signed in</label>
    <p className="muted small">Uncheck this on shared devices. Signing out always ends your saved session.</p>
    <Button variant="secondary" disabled={busy} onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setMessage(error.message); else { setMessage(""); if (!page) setOpen(false); location.hash = "#pay"; } }}>Sign out</Button>
  </> : <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
    <div className="auth-methods">
      <Button variant="secondary" type="button" disabled={busy} onClick={() => void googleSignIn()}>Continue with Google</Button>
      {phonePasskeys && <>
        <Button variant="secondary" type="button" disabled={busy} onClick={() => void phoneSignIn()}>Sign in with phone passkey</Button>
        <p className="muted small">Use your fingerprint, Face ID or screen lock. First sign in with Google or email and enable phone sign-in in your account.</p>
      </>}
    </div>
    <p className="muted small">Or use your email and password</p>
    <Input label="Email" type="email" autoComplete="email" value={email} required onChange={(e) => setEmail(e.target.value)} />
    <Input label="Password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} />
    <label className="assignment-choice"><input type="checkbox" checked={remember} disabled={busy} onChange={(e) => setRemember(e.target.checked)} />Keep me signed in</label>
    <p className="muted small">Uncheck this on shared devices to sign in only for this browser session.</p>
    <Button type="submit" disabled={busy}>{busy ? "Please wait..." : signup ? "Create account" : "Sign in"}</Button>
    <Button variant="ghost" type="button" disabled={busy} onClick={() => { setSignup(!signup); setMessage(""); }}>{signup ? "Already have an account? Sign in" : "New here? Create an account"}</Button>
  </form>;
  if (page) return <section className="account-page"><h1>Your account</h1>{content}{message && <p className="notice" role="status">{message}</p>}</section>;
  return <><button className="accountbutton" aria-label={user ? "Account" : "Sign in"} onClick={() => { if (user) { location.hash = "#account"; setOpen(true); } else setOpen(true); }}>{user ? <span className="account-avatar" aria-hidden="true">{user.slice(0, 1).toUpperCase()}</span> : "Sign in"}</button><Modal open={open} onClose={() => setOpen(false)} title={user ? "Your account" : signup ? "Create your account" : "Sign in"}>{content}{message && <p className="notice" role="status">{message}</p>}</Modal></>;
}
