import { Modal } from "../ui/Modal";
import { useShop } from "../../features/shops/useShop";
import { CostBreakdown } from "./CostBreakdown";
import { PaymentStatus } from "./PaymentStatus";
export function CheckoutSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { shop } = useShop();
  return (
    <Modal open={open} onClose={onClose} title="Your split">
      <h3>{shop.shopName || "New split"}</h3>
      <CostBreakdown />
      <div className="receipt">
        <span>People splitting</span>
        <strong>{shop.participants.length}</strong>
      </div>
      <div className="receipt">
        <span>Payment status</span>
        <PaymentStatus />
      </div>
      <p className="muted">
        Open a participant invitation to use Stripe test checkout. Test results appear on the receipt page and do not update this split summary.
      </p>
    </Modal>
  );
}
