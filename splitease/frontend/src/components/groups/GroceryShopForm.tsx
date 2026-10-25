import { useShop } from "../../features/shops/useShop";
import { Input } from "../ui/Input";
export function GroceryShopForm() {
  const { shop, updateShop } = useShop();
  return (
    <>
      <div className="grid">
        <div className="field">
          <label htmlFor="purpose">What is it for?</label>
          <select
            id="purpose"
            value={shop.shoppingWith}
            onChange={(e) => updateShop({ shoppingWith: e.target.value })}
          >
            {[
              "Anything",
              "Food & drinks",
              "Rent & bills",
              "Travel",
              "Shopping",
              "Events",
              "Gifts",
              "Services",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <Input
          label="Split name"
          placeholder="e.g. Friday dinner or monthly rent"
          maxLength={100}
          value={shop.shopName}
          onChange={(e) => updateShop({ shopName: e.target.value })}
        />
      </div>
      <label className="fieldlabel" htmlFor="total">
        Total to split
      </label>
      <div className="moneyinput">
        <span>R</span>
        <input
          id="total"
          type="number"
          min="0.01"
          max="1000000"
          step="0.01"
          value={shop.totalAmount || ""}
          onChange={(e) => updateShop({ totalAmount: Number(e.target.value) })}
        />
        <small>ZAR</small>
      </div>
    </>
  );
}
