import { useState } from "react";
import { useShop } from "../../features/shops/useShop";
import type { ContactMethod } from "../../features/shops/shops.api";
import { formatZAR } from "../../lib/money";
import { SplitMethodSelector } from "./SplitMethodSelector";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
export function ParticipantList() {
  const {
    shop,
    removeParticipant,
    addParticipant,
    updateShare,
    updatePercentage,
  } = useShop();
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [method, setMethod] = useState<ContactMethod>("link"),
    [contact, setContact] = useState(""),
    [error, setError] = useState("");
  const setup = shop.stage === "setup";
  function add() {
    if (!name.trim()) return;
    if (
      method === "phone" &&
      !/^\+?[0-9]{9,15}$/.test(contact.replace(/[\s()-]/g, ""))
    )
      return setError(
        "Enter a cellphone number with 9 to 15 digits, including the country code when needed.",
      );
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
      return setError("Enter a valid email address.");
    addParticipant(name, method, contact.trim());
    setName("");
    setContact("");
    setError("");
    setOpen(false);
  }
  return (
    <>
      {setup && (
        <div className="rowtitle">
          <div className="section-heading">
            <span className="section-number">02</span>
            <strong>People</strong>
          </div>
          <SplitMethodSelector />
        </div>
      )}
      {shop.participants.map((p) => (
        <div className="person" key={p.id}>
          <div className="avatar square">
            {p.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="details">
            <strong>
              {p.name} {p.isOrganizer && <small className="muted">(you)</small>}
            </strong>
            <small className="muted">
              {p.isOrganizer
                ? "Your share"
                : p.contactMethod === "phone"
                  ? "Bank-linked phone - unverified"
                  : p.contactMethod === "email"
                    ? "Invite by email"
                    : "Payment invite link"}
            </small>
          </div>
          {setup && shop.splitMethod === "amount" ? (
            <input
              className="shareinput"
              type="number"
              aria-label={p.name + " share"}
              min="0.01"
              step="0.01"
              value={p.share || ""}
              onChange={(e) => updateShare(p.id, Number(e.target.value))}
            />
          ) : setup && shop.splitMethod === "percentage" ? (
            <label className="percentinput">
              <input
                className="shareinput"
                aria-label={p.name + " percentage"}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={p.percentage ?? 0}
                onChange={(e) => updatePercentage(p.id, Number(e.target.value))}
              />
              %
            </label>
          ) : (
            <strong className="share">{formatZAR(p.share)}</strong>
          )}
          <small className="person-payment muted">Pay now · Stripe test checkout</small>
          {setup && !p.isOrganizer && (
            <button
              className="remove"
              aria-label={"Remove " + p.name}
              onClick={() => removeParticipant(p.id)}
            >
              &times;
            </button>
          )}
        </div>
      ))}
      {setup && (
        <Button variant="ghost" onClick={() => setOpen(true)}>
          + Add a person
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add a person">
        <p className="muted">
          Choose how to invite them.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            label="Name"
            maxLength={60}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="field">
            <label htmlFor="contact-method">How should they join?</label>
            <select
              id="contact-method"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value as ContactMethod);
                setContact("");
                setError("");
              }}
            >
              <option value="link">Send a payment link</option>
              <option value="phone">Bank-linked cellphone number</option>
              <option value="email">Email invitation</option>
            </select>
          </div>
          {method !== "link" && (
            <Input
              label={method === "phone" ? "Cellphone number" : "Email address"}
              required
              type={method === "phone" ? "tel" : "email"}
              maxLength={254}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={
                method === "phone" ? "+27 82 123 4567" : "name@example.com"
              }
            />
          )}{" "}
          {method === "phone" && (
            <p className="muted small">
              Bank registration can only be verified once a payment provider is
              connected. Your contact details are not saved in browser storage
              or included in invitation links.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit">Add person</Button>
        </form>
      </Modal>
    </>
  );
}
