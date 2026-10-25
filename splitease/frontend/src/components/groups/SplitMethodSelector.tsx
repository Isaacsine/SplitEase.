import { useShop } from "../../features/shops/useShop";
export function SplitMethodSelector() {
  const { shop, setSplitMethod } = useShop();
  return (
    <div className="seg" aria-label="Split method">
      {(["equally", "amount", "percentage"] as const).map((method) => (
        <button
          key={method}
          aria-pressed={shop.splitMethod === method}
          className={shop.splitMethod === method ? "selected" : ""}
          onClick={() => setSplitMethod(method)}
        >
          {method === "equally"
            ? "Equally"
            : method === "amount"
              ? "By amount"
              : "By %"}
        </button>
      ))}
    </div>
  );
}
