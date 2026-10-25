import { RoomLauncher } from "../features/rooms/RoomLauncher";
import { useState } from "react";
import { useShop } from "../features/shops/useShop";
import { GroceryShopForm } from "../components/groups/GroceryShopForm";
import { ParticipantList } from "../components/groups/ParticipantList";
import { CostBreakdown } from "../components/checkout/CostBreakdown";
import { CheckoutBar } from "../components/layout/CheckoutBar";
import { ShareInvite } from "../features/invitations/ShareInvite";
import { Button } from "../components/ui/Button";
import { formatZAR } from "../lib/money";
export function PayTogetherPage() {
  const { shop, error, edit } = useShop();
  const [selected, setSelected] = useState("");
  const person =
    shop.participants.find((p) => p.id === selected) || shop.participants[0];
  return (
    <>
      <div className="split-workspace">
        <section className="panel split-main">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {shop.stage === "setup" ? (
            <>
              <div className="section-heading">
                <span className="section-number">01</span>
                <h2>Expense details</h2>
              </div>
              <p className="muted">
                Give this split a name so everyone knows what it is for.
              </p>
              <GroceryShopForm />
              <ParticipantList />
            </>
          ) : (
            <>
              <h2>Your split is ready to share.</h2>
              <p className="muted">
                Send each person their own payment request.
              </p>
              <ParticipantList />
              <div className="field">
                <label htmlFor="participant">Choose a participant</label>
                <select
                  id="participant"
                  value={person.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {shop.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {formatZAR(p.share)}
                    </option>
                  ))}
                </select>
              </div>
              <ShareInvite key={person.id} shop={shop} person={person} />
              <p className="muted small">
                Each link belongs to one person. Keep it with its intended
                recipient.
              </p>
              <Button variant="ghost" onClick={edit}>
                Back to edit split
              </Button>
            </>
          )}
        </section>
        <aside className="split-rail" aria-label="Split summary">
          <section className="panel summary-card">
            <p className="workspace-kicker">OVERVIEW</p>
            <h2>{formatZAR(shop.totalAmount)}</h2>
            <p className="muted">
              {shop.participants.length}{" "}
              {shop.participants.length === 1 ? "person" : "people"} splitting{" "}
              {shop.shoppingWith === "Anything"
                ? "an expense"
                : shop.shoppingWith.toLowerCase()}
            </p>
            <CostBreakdown />
            <RoomLauncher />
          </section>
          <a className="receipt-shortcut" href="#receipt">
            <span className="shortcut-icon" aria-hidden="true">
              +
            </span>
            <span>
              <strong>Start with a receipt</strong>
              <small>Upload, review and assign items</small>
            </span>
            <span aria-hidden="true">&#8599;</span>
          </a>
          <p className="rail-note">
            Your draft stays on this device until you share it.
          </p>
        </aside>
      </div>
      <CheckoutBar />
    </>
  );
}
