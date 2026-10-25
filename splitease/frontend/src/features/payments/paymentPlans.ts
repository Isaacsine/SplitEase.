export type PaymentChoice = "now" | "cash" | "instalments";
export type InstalmentCount = 3 | 4;
export const paymentLabels: Record<PaymentChoice, string> = {
  now: "Pay now",
  cash: "Cash",
  instalments: "Pay in instalments",
};
export function todayInSouthAfrica() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return part("year") + "-" + part("month") + "-" + part("day");
}
export function repaymentPlan(
  amount: number,
  count: InstalmentCount = 3,
  firstDate = todayInSouthAfrica(),
) {
  const cents = Math.round(amount * 100);
  if (
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(cents) ||
    cents < count ||
    ![3, 4].includes(count)
  )
    return [];
  const date = new Date(firstDate + "T00:00:00Z");
  if (!Number.isFinite(date.getTime())) return [];
  const base = Math.floor(cents / count),
    remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => {
    const month = date.getUTCMonth() + i,
      year = date.getUTCFullYear();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const due = new Date(
      Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)),
    )
      .toISOString()
      .slice(0, 10);
    return {
      number: i + 1,
      due,
      amount: (base + (i < remainder ? 1 : 0)) / 100,
    };
  });
}
export const displayDate = (date: string) =>
  new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(date + "T12:00:00Z"));
