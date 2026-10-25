import type { PaymentChoice, InstalmentCount } from "../payments/paymentPlans";
export type SplitMethod = "equally" | "amount" | "percentage";
export type Stage = "setup" | "authorise" | "checkout" | "paid";
export type ContactMethod = "link" | "phone" | "email";
export interface Participant {
  id: string;
  name: string;
  isOrganizer?: boolean;
  share: number;
  paymentChoice?: PaymentChoice;
  instalmentCount?: InstalmentCount;
  percentage?: number;
  contactMethod?: ContactMethod;
  contact?: string;
  state?: "authorised" | "failed";
  cap?: number;
  expires?: number;
}
export interface ShopState {
  id: string;
  shopName: string;
  shoppingWith: string;
  totalAmount: number;
  splitMethod: SplitMethod;
  participants: Participant[];
  stage: Stage;
  merchant: string;
}
export interface Receipt {
  id: string;
  shopName: string;
  totalAmount: number;
  merchant: string;
  date: string;
  participants: Participant[];
}
export const newShop = (): ShopState => ({
  id: crypto.randomUUID(),
  shopName: "",
  shoppingWith: "Anything",
  totalAmount: 0,
  splitMethod: "equally",
  stage: "setup",
  merchant: "",
  participants: [
    {
      id: crypto.randomUUID(),
      name: "You",
      isOrganizer: true,
      share: 0,
      contactMethod: "link",
    },
  ],
});
export function calculateShares(shop: ShopState): ShopState {
  const count = shop.participants.length;
  if (!count) return shop;
  const cents = Math.round(shop.totalAmount * 100);
  if (shop.splitMethod === "equally") {
    const base = Math.floor(cents / count);
    return {
      ...shop,
      participants: shop.participants.map((p, i) => ({
        ...p,
        share: (base + (i < cents - base * count ? 1 : 0)) / 100,
      })),
    };
  }
  if (shop.splitMethod === "percentage") {
    let allocated = 0;
    return {
      ...shop,
      participants: shop.participants.map((p, i) => {
        const amount =
          i === count - 1 &&
          Math.abs(
            shop.participants.reduce((s, p) => s + (p.percentage || 0), 0) -
              100,
          ) < 0.001
            ? cents - allocated
            : Math.round((cents * (p.percentage || 0)) / 100);
        allocated += amount;
        return { ...p, share: amount / 100 };
      }),
    };
  }
  return shop;
}
export function validateShop(shop: ShopState) {
  if (!shop.shopName.trim()) return "Give this split a name.";
  if (shop.shopName.trim().length > 100)
    return "Split names can have up to 100 characters.";
  if (
    !Number.isFinite(shop.totalAmount) ||
    shop.totalAmount <= 0 ||
    shop.totalAmount > 1000000
  )
    return "Enter a total between R 0.01 and R 1,000,000.";
  if (
    Math.abs(shop.totalAmount * 100 - Math.round(shop.totalAmount * 100)) >
    0.00001
  )
    return "Use no more than two decimal places for the total.";
  if (shop.participants.length < 2) return "Add at least two people.";
  if (
    shop.participants.some(
      (p) => !p.name.trim() || !Number.isFinite(p.share) || p.share <= 0,
    )
  )
    return "Every participant needs a name and a positive share.";
  if (
    shop.participants.some(
      (p) => Math.abs(p.share * 100 - Math.round(p.share * 100)) > 0.00001,
    )
  )
    return "Use no more than two decimal places for each share.";
  if (
    shop.splitMethod === "percentage" &&
    shop.participants.some(
      (p) =>
        !Number.isFinite(p.percentage) ||
        p.percentage! <= 0 ||
        p.percentage! > 100,
    )
  )
    return "Each percentage must be greater than zero and no more than 100%.";
  if (
    shop.splitMethod === "percentage" &&
    Math.abs(
      shop.participants.reduce((s, p) => s + (p.percentage || 0), 0) - 100,
    ) > 0.001
  )
    return "Percentages must add up to 100%.";
  if (
    Math.round(shop.participants.reduce((s, p) => s + p.share, 0) * 100) !==
    Math.round(shop.totalAmount * 100)
  )
    return "Shares must add up exactly to the total.";
  return "";
}
const key = "splitease-draft-v2";
export function loadDraft(): { shop: ShopState; history: Receipt[] } {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "null");
    if (
      data?.shop &&
      typeof data.shop.shopName === "string" &&
      Number.isFinite(data.shop.totalAmount) &&
      Array.isArray(data.shop.participants) &&
      data.shop.participants.length &&
      data.shop.participants.every(
        (p: Participant) =>
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          Number.isFinite(p.share),
      )
    )
      return { shop: { ...data.shop, stage: "setup" }, history: [] };
  } catch {}
  return { shop: newShop(), history: [] };
}
export function saveDraft(shop: ShopState) {
  const safe = {
    ...shop,
    participants: shop.participants.map(({ contact, ...p }) => p),
  };
  localStorage.setItem(key, JSON.stringify({ shop: safe }));
}
