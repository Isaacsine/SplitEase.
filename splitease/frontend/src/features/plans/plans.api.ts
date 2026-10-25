import { todayInSouthAfrica } from "../payments/paymentPlans";
import { supabase } from "../../lib/supabase";
import {
  addMonth,
  dueDate,
  thisMonth,
  validateDraft,
  rememberPlan,
  planRefs,
  type Plan,
  type PlanRef,
  type PlanDraft,
  type PlanAction,
  type Proposal,
  monthEnd,
  rotationMonths,
} from "./plans";
type Stored = Plan & {
  agreements: Record<string, Proposal[]>;
  approvedOrder?: Record<string, number>;
};
const storage = "splitease-monthly-plans";
const all = (): Record<string, Stored> =>
  JSON.parse(localStorage.getItem(storage) || "{}");
function write(p: Stored) {
  const db = all();
  db[p.key] = p;
  localStorage.setItem(storage, JSON.stringify(db));
  const c = new BroadcastChannel("splitease-plans");
  c.postMessage(p.key);
  c.close();
}
function sync(p: Stored) {
  if (!p.active) return;
  for (
    let month = p.start;
    month <= addMonth(thisMonth());
    month = addMonth(month)
  ) {
    if (p.kind === "stokvel" && month >= addMonth(p.start, p.members.length))
      break;
    for (const m of p.members) {
      const a = [...p.agreements[m.id]]
        .reverse()
        .find((a) => a.accepted && a.effective <= month);
      if (!a) continue;
      const existing = p.periods.find(
        (x) => x.memberId === m.id && x.month === month,
      );
      if (existing) {
        if (month > thisMonth() && existing.status === "due")
          existing.cents = a.cents;
        continue;
      }
      p.periods.push({
        id: crypto.randomUUID(),
        memberId: m.id,
        month,
        due: dueDate(month, p.day),
        cents: a.cents,
        status: "due",
      });
    }
  }
}
function payoutSync(p: Stored) {
  if (p.kind !== "stokvel" || !p.active || !p.rotation) return;
  for (const turn of rotationMonths(p)) {
    const rows = p.periods.filter((x) => x.month === turn.month);
    if (
      monthEnd(turn.month) > todayInSouthAfrica() ||
      rows.length !== p.members.length ||
      rows.some((x) => x.status !== "confirmed") ||
      p.rotation.payouts.some((x) => x.month === turn.month)
    )
      continue;
    p.rotation.payouts.push({
      ...turn,
      cents: rows.reduce((s, x) => s + x.cents, 0),
      received: false,
    });
  }
}
function view(p: Stored, r: PlanRef): Plan {
  if (r.seat && !p.members.some((m) => m.token === r.seat))
    throw Error("Invalid participant link.");
  const owner = !r.seat;
  return {
    key: p.key,
    title: p.title,
    kind: p.kind,
    target: p.target,
    day: p.day,
    start: p.start,
    active: p.active,
    owner,
    mode: "local",
    periods: p.periods,
    rotation: p.rotation,
    members: p.members.map((m, i) => {
      const isMe = r.seat ? m.token === r.seat : i === 0;
      return {
        orderAccepted:
          p.kind === "stokvel"
            ? p.approvedOrder?.[m.id] === p.rotation?.revision
            : undefined,
        id: m.id,
        name: m.name,
        isMe,
        token: owner || isMe ? m.token : undefined,
        proposal: p.agreements[m.id].at(-1)!,
        method: isMe ? m.method : undefined,
        reminders: isMe ? m.reminders : undefined,
        days: isMe ? m.days : undefined,
      };
    }),
  };
}
export async function createPlan(
  d: PlanDraft,
  mode: PlanRef["mode"],
): Promise<PlanRef> {
  validateDraft(d);
  let ref: PlanRef;
  if (mode === "local") {
    const key = crypto.randomUUID();
    const members = d.members.map((m) => ({
      id: crypto.randomUUID(),
      name: m.name.trim(),
      isMe: false,
      token: crypto.randomUUID(),
      proposal: {
        revision: 1,
        cents: m.cents,
        effective: d.start,
        accepted: false,
      },
      method: "manual" as const,
      reminders: true,
      days: 3,
    }));
    const p: Stored = {
      key,
      title: d.title.trim(),
      kind: d.kind,
      target: d.target,
      day: d.day,
      start: d.start,
      active: false,
      owner: true,
      mode,
      members,
      periods: [],
      agreements: Object.fromEntries(members.map((m) => [m.id, [m.proposal]])),
    };
    if (d.kind === "stokvel") {
      p.rotation = {
        revision: 1,
        order: members.map((m) => m.id),
        payouts: [],
      };
      p.approvedOrder = {};
    }
    write(p);
    ref = { key, mode };
  } else {
    if (!supabase)
      throw Error(
        "Shared plans are not connected yet. Save on this device or sign in once connected.",
      );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw Error("Sign in to share a plan across devices.");
    const { data, error } = await supabase.rpc("plan_create", { p_draft: d });
    if (error)
      throw Error(
        "Could not create this plan. Check that monthly plans are enabled and try again.",
      );
    ref = { key: data.key, mode };
  }
  rememberPlan(ref);
  return ref;
}
export async function readPlan(r: PlanRef): Promise<Plan> {
  if (r.mode === "local") {
    const p = all()[r.key];
    if (!p)
      throw Error("This plan is saved on the device where it was created.");
    view(p, r);
    const before = JSON.stringify([p.periods, p.rotation]);
    sync(p);
    payoutSync(p);
    if (JSON.stringify([p.periods, p.rotation]) !== before) {
      const db = all();
      db[p.key] = p;
      localStorage.setItem(storage, JSON.stringify(db));
    }
    return view(p, r);
  }
  if (!supabase) throw Error("Shared plans are not connected.");
  const { data, error } = await supabase.rpc("plan_read", {
    p_token: r.key,
    p_seat: r.seat || null,
  });
  if (error || !data)
    throw Error(
      "Could not load this plan. Check your connection and participant link.",
    );
  return data;
}
export async function changePlan(
  r: PlanRef,
  action: PlanAction,
  member?: string,
  period?: string,
  data: Record<string, unknown> = {},
): Promise<Plan> {
  if (r.mode === "cloud") {
    if (!supabase) throw Error("Shared plans are not connected.");
    const { data: next, error } = await supabase.rpc("plan_action", {
      p_token: r.key,
      p_seat: r.seat || null,
      p_action: action,
      p_member: member || null,
      p_period: period || null,
      p_data: data,
    });
    if (error) throw Error(error.message);
    return next;
  }
  const p = all()[r.key];
  if (!p) throw Error("Plan not found.");
  const v = view(p, r),
    me = v.members.find((m) => m.isMe);
  sync(p);
  if (action === "start") {
    if (!v.owner) throw Error("Only the organiser starts the plan.");
    if (
      p.kind === "stokvel" &&
      p.members.some((m) => p.approvedOrder?.[m.id] !== p.rotation?.revision)
    )
      throw Error("Everyone must accept the payout order first.");
    if (
      p.kind === "stokvel" &&
      new Set(p.members.map((m) => p.agreements[m.id].at(-1)!.cents)).size !== 1
    )
      throw Error("Every member must have the same monthly contribution.");
    if (p.members.some((m) => !p.agreements[m.id].at(-1)!.accepted))
      throw Error("Every person must accept their contribution first.");
    if (!p.active) {
      p.active = true;
      p.start = p.start > thisMonth() ? p.start : thisMonth();
    }
  } else if (action === "accept") {
    if (!me || me.id !== member)
      throw Error("You can only accept your own amount.");
    const a = p.agreements[me.id].at(-1)!;
    if (a.revision !== data.revision)
      throw Error("The proposed amount changed. Review it again.");
    if (p.kind === "stokvel") {
      if (data.orderRevision !== p.rotation?.revision)
        throw Error("The payout order changed. Review it again.");
      p.approvedOrder ||= {};
      p.approvedOrder[me.id] = p.rotation!.revision;
    }
    a.accepted = true;
  } else if (action === "order") {
    if (p.kind !== "stokvel" || !me || p.active)
      throw Error("The order can only change before the round starts.");
    const order = data.order as string[];
    if (
      data.revision !== p.rotation?.revision ||
      !Array.isArray(order) ||
      order.length !== p.members.length ||
      new Set(order).size !== order.length ||
      order.some((id) => !p.members.some((m) => m.id === id))
    )
      throw Error(
        "Choose every person exactly once and review the latest order.",
      );
    p.rotation!.order = order;
    p.rotation!.revision++;
    p.approvedOrder = {};
  } else if (action === "receive") {
    payoutSync(p);
    const payout = p.rotation?.payouts.find((x) => x.month === data.month);
    if (!me || payout?.recipient !== me.id)
      throw Error(
        "Only this month's recipient can acknowledge the simulated payout.",
      );
    payout.received = true;
  } else if (action === "propose") {
    if (p.kind === "stokvel" && p.active)
      throw Error("Stokvel contributions are fixed for this round.");
    if (!v.owner) throw Error("Only the organiser proposes changes.");
    const a = p.agreements[member || ""]?.at(-1);
    if (!a) throw Error("Participant not found.");
    if (a.revision !== data.revision)
      throw Error("The amount changed. Refresh the plan.");
    const cents = Number(data.cents);
    if (
      !Number.isSafeInteger(cents) ||
      cents < 1 ||
      cents > 100000000 ||
      cents === a.cents
    )
      throw Error("Enter a different positive amount, up to R1,000,000.");
    const effective = p.active
      ? [p.start, addMonth(thisMonth())].sort().at(-1)!
      : [p.start, thisMonth()].sort().at(-1)!;
    p.agreements[member!].push({
      revision: a.revision + 1,
      cents,
      effective,
      accepted: false,
    });
  } else if (action === "preferences") {
    if (!me || me.id !== member)
      throw Error("Payment preferences are private.");
    if (
      !["manual", "debit_preview"].includes(String(data.method)) ||
      ![0, 1, 3, 7].includes(Number(data.days)) ||
      typeof data.reminders !== "boolean"
    )
      throw Error("Invalid preferences.");
    Object.assign(
      p.members.find((m) => m.id === me.id)!,
      { method: data.method, reminders: data.reminders, days: data.days },
    );
  } else {
    if (!["declare", "confirm"].includes(action))
      throw Error("Unknown plan action.");
    if (!p.active) throw Error("Start the plan first.");
    const x = p.periods.find((x) => x.id === period);
    if (!x) throw Error("Contribution not found.");
    if (action === "confirm" && !v.owner)
      throw Error("Only the organiser confirms receipt.");
    if (action === "declare" && x.memberId !== me?.id)
      throw Error("You can only declare your own contribution.");
    if (x.status !== "confirmed")
      x.status = action === "confirm" ? "confirmed" : "declared";
  }
  sync(p);
  payoutSync(p);
  write(p);
  return view(p, r);
}
export async function listPlans(): Promise<{
  entries: { ref: PlanRef; plan: Plan }[];
  warnings: string[];
}> {
  const refs = planRefs(),
    warnings: string[] = [];
  for (const p of Object.values(all()))
    if (!refs.some((r) => r.key === p.key))
      refs.push({ key: p.key, mode: "local" });
  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase.rpc("plan_list");
        if (error)
          throw Error(
            "Shared plans could not be loaded. Check your connection and monthly-plan setup.",
          );
        for (const r of (data || []) as PlanRef[]) {
          const index = refs.findIndex((x) => x.key === r.key);
          const current = { ...r, seat: r.seat || undefined };
          if (index >= 0) refs[index] = current;
          else refs.push(current);
        }
      }
    } catch (e) {
      warnings.push(
        e instanceof Error ? e.message : "Could not load shared plans.",
      );
    }
  }
  const results = await Promise.allSettled(
    refs.map(async (ref) => ({ ref, plan: await readPlan(ref) })),
  );
  for (const r of results)
    if (r.status === "rejected")
      warnings.push(
        String(r.reason?.message || "A saved plan could not be loaded."),
      );
  return {
    entries: results.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    ),
    warnings,
  };
}
export function subscribePlan(r: PlanRef, refresh: () => void) {
  const c = new BroadcastChannel("splitease-plans");
  c.onmessage = (e) => {
    if (e.data === r.key) refresh();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === storage) refresh();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
  const timer = setInterval(refresh, 5000);
  return () => {
    c.close();
    clearInterval(timer);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("online", refresh);
  };
}
