import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { listRoomMessages, sendRoomMessage, type RoomMessage } from "./roomChat.api";
import type { RoomRef } from "./rooms";

function messageTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function RoomChat({ ref }: { ref: RoomRef }) {
  const [messages, setMessages] = useState<RoomMessage[]>([]), [body, setBody] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const refresh = () => void listRoomMessages(ref).then(setMessages).catch((e) => setError(e instanceof Error ? e.message : "Could not load chat."));
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 5000); return () => window.clearInterval(timer); }, [ref.key, ref.mode, ref.seat]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!body.trim()) return; setBusy(true); setError(""); try { setMessages(await sendRoomMessage(ref, body)); setBody(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not send this message."); } finally { setBusy(false); } };
  return <section className="room-chat" aria-label="Group chat"><div className="rowtitle"><div><h3>Group chat</h3><p className="muted">Talk to everyone in this group.</p></div><span className="pill">{messages.length} message{messages.length === 1 ? "" : "s"}</span></div><div className="chat-messages" aria-live="polite">{messages.length ? messages.map((message) => <article className="chat-message" key={message.id}><div className="rowtitle"><strong>{message.senderName}</strong><time className="muted" dateTime={message.createdAt}>{messageTime(message.createdAt)}</time></div><p>{message.body}</p></article>) : <p className="muted">No messages yet. Start the conversation.</p>}</div><form className="chat-form" onSubmit={submit}><label className="sr-only" htmlFor="room-chat-message">Message</label><textarea id="room-chat-message" value={body} maxLength={1000} placeholder="Write a message to the group..." onChange={(event) => setBody(event.target.value)} disabled={busy} /><Button disabled={busy || !body.trim()}>{busy ? "Sending..." : "Send message"}</Button></form>{error && <p className="error" role="alert">{error}</p>}</section>;
}
