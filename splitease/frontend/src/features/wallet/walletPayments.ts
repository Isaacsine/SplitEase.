import { supabase } from "../../lib/supabase";
import { readWallet, type WalletMode, type Wallet } from "./wallet.api";
import type { PlanRef } from "../plans/plans";
import type { RoomRef } from "../rooms/rooms";
export type WalletTarget =
  | { kind: "plan"; ref: PlanRef; item: string }
  | { kind: "room"; ref: RoomRef; item: string }
  | { kind: "payment"; item: string };
export async function paymentMode(target: WalletTarget): Promise<WalletMode> {
  if (target.kind === "plan")
    return target.ref.mode === "cloud" ? "cloud" : "local";
  if (target.kind === "room")
    return target.ref.mode === "cloud" ? "cloud" : "local";
  const chosen = localStorage.getItem("splitease-wallet-choice");
  if (chosen === "local") return "local";
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return "cloud";
  }
  return "local";
}
export async function paymentReference(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  const s = Array.from(new Uint8Array(bytes))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return (
    s.slice(0, 8) +
    "-" +
    s.slice(8, 12) +
    "-" +
    s.slice(12, 16) +
    "-" +
    s.slice(16, 20) +
    "-" +
    s.slice(20)
  );
}
export async function payFromWallet(
  target: WalletTarget,
  mode: WalletMode,
  cents: number,
  request: string,
): Promise<Wallet> {
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000)
    throw Error("Invalid contribution amount.");
  if (
    target.kind !== "payment" &&
    mode !== (target.ref.mode === "cloud" ? "cloud" : "local")
  )
    throw Error("Use the wallet that matches this contribution.");
  if (mode === "cloud") {
    if (!supabase) throw Error("Sign in to use your account wallet.");
    const { data, error } = await supabase.rpc("wallet_pay", {
      p_target: target.kind,
      p_token: target.kind === "payment" ? null : target.ref.key,
      p_seat: target.kind === "payment" ? null : target.ref.seat || null,
      p_item: target.item,
      p_cents: cents,
      p_request: request,
    });
    if (error) throw Error(error.message);
    return data;
  }
  const perform = async () => {
    const storage = "splitease-wallet-v1",
      wallet = await readWallet("local"),
      key =
        target.kind +
        ":" +
        (target.kind === "payment" ? "" : target.ref.key + ":") +
        target.item,
      existing = wallet.entries.find((e) => e.request === request);
    if (existing) {
      if (existing.cents !== cents || existing.target !== key)
        throw Error("This request was already used.");
      return wallet;
    }
    if (wallet.entries.some((e) => e.target === key))
      throw Error("This contribution has already been paid from a wallet.");
    if (wallet.balance < cents)
      throw Error(
        "Not enough wallet balance. Choose direct bank payment instead.",
      );
    let targetStorage: string | null = null,
      db: any = null,
      label = "Bill payment",
      notify = "";
    if (target.kind === "plan") {
      targetStorage = "splitease-monthly-plans";
      db = JSON.parse(localStorage.getItem(targetStorage) || "{}");
      const p = db[target.ref.key];
      if (!p?.active) throw Error("This plan is not active.");
      const m = target.ref.seat
          ? p.members.find((m: any) => m.token === target.ref.seat)
          : p.members[0],
        period = p.periods.find((p: any) => p.id === target.item);
      if (!m || period?.memberId !== m.id)
        throw Error("You can only fund your own contribution.");
      if (period.status !== "due" || period.cents !== cents)
        throw Error("This contribution changed or is already recorded.");
      period.status = "confirmed";
      label = (p.title + " - " + period.month).slice(0, 80);
      notify = "splitease-plans";
    } else if (target.kind === "room") {
      targetStorage = "splitease-demo-rooms-v1";
      db = JSON.parse(localStorage.getItem(targetStorage) || "{}");
      const r = db[target.ref.key],
        m = target.ref.seat
          ? r?.members.find((m: any) => m.seatToken === target.ref.seat)
          : r?.members[0];
      if (!m || m.id !== target.item)
        throw Error("Open your own participant link.");
      if (
        r.completed ||
        m.choice !== "now" ||
        ["covered", "credit_funded"].includes(m.state) ||
        m.shareCents !== cents
      )
        throw Error("This share changed or is already covered.");
      m.state = "covered";
      r.events = [
        {
          id: crypto.randomUUID(),
          actor: m.name,
          action: "pay",
          memberId: m.id,
          choice: "now",
          createdAt: new Date().toISOString(),
        },
        ...(r.events || []),
      ].slice(0, 100);
      label = r.title.slice(0, 80);
      notify = "splitease-local-rooms";
    }
    const next: Wallet = {
        balance: wallet.balance - cents,
        entries: [
          {
            id: crypto.randomUUID(),
            kind: "use",
            cents,
            label,
            createdAt: new Date().toISOString(),
            request,
            target: key,
          },
          ...wallet.entries,
        ],
      },
      oldWallet = localStorage.getItem(storage),
      oldTarget = targetStorage ? localStorage.getItem(targetStorage) : null;
    try {
      if (targetStorage)
        localStorage.setItem(targetStorage, JSON.stringify(db));
      localStorage.setItem(storage, JSON.stringify(next));
    } catch (e) {
      if (targetStorage && oldTarget !== null)
        localStorage.setItem(targetStorage, oldTarget);
      if (oldWallet !== null) localStorage.setItem(storage, oldWallet);
      else localStorage.removeItem(storage);
      throw e;
    }
    if (notify) {
      const c = new BroadcastChannel(notify);
      c.postMessage(
        target.kind === "plan"
          ? target.ref.key
          : { key: target.kind === "room" ? target.ref.key : "" },
      );
      c.close();
    }
    return next;
  };
  return navigator.locks
    ? navigator.locks.request("splitease-wallet-v1", perform)
    : perform();
}
