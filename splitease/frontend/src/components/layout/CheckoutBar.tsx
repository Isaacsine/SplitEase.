import { useState } from "react";
import { useShop } from "../../features/shops/useShop";
import { Button } from "../ui/Button";
import { formatZAR } from "../../lib/money";
import { CheckoutSheet } from "../checkout/CheckoutSheet";
export function CheckoutBar() {
  const { shop, requestInvites, reset } = useShop();
  const [open, setOpen] = useState(false);
  const setup = shop.stage === "setup";
  const label = setup ? "Create payment invites" : "Start a new split";
  return (
    <>
      <div className="checkoutbar">
        <div className="dock">
          <button
            type="button"
            className="summarybutton"
            aria-label="Your split"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            <span className="summary-heading">
              Your split{" "}
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="m6 15 6-6 6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="summary-figures">
              <strong>{formatZAR(shop.totalAmount)}</strong>
              <small>
                {shop.participants.length}{" "}
                {shop.participants.length === 1 ? "person" : "people"}
              </small>
            </span>
          </button>
          <Button
            className="invite-action"
            aria-label={label}
            onClick={setup ? requestInvites : reset}
          >
            <span className="invite-label-full">{label}</span>
            <span className="invite-label-short">
              {setup ? "Create invites" : "New split"}
            </span>
            <svg
              className="invite-arrow"
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M5 12h14m-6-6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        </div>
      </div>
      <CheckoutSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
