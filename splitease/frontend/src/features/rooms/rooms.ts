import { privateSession } from "../../lib/privateStorage";
import type { ShopState } from "../shops/shops.api";
import {
  repaymentPlan,
  type PaymentChoice,
  type InstalmentCount,
} from "../payments/paymentPlans";
export type RoomState =
  "pending" | "cash_declared" | "covered" | "credit_funded" | "declined";
export interface RoomMember {
  id: string;
  name: string;
  shareCents: number;
  choice: PaymentChoice;
  count: InstalmentCount;
  state: RoomState;
  repaid: number;
  isMe: boolean;
  seatToken?: string;
}
export interface RoomEvent {
  id: string;
  memberId?: string;
  actor: string;
  action:
    | "created"
    | "joined"
    | "method"
    | "pay"
    | "cash"
    | "credit"
    | "repay"
    | "decline"
    | "reset"
    | "completed";
  choice?: PaymentChoice;
  createdAt: string;
}
export interface Room {
  events?: RoomEvent[];
  id: string;
  key: string;
  title: string;
  totalCents: number;
  createdAt: string;
  completed: boolean;
  owner: boolean;
  mode: "demo" | "cloud";
  members: RoomMember[];
}
export type RoomAction =
  "method" | "pay" | "cash" | "credit" | "repay" | "decline" | "reset";
export interface RoomRef {
  key: string;
  mode: "demo" | "cloud";
  seat?: string;
}
export function roomCoverage(room: Room) {
  const covered = room.members
    .filter((m) => m.state === "covered" || m.state === "credit_funded")
    .reduce((s, m) => s + m.shareCents, 0);
  return {
    covered,
    pending: Math.max(0, room.totalCents - covered),
    percent: room.totalCents
      ? Math.min(100, Math.round((covered * 100) / room.totalCents))
      : 0,
  };
}
export function memberBalance(m: RoomMember, date?: string) {
  const plan = repaymentPlan(m.shareCents / 100, m.count, date);
  const paid =
    m.state === "credit_funded"
      ? plan
          .slice(0, m.repaid)
          .reduce((s, p) => s + Math.round(p.amount * 100), 0)
      : 0;
  return {
    plan,
    paid,
    remaining: m.state === "credit_funded" ? m.shareCents - paid : 0,
  };
}
export function roomMembers(shop: ShopState) {
  return shop.participants.map((p) => ({
    id: p.id,
    name: p.name,
    shareCents: Math.round(p.share * 100),
    choice: p.paymentChoice || "now",
    count: p.instalmentCount || 3,
    state: "pending" as RoomState,
    repaid: 0,
    isMe: !!p.isOrganizer,
    seatToken: crypto.randomUUID(),
  }));
}
export const roomLink = (ref: RoomRef) =>
  location.origin +
  location.pathname +
  "#room=" +
  ref.key +
  "&mode=" +
  ref.mode +
  (ref.seat ? "&seat=" + ref.seat : "");
export function parseRoom(hash: string): RoomRef | null {
  const params = new URLSearchParams(hash.slice(1));
  const key = params.get("room"),
    seat = params.get("seat") || undefined;
  if (
    !key ||
    !/^[0-9a-f-]{36}$/i.test(key) ||
    (seat && !/^[0-9a-f-]{36}$/i.test(seat))
  )
    return null;
  return { key, seat, mode: params.get("mode") === "demo" ? "demo" : "cloud" };
}
export function rememberRoom(ref: RoomRef) {
  try {
    const refs = JSON.parse(
      privateSession.getItem("splitease-room-refs") || "[]",
    ) as RoomRef[];
    privateSession.setItem(
      "splitease-room-refs",
      JSON.stringify(
        [ref, ...refs.filter((r) => r.key !== ref.key)].slice(0, 30),
      ),
    );
  } catch {}
}
export function roomRefs(): RoomRef[] {
  try {
    return JSON.parse(privateSession.getItem("splitease-room-refs") || "[]");
  } catch {
    return [];
  }
}
