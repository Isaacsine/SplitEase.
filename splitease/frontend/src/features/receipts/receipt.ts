export interface ReceiptItem {
  id: string;
  name: string;
  cents: number;
  assigned: string[];
}
export const sampleReceipt =
  "RESTAURANT NIGHT\nPizza platter 450.00\nPasta platter 350.00\nDesserts 200.00\nDrinks 200.00\nTOTAL 1200.00";
export function parseReceipt(text: string) {
  const items: ReceiptItem[] = [];
  let total: number | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const match = line.match(
      /^(.*?)\s+(?:R\s*)?([0-9][0-9 ,]*[.,][0-9]{2})\s*$/i,
    );
    if (!match) continue;
    const name = match[1].trim(),
      number = match[2]
        .replace(/ /g, "")
        .replace(/,(?=\d{3}(?:[.,]|$))/g, "")
        .replace(",", ".");
    const cents = Math.round(Number(number) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000)
      continue;
    if (/^(?:grand\s+total|total|amount\s+due)$/i.test(name)) {
      total = cents;
      continue;
    }
    if (
      !name ||
      /^(?:sub\s*total|vat|tax|change|cash|card|tender|paid|balance)/i.test(
        name,
      )
    )
      continue;
    items.push({ id: crypto.randomUUID(), name, cents, assigned: [] });
  }
  return { items, total };
}
export function assignReceipt(items: ReceiptItem[], ids: string[]) {
  const shares = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const item of items) {
    const assigned = ids.filter((id) => item.assigned.includes(id));
    if (
      !item.name.trim() ||
      !Number.isSafeInteger(item.cents) ||
      item.cents <= 0 ||
      !assigned.length
    )
      throw Error(
        "Every item needs a description, a positive cent amount and at least one person.",
      );
    const base = Math.floor(item.cents / assigned.length),
      remainder = item.cents % assigned.length;
    assigned.forEach((id, i) => (shares[id] += base + (i < remainder ? 1 : 0)));
  }
  if (!items.length) throw Error("Add at least one receipt item.");
  if (ids.some((id) => shares[id] <= 0))
    throw Error(
      "Assign an item to every person, or remove unused participants from the split.",
    );
  return shares;
}
