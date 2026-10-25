import { supabase } from "../../lib/supabase";
export type WalletMode = "local" | "cloud";
export type WalletKind = "add" | "move" | "use";
export interface WalletEntry {
  id: string;
  kind: WalletKind;
  cents: number;
  label: string;
  createdAt: string;
  request?: string;
  target?: string;
}
export interface Wallet {
  balance: number;
  entries: WalletEntry[];
}
const storage = "splitease-wallet-v1";
export async function readWallet(mode: WalletMode): Promise<Wallet> {
  if (mode === "local")
    return (
      JSON.parse(localStorage.getItem(storage) || "null") || {
        balance: 0,
        entries: [],
      }
    );
  if (!supabase) throw Error("Sign in once account wallets are connected.");
  const { data, error } = await supabase.rpc("wallet_read");
  if (error)
    throw Error(
      "Your account wallet is unavailable. Sign in and check that wallets are enabled.",
    );
  return data;
}
export async function walletAction(
  mode: WalletMode,
  kind: WalletKind,
  cents: number,
  label: string,
  request: string,
): Promise<Wallet> {
  if (
    !["add", "move", "use"].includes(kind) ||
    !Number.isSafeInteger(cents) ||
    cents < 1 ||
    cents > 100000000 ||
    label.length > 80 ||
    !/^[0-9a-f-]{36}$/i.test(request)
  )
    throw Error("Enter a valid amount.");
  if (mode === "cloud") {
    if (!supabase) throw Error("Account wallets are not connected.");
    const { data, error } = await supabase.rpc("wallet_action", {
      p_kind: kind,
      p_cents: cents,
      p_label: label,
      p_request: request,
    });
    if (error) throw Error(error.message);
    return data;
  }
  const perform = async () => {
    const wallet = await readWallet("local"),
      existing = wallet.entries.find((e) => e.request === request);
    if (existing) {
      if (
        existing.cents !== cents ||
        existing.kind !== kind ||
        existing.label !== label
      )
        throw Error("This request was already used.");
      return wallet;
    }
    if (kind !== "add" && cents > wallet.balance)
      throw Error("Not enough available balance.");
    if (kind === "add" && cents + wallet.balance > 100000000)
      throw Error("Prototype wallet limit is R1,000,000.");
    const next = {
      balance: wallet.balance + (kind === "add" ? cents : -cents),
      entries: [
        {
          id: crypto.randomUUID(),
          request,
          kind,
          cents,
          label,
          createdAt: new Date().toISOString(),
        },
        ...wallet.entries,
      ],
    };
    localStorage.setItem(storage, JSON.stringify(next));
    return next;
  };
  return navigator.locks
    ? navigator.locks.request(storage, perform)
    : perform();
}
