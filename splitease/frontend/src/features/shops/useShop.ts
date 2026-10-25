import type { PaymentChoice, InstalmentCount } from "../payments/paymentPlans";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  calculateShares,
  loadDraft,
  newShop,
  saveDraft,
  validateShop,
  type ShopState,
  type SplitMethod,
  type ContactMethod,
} from "./shops.api";
function useStateValue() {
  const [initial] = useState(loadDraft);
  const [shop, setShop] = useState(initial.shop);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    try {
      saveDraft(shop);
    } catch {
      setError("Draft storage is unavailable in this browser.");
    }
  }, [shop]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const updateShop = (data: Partial<ShopState>) => {
    setError("");
    setShop((prev) => calculateShares({ ...prev, ...data, stage: "setup" }));
  };
  const addParticipant = (
    name: string,
    contactMethod: ContactMethod = "link",
    contact = "",
  ) => {
    if (!name.trim()) return;
    setShop((prev) =>
      calculateShares({
        ...prev,
        stage: "setup",
        participants: [
          ...prev.participants,
          {
            id: crypto.randomUUID(),
            name: name.trim(),
            share: 0,
            percentage: 0,
            contactMethod,
            contact,
          },
        ],
      }),
    );
  };
  const removeParticipant = (id: string) =>
    setShop((prev) =>
      calculateShares({
        ...prev,
        stage: "setup",
        participants: prev.participants.filter(
          (p) => p.id !== id || p.isOrganizer,
        ),
      }),
    );
  const setSplitMethod = (method: SplitMethod) => {
    let participants = shop.participants;
    if (method === "percentage") {
      const base = Math.floor(10000 / participants.length);
      participants = participants.map((p, i) => ({
        ...p,
        percentage:
          (base + (i < 10000 - base * participants.length ? 1 : 0)) / 100,
      }));
    }
    updateShop({ splitMethod: method, participants });
  };
  const updateShare = (id: string, share: number) =>
    updateShop({
      participants: shop.participants.map((p) =>
        p.id === id ? { ...p, share } : p,
      ),
    });
  const updatePercentage = (id: string, percentage: number) =>
    updateShop({
      participants: shop.participants.map((p) =>
        p.id === id ? { ...p, percentage } : p,
      ),
    });
  const setPaymentChoice = (
    id: string,
    paymentChoice: PaymentChoice,
    instalmentCount: InstalmentCount = 3,
  ) =>
    updateShop({
      participants: shop.participants.map((p) =>
        p.id === id ? { ...p, paymentChoice, instalmentCount } : p,
      ),
    });
  const requestInvites = () => {
    const problem = validateShop(shop);
    setError(problem);
    if (!problem) setShop((prev) => ({ ...prev, stage: "authorise" }));
  };
  const edit = () => {
    setError("");
    setShop((prev) => ({ ...prev, stage: "setup" }));
  };
  const reset = () => {
    setShop(newShop());
    setError("");
  };
  return {
    shop,
    error,
    setError,
    now,
    updateShop,
    addParticipant,
    removeParticipant,
    setSplitMethod,
    updateShare,
    updatePercentage,
    setPaymentChoice,
    requestInvites,
    edit,
    reset,
  };
}
const Context = createContext<ReturnType<typeof useStateValue> | null>(null);
export function ShopProvider({ children }: { children: ReactNode }) {
  return createElement(Context.Provider, { value: useStateValue() }, children);
}
export function useShop() {
  const v = useContext(Context);
  if (!v) throw Error("ShopProvider is required");
  return v;
}
