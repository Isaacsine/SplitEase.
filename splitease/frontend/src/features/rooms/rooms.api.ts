import { assertPrivateScope, privateScope } from "../../lib/privateStorage";
import { privateRpc } from "../../lib/privateCloud";
import { privateLocal } from "../../lib/privateStorage";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import {
  roomMembers,
  rememberRoom,
  roomRefs,
  type Room,
  type RoomRef,
  type RoomAction,
  type RoomEvent,
} from "./rooms";
import { validateShop, type ShopState } from "../shops/shops.api";
import {
  repaymentPlan,
  type PaymentChoice,
  type InstalmentCount,
} from "../payments/paymentPlans";
const channels = new Map<string, RealtimeChannel>();
const demoKey = "splitease-demo-rooms-v1";
const localRead = (): Record<string, Room> =>
  JSON.parse(privateLocal.getItem(demoKey) || "{}");
function notify(key: string) {
  const channel = new BroadcastChannel("splitease-local-rooms");
  channel.postMessage({ key });
  channel.close();
}
function record(
  room: Room,
  actor: string,
  action: RoomEvent["action"],
  memberId?: string,
  choice?: PaymentChoice,
) {
  room.events = [
    {
      id: crypto.randomUUID(),
      actor,
      action,
      memberId,
      choice,
      createdAt: new Date().toISOString(),
    },
    ...(room.events || []),
  ].slice(0, 100);
}
function save(room: Room) {
  const rooms = localRead();
  rooms[room.key] = room;
  privateLocal.setItem(demoKey, JSON.stringify(rooms));
  notify(room.key);
  return room;
}
function view(room: Room, ref: RoomRef): Room {
  if (ref.seat && !room.members.some((m) => m.seatToken === ref.seat))
    throw Error("This participant link is invalid.");
  const owner = !ref.seat;
  return {
    ...room,
    owner,
    members: room.members.map((m, i) => ({
      ...m,
      isMe: ref.seat ? m.seatToken === ref.seat : i === 0,
      seatToken: owner || m.seatToken === ref.seat ? m.seatToken : undefined,
    })),
  };
}
export function createGuidedRoom(): RoomRef {
  const key = crypto.randomUUID();
  const names = ["You", "Alex", "Lerato"];
  const room: Room = {
    id: key,
    key,
    title: "R1,200 restaurant night",
    totalCents: 120000,
    mode: "demo",
    createdAt: new Date().toISOString(),
    completed: false,
    owner: true,
    members: names.map((name, i) => ({
      id: crypto.randomUUID(),
      name,
      shareCents: 40000,
      choice: i === 0 ? "cash" : i === 1 ? "now" : "instalments",
      count: 3,
      state: "pending",
      repaid: 0,
      isMe: i === 0,
      seatToken: crypto.randomUUID(),
    })),
  };
  record(room, "Organiser", "created");
  save(room);
  const ref: RoomRef = { key, mode: "demo" };
  rememberRoom(ref);
  return ref;
}
export async function createLiveRoom(shop: ShopState): Promise<RoomRef> {
  const scope = privateScope();
  const invalid = validateShop(shop);
  if (invalid) throw Error(invalid);
  if (!supabase) throw Error("Sign in to create a shared group.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    throw Error("Sign in to create a group and share it with your people.");
  assertPrivateScope(scope);
  const { data, error } = await privateRpc("create_group_room", {
    p_title: shop.shopName,
    p_members: roomMembers(shop).map((m) => ({
      name: m.name,
      share_cents: m.shareCents,
      choice: m.choice,
      count: m.count,
    })),
  });
  if (error) throw Error("We could not create your group. Please try again.");
  assertPrivateScope(scope);
  const ref: RoomRef = { key: data.key, mode: "cloud" };
  rememberRoom(ref);
  return ref;
}
export async function readRoom(ref: RoomRef): Promise<Room> {
  if (ref.mode === "demo") {
    const room = localRead()[ref.key];
    if (!room)
      throw Error(
        "This group is saved on the device that created it. Open it there, or create a shared group to use another device.",
      );
    return view(room, ref);
  }
  if (!supabase) throw Error("Supabase is not configured.");
  if (!(await supabase.auth.getSession()).data.session) throw Error("Sign in to open this shared group.");
  const { data, error } = await privateRpc("read_group_room", {
    p_room_token: ref.key,
    p_member_token: ref.seat || null,
  });
  if (error || !data)
    throw Error(
      "This group is unavailable. Check your connection or ask the organiser for a new link.",
    );
  return data as Room;
}

export async function listGroupHistory(): Promise<Room[]> {
  const local = Object.values(localRead());
  const cloud = await Promise.all(
    roomRefs()
      .filter((ref) => ref.mode === "cloud")
      .map((ref) => readRoom(ref).catch(() => null)),
  );
  const byKey = new Map<string, Room>();
  [...local, ...cloud.filter((room): room is Room => room !== null)].forEach(
    (room) => byKey.set(room.key, room),
  );
  return [...byKey.values()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
export async function updateRoom(
  ref: RoomRef,
  memberId: string,
  action: RoomAction,
  choice: PaymentChoice = "now",
  count: InstalmentCount = 3,
): Promise<Room> {
  if (ref.mode === "cloud") {
    if (!supabase) throw Error("Supabase is not configured.");
    const room = await readRoom(ref);
    const member = room.members.find((m) => m.id === memberId);
    if (!member?.seatToken)
      throw Error("Open your own participant link to change this share.");
    const { error } = await privateRpc("update_group_member", {
      p_room_token: ref.key,
      p_member_token: member.seatToken,
      p_action: action,
      p_choice: choice,
      p_count: count,
    });
    if (error) throw Error(error.message || "Could not update this choice.");
    return await readRoom(ref);
  }
  const stored = localRead()[ref.key];
  if (!stored) throw Error("Demo room not found.");
  const current = view(stored, ref),
    m = stored.members.find((m) => m.id === memberId);
  if (!m) throw Error("Participant not found.");
  if (!current.owner && !current.members.find((x) => x.id === memberId)?.isMe)
    throw Error("You can only change your own contribution.");
  if (action === "cash" && !current.owner)
    throw Error("Only the organiser can confirm cash receipt.");
  if (stored.completed && action !== "repay")
    throw Error(
      "This split is complete. Only outstanding repayments can be previewed.",
    );
  if (action === "method") {
    m.choice = choice;
    m.count = count;
    m.state = "pending";
    m.repaid = 0;
  } else if (action === "pay") {
    if (m.choice === "cash") m.state = "cash_declared";
    else if (m.choice === "now") m.state = "covered";
    else throw Error("Use the credit preview for instalments.");
  } else if (action === "cash") {
    if (m.choice !== "cash") throw Error("This share is not cash.");
    m.state = "covered";
  } else if (action === "credit") {
    if (
      m.choice !== "instalments" ||
      !repaymentPlan(m.shareCents / 100, m.count).length
    )
      throw Error("Choose a valid instalment plan.");
    m.state = "credit_funded";
    m.repaid = 1;
  } else if (action === "repay") {
    if (m.state !== "credit_funded" || m.repaid >= m.count)
      throw Error("No repayments remain.");
    m.repaid++;
  } else if (action === "decline") {
    m.state = "declined";
    m.repaid = 0;
  } else {
    m.state = "pending";
    m.repaid = 0;
  }
  record(stored, current.owner ? "Organiser" : m.name, action, m.id, m.choice);
  save(stored);
  return view(stored, ref);
}
export async function completeRoom(ref: RoomRef) {
  if (ref.mode === "cloud") {
    if (!supabase) throw Error("Supabase is not configured.");
    const { data, error } = await privateRpc("complete_group_room", {
      p_room_token: ref.key,
    });
    if (error) throw Error(error.message);
    return data as Room;
  }
  const room = localRead()[ref.key];
  if (!room || ref.seat)
    throw Error("Only the organiser can complete the split.");
  if (room.members.some((m) => !["covered", "credit_funded"].includes(m.state)))
    throw Error("Cover every share before completing the split.");
  if (!room.completed) record(room, "Organiser", "completed");
  room.completed = true;
  save(room);
  return view(room, ref);
}
export function subscribeRoom(
  ref: RoomRef,
  onChange: () => void,
  onStatus: (status: string) => void,
) {
  if (ref.mode === "demo") {
    const channel = new BroadcastChannel("splitease-local-rooms");
    channel.onmessage = (e) => {
      if (e.data?.key === ref.key) onChange();
    };
    const storage = (e: StorageEvent) => {
      if (e.key === demoKey) onChange();
    };
    window.addEventListener("storage", storage);
    onStatus("Saved on this device");
    return () => {
      channel.close();
      window.removeEventListener("storage", storage);
    };
  }
  if (!supabase) {
    onStatus("Not connected");
    return () => {};
  }
  const channel = supabase
    .channel("group-room:" + ref.key)
    .on("broadcast", { event: "room_changed" }, onChange)
    .subscribe((status) => {
      onStatus(
        status === "SUBSCRIBED"
          ? "Connected - updates are live"
          : "Reconnecting - automatic refresh active",
      );
      if (status === "SUBSCRIBED") onChange();
    });
  channels.set(ref.key, channel);
  const client = supabase;
  const timer = setInterval(onChange, 5000);
  return () => {
    clearInterval(timer);
    if (channels.get(ref.key) === channel) channels.delete(ref.key);
    void client.removeChannel(channel);
  };
}
export async function broadcastRoom(ref: RoomRef) {
  if (ref.mode === "cloud" && supabase) {
    const active = channels.get(ref.key);
    const channel = active || supabase.channel("group-room:" + ref.key);
    try {
      await channel.send({
        type: "broadcast",
        event: "room_changed",
        payload: { refresh: true },
      });
    } finally {
      if (!active) void supabase.removeChannel(channel);
    }
  }
}
export async function ownedRoomRefs(): Promise<RoomRef[]> {
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("group_rooms")
    .select("access_token")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw Error("Apply the live-room migration to load saved rooms.");
  return (data || []).map((r) => ({
    key: r.access_token,
    mode: "cloud" as const,
  }));
}

export async function joinRoom(ref: RoomRef) {
  if (!ref.seat) return;
  if (ref.mode === "cloud") {
    if (!supabase) return;
    const { error } = await privateRpc("join_group_room", {
      p_room_token: ref.key,
      p_member_token: ref.seat,
    });
    if (error)
      throw Error(
        "Apply the activity-timeline migration to record participant joins.",
      );
    await broadcastRoom(ref);
    return;
  }
  const room = localRead()[ref.key];
  if (!room) return;
  view(room, ref);
  const m = room.members.find((m) => m.seatToken === ref.seat)!;
  if (
    (room.events || []).some(
      (e) => e.action === "joined" && e.memberId === m.id,
    )
  )
    return;
  record(room, m.name, "joined", m.id);
  save(room);
}

export async function revokeRoomInvitation(ref: RoomRef, memberId: string) {
  if (ref.mode !== "cloud") throw new Error("Only shared invitations can be revoked.");
  const { error } = await privateRpc("revoke_group_invitation", { p_room_token: ref.key, p_member_id: memberId });
  if (error) throw new Error("Could not revoke this invitation. Please try again.");
}
