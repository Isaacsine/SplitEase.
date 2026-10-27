import type { PaymentChoice, InstalmentCount } from "../payments/paymentPlans";
import type { Participant, ShopState } from "../shops/shops.api";
import { supabase } from "../../lib/supabase";
export interface Invite {
  shopName: string;
  totalAmount: number;
  name: string;
  share: number;
  paymentChoice?: PaymentChoice;
  instalmentCount?: InstalmentCount;
  id?: string;
  verified?: boolean;
  expiresAt?: string;
}
export function inviteLink(shop: ShopState, p: Participant) {
  const data: Invite = {
    shopName: shop.shopName,
    totalAmount: shop.totalAmount,
    name: p.name,
    share: p.share,
    paymentChoice: "now",
  };
  return (
    location.origin +
    location.pathname +
    "#join=" +
    encodeURIComponent(JSON.stringify(data))
  );
}
export function parseInvite(hash: string): Invite | null {
  try {
    const d = JSON.parse(decodeURIComponent(hash.slice(6)));
    if (
      typeof d.shopName !== "string" ||
      !d.shopName.trim() ||
      d.shopName.length > 100 ||
      typeof d.name !== "string" ||
      !d.name.trim() ||
      d.name.length > 60 ||
      !Number.isFinite(d.share) ||
      d.share <= 0 ||
      !Number.isFinite(d.totalAmount) ||
      d.totalAmount < d.share ||
      d.totalAmount > 1000000 ||
      Math.abs(d.share * 100 - Math.round(d.share * 100)) > 0.00001 ||
      Math.abs(d.totalAmount * 100 - Math.round(d.totalAmount * 100)) > 0.00001
    )
      return null;
    return {
      shopName: d.shopName,
      totalAmount: d.totalAmount,
      name: d.name,
      share: d.share,
      paymentChoice: ["now", "cash", "instalments"].includes(d.paymentChoice)
        ? d.paymentChoice
        : "now",
      instalmentCount: d.instalmentCount === 4 ? 4 : 3,
      verified: false,
    };
  } catch {
    return null;
  }
}
function withPreference(url: string, p: Participant) {
  return url + "&choice=" + "now" + "&count=" + (p.instalmentCount || 3);
}
export async function publishInvite(
  shop: ShopState,
  p: Participant,
): Promise<string> {
  if (!supabase)
    throw Error("Connect Supabase to create a tracked invitation.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Error("Sign in to create a tracked payment invitation.");
  const existing = await supabase
    .from("payment_requests")
    .select("token")
    .eq("owner_id", user.id)
    .eq("split_id", shop.id)
    .eq("participant_id", p.id)
    .eq("title", shop.shopName)
    .eq("recipient_name", p.name)
    .eq("amount_cents", Math.round(p.share * 100))
    .eq("total_cents", Math.round(shop.totalAmount * 100))
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (existing.error)
    throw Error("Could not check existing invitations. Please try again.");
  if (existing.data)
    return withPreference(
      location.origin + location.pathname + "#invite=" + existing.data.token,
      p,
    );
  const { data, error } = await supabase
    .from("payment_requests")
    .insert({
      owner_id: user.id,
      split_id: shop.id,
      participant_id: p.id,
      title: shop.shopName,
      recipient_name: p.name,
      amount_cents: Math.round(p.share * 100),
      total_cents: Math.round(shop.totalAmount * 100),
    })
    .select("token")
    .single();
  if (error)
    throw Error(
      "Could not save the invitation. Check your Supabase configuration and migration.",
    );
  return withPreference(
    location.origin + location.pathname + "#invite=" + data.token,
    p,
  );
}
export async function readInvite(rawToken: string): Promise<Invite> {
  const [token, ...rest] = rawToken.split("&");
  const preferences = new URLSearchParams(rest.join("&"));
  if (!supabase)
    throw Error("This invitation requires a connected Supabase project.");
  if (!/^[0-9a-f-]{36}$/i.test(token))
    throw Error("This invitation is invalid.");
  const { data, error } = await supabase!.rpc("read_payment_request", {
    request_token: token,
  });
  if (error || !data?.length)
    throw Error("This invitation is invalid or has expired.");
  const row = data[0];
  return {
    id: row.id,
    shopName: row.title,
    name: row.recipient_name,
    share: row.amount_cents / 100,
    totalAmount: row.total_cents / 100,
    paymentChoice: (["now", "cash", "instalments"].includes(
      preferences.get("choice") || "",
    )
      ? preferences.get("choice")
      : "now") as PaymentChoice,
    instalmentCount: preferences.get("count") === "4" ? 4 : 3,
    verified: true,
    expiresAt: row.expires_at,
  };
}
export async function listRequests() {
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("payment_requests")
    .select("id,token,title,recipient_name,amount_cents,created_at,expires_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw Error("Could not load payment requests.");
  return data || [];
}
export function inviteMessage(
  name: string,
  title: string,
  share: number,
  url: string,
) {
  return (
    "Hi " +
    name +
    ", your share for " +
    title +
    " is R " +
    share.toFixed(2) +
    ". View the request: " +
    url
  );
}
