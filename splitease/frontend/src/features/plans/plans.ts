import { todayInSouthAfrica } from "../payments/paymentPlans";
export interface PlanRef {
  key: string;
  mode: "local" | "cloud";
  seat?: string;
}
export interface Proposal {
  revision: number;
  cents: number;
  effective: string;
  accepted: boolean;
}
export interface PlanMember {
  id: string;
  name: string;
  isMe: boolean;
  token?: string;
  proposal: Proposal;
  method?: "manual" | "debit_preview";
  reminders?: boolean;
  days?: number;
  orderAccepted?: boolean;
}
export interface Period {
  id: string;
  memberId: string;
  month: string;
  due: string;
  cents: number;
  status: "due" | "declared" | "confirmed";
}
export interface Plan {
  key: string;
  title: string;
  kind: "expense" | "savings" | "stokvel";
  target: number;
  day: number;
  start: string;
  active: boolean;
  owner: boolean;
  mode: "local" | "cloud";
  members: PlanMember[];
  periods: Period[];
  rotation?: {
    revision: number;
    order: string[];
    payouts: {
      month: string;
      recipient: string;
      cents: number;
      received: boolean;
    }[];
  };
}
export interface PlanDraft {
  title: string;
  kind: Plan["kind"];
  target: number;
  day: number;
  start: string;
  members: { name: string; cents: number }[];
}
export type PlanAction =
  | "accept"
  | "start"
  | "propose"
  | "preferences"
  | "declare"
  | "confirm"
  | "order"
  | "receive";
export const thisMonth = () => todayInSouthAfrica().slice(0, 7);
export function addMonth(month: string, n = 1) {
  const d = new Date(month + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
export function dueDate(month: string, day: number) {
  const last = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  return month + "-" + String(Math.min(last, day)).padStart(2, "0");
}
export function moneyCents(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw Error("Use a positive amount with up to two decimal places.");
  const n = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000000)
    throw Error("Amounts must be between R0.01 and R1,000,000.");
  return n;
}
export function validateDraft(d: PlanDraft) {
  if (!d.title.trim() || d.title.length > 100)
    throw Error("Give the plan a name of up to 100 characters.");
  if (!["expense", "savings", "stokvel"].includes(d.kind))
    throw Error("Choose a plan type.");
  if (
    d.members.length < 2 ||
    d.members.length > 20 ||
    d.members.some(
      (m) =>
        !m.name.trim() ||
        m.name.length > 60 ||
        !Number.isInteger(m.cents) ||
        m.cents < 1 ||
        m.cents > 100000000,
    )
  )
    throw Error("Add 2 to 20 people with a name and a positive contribution.");
  if (
    d.kind === "stokvel" &&
    d.members.some((m) => m.cents !== d.members[0].cents)
  )
    throw Error("Stokvel members contribute the same amount each month.");
  if (!Number.isInteger(d.day) || d.day < 1 || d.day > 31)
    throw Error("Choose a due day from 1 to 31.");
  if (
    !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(d.start) ||
    d.start < thisMonth() ||
    d.start > addMonth(thisMonth(), 12)
  )
    throw Error("Start this month or within the next 12 months.");
  if (
    d.kind === "savings" &&
    (!Number.isInteger(d.target) || d.target < 1 || d.target > 100000000)
  )
    throw Error("Enter a positive savings target, up to R1,000,000.");
}
export function monthEnd(month: string) {
  return dueDate(month, 31);
}
export function rotationMonths(p: Plan) {
  return (p.rotation?.order || []).map((recipient, i) => ({
    recipient,
    month: addMonth(p.start, i),
  }));
}
export function planLink(r: PlanRef) {
  return (
    location.origin +
    location.pathname +
    "#plan=" +
    r.key +
    "&mode=" +
    r.mode +
    (r.seat ? "&seat=" + r.seat : "")
  );
}
export function parsePlan(hash: string): PlanRef | null {
  const p = new URLSearchParams(hash.slice(1)),
    key = p.get("plan"),
    seat = p.get("seat") || undefined;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!key || !uuid.test(key) || (seat && !uuid.test(seat))) return null;
  return { key, seat, mode: p.get("mode") === "local" ? "local" : "cloud" };
}
export function rememberPlan(r: PlanRef) {
  try {
    const refs = planRefs().filter((x) => x.key !== r.key);
    sessionStorage.setItem(
      "splitease-plan-refs",
      JSON.stringify([r, ...refs].slice(0, 50)),
    );
  } catch {}
}
export function planRefs(): PlanRef[] {
  try {
    return JSON.parse(sessionStorage.getItem("splitease-plan-refs") || "[]");
  } catch {
    return [];
  }
}
export function remindersFor(p: Plan) {
  const me = p.members.find((m) => m.isMe);
  if (!me?.reminders) return [];
  const today = todayInSouthAfrica();
  return p.periods
    .filter((x) => x.memberId === me.id && x.status === "due")
    .filter((x) => {
      const d = new Date(x.due + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - (me.days || 0));
      return today >= d.toISOString().slice(0, 10);
    });
}
export function calendar(p: Plan) {
  const me = p.members.find((m) => m.isMe);
  if (!me) throw Error("Open your own participant link first.");
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SplitEase//Monthly Plans//EN",
    "CALSCALE:GREGORIAN",
  ];
  const currentStart =
    dueDate(thisMonth(), p.day) < todayInSouthAfrica()
      ? addMonth(thisMonth())
      : thisMonth();
  const start = p.start > currentStart ? p.start : currentStart;
  for (let i = 0; i < 12; i++) {
    const date = dueDate(addMonth(start, i), p.day).replaceAll("-", "");
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + p.key + "-" + me.id + "-" + date + "@splitease",
      "DTSTAMP:" + stamp,
      "DTSTART:" + date + "T070000Z",
      "DTEND:" + date + "T071500Z",
      "SUMMARY:" + escape(p.title + " contribution"),
      "DESCRIPTION:Contribution reminder only. No automatic debit or payment is authorised.",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Monthly contribution due",
      "TRIGGER:-P" + (me.days || 0) + "D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  const folded = lines.flatMap((line) => {
    const parts: string[] = [];
    let current = "",
      bytes = 0;
    for (const ch of line) {
      const size = new TextEncoder().encode(ch).length;
      if (bytes + size > 75) {
        parts.push(current);
        current = " ";
        bytes = 1;
      }
      current += ch;
      bytes += size;
    }
    parts.push(current);
    return parts;
  });
  return folded.join("\r\n") + "\r\n";
}
