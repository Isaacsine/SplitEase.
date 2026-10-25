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
        Payment processing is not connected. No funds have been collected.
      </p>
    </Modal>
  );
}
