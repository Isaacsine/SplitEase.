import { privateRpc } from "../../lib/privateCloud";
import { privateLocal } from "../../lib/privateStorage";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { readPlan } from "./plans.api";
import type { PlanRef } from "./plans";

type PlanMessage = { id: string; senderName: string; body: string; createdAt: string };
const storageKey = "splitease-plan-chat-v1";
function localRead(): Record<string, PlanMessage[]> { try { return JSON.parse(privateLocal.getItem(storageKey) || "{}"); } catch { return {}; } }
function localWrite(value: Record<string, PlanMessage[]>) { privateLocal.setItem(storageKey, JSON.stringify(value)); }
async function list(ref: PlanRef): Promise<PlanMessage[]> {
  if (ref.mode === "local") return localRead()[ref.key] || [];
  if (!supabase) throw Error("Supabase is not configured.");
  const { data, error } = await privateRpc("read_plan_messages", { p_plan_token: ref.key, p_seat: ref.seat || null });
  if (error) throw Error("Could not load plan chat. Apply the plan-chat migration first.");
  return (data || []) as PlanMessage[];
}
async function send(ref: PlanRef, body: string) {
  const plan = await readPlan(ref), text = body.trim();
  if (!text || text.length > 1000) throw Error("Message must be between 1 and 1000 characters.");
  if (ref.mode === "local") { const db = localRead(), messages = db[ref.key] || []; messages.push({ id: crypto.randomUUID(), senderName: plan.members.find((member) => member.isMe)?.name || "Organiser", body: text, createdAt: new Date().toISOString() }); db[ref.key] = messages.slice(-100); localWrite(db); return db[ref.key]; }
  if (!supabase) throw Error("Supabase is not configured.");
  const { error } = await privateRpc("add_plan_message", { p_plan_token: ref.key, p_seat: ref.seat || null, p_body: text });
  if (error) throw Error(error.message || "Could not send this message.");
  return list(ref);
}
function messageTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function PlanChat({ ref, kind }: { ref: PlanRef; kind: "expense" | "savings" | "stokvel" }) {
  const title = kind === "stokvel" ? "Stokvel circle chat" : kind === "savings" ? "Savings plan chat" : "Monthly plan chat";
  const [messages, setMessages] = useState<PlanMessage[]>([]), [body, setBody] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const refresh = () => void list(ref).then(setMessages).catch((e) => setError(e instanceof Error ? e.message : "Could not load chat."));
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 5000); return () => window.clearInterval(timer); }, [ref.key, ref.mode, ref.seat]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!body.trim()) return; setBusy(true); setError(""); try { setMessages(await send(ref, body)); setBody(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not send this message."); } finally { setBusy(false); } };
  return <section className="room-chat plan-chat" aria-label={title}><div className="rowtitle"><div><h2>{title}</h2><p className="muted">Keep decisions, reminders and updates in one place.</p></div><span className="pill">{messages.length} message{messages.length === 1 ? "" : "s"}</span></div><div className="chat-messages" aria-live="polite">{messages.length ? messages.map((message) => <article className="chat-message" key={message.id}><div className="rowtitle"><strong>{message.senderName}</strong><time className="muted" dateTime={message.createdAt}>{messageTime(message.createdAt)}</time></div><p>{message.body}</p></article>) : <p className="muted">No messages yet. Start the conversation.</p>}</div><form className="chat-form" onSubmit={submit}><label className="sr-only" htmlFor="plan-chat-message">Message</label><textarea id="plan-chat-message" value={body} maxLength={1000} placeholder="Write an update to the group..." onChange={(event) => setBody(event.target.value)} disabled={busy} /><Button disabled={busy || !body.trim()}>{busy ? "Sending..." : "Send message"}</Button></form>{error && <p className="error" role="alert">{error}</p>}</section>;
}
