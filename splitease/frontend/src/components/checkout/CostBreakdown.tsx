import { useShop } from "../../features/shops/useShop";
import { formatZAR } from "../../lib/money";
export function CostBreakdown() {
  const { shop } = useShop();
  return (
    <div className="cost-summary">
      <strong>Split breakdown</strong>
      <div className="receipt">
        <span>Total to split</span>
        <strong>{formatZAR(shop.totalAmount)}</strong>
      </div>
      <div className="receipt">
        <span>Your share</span>
        <strong>{formatZAR(shop.participants[0]?.share || 0)}</strong>
      </div>
      <small className="muted">No money is collected in this prototype.</small>
    </div>
  );
}
