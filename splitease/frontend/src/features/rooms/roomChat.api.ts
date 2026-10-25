import { supabase } from "../../lib/supabase";
import { readRoom } from "./rooms.api";
import type { RoomRef } from "./rooms";

export type RoomMessage = { id: string; senderName: string; body: string; createdAt: string };
const storageKey = "splitease-room-chat-v1";
function readLocal(): Record<string, RoomMessage[]> { try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; } }
function saveLocal(messages: Record<string, RoomMessage[]>) { localStorage.setItem(storageKey, JSON.stringify(messages)); }

export async function listRoomMessages(ref: RoomRef): Promise<RoomMessage[]> {
  if (ref.mode === "demo") return readLocal()[ref.key] || [];
  if (!supabase) throw Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("read_group_room_messages", { p_room_token: ref.key, p_member_token: ref.seat || null });
  if (error) throw Error("Could not load group chat. Apply the chat migration first.");
  return (data || []) as RoomMessage[];
}

export async function sendRoomMessage(ref: RoomRef, body: string): Promise<RoomMessage[]> {
  const text = body.trim();
  if (!text || text.length > 1000) throw Error("Message must be between 1 and 1000 characters.");
  const room = await readRoom(ref);
  if (ref.mode === "demo") {
    const messages = readLocal();
    const current = messages[ref.key] || [];
    current.push({ id: crypto.randomUUID(), senderName: room.members.find((member) => member.isMe)?.name || "Organiser", body: text, createdAt: new Date().toISOString() });
    messages[ref.key] = current.slice(-100);
    saveLocal(messages);
    return messages[ref.key];
  }
  if (!supabase) throw Error("Supabase is not configured.");
  const { error } = await supabase.rpc("add_group_room_message", { p_room_token: ref.key, p_member_token: ref.seat || null, p_body: text });
  if (error) throw Error(error.message || "Could not send this message.");
  return listRoomMessages(ref);
}
