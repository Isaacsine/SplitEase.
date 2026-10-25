import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "../../components/ui/Button";
import { inviteLink, inviteMessage, publishInvite } from "./invitations.api";
import type { Participant, ShopState } from "../shops/shops.api";
import { supabase } from "../../lib/supabase";
export function ShareInvite({
  shop,
  person,
}: {
  shop: ShopState;
  person: Participant;
}) {
  const [url, setUrl] = useState(() => inviteLink(shop, person)),
    [tracked, setTracked] = useState(false),
    [qr, setQr] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const publishing = useRef(false);
  useEffect(() => {
    setUrl(inviteLink(shop, person));
    setTracked(false);
    setMessage("");
  }, [shop, person]);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 240, margin: 2, errorCorrectionLevel: "M" })
      .then((data) => {
        if (active) setQr(data);
      })
      .catch(() => {
        if (active) setQr("");
      });
    return () => {
      active = false;
    };
  }, [url]);
  const text = inviteMessage(person.name, shop.shopName, person.share, url);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch {
      setMessage("Select and copy the link below.");
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: shop.shopName, text });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    await copy();
  }
  async function publish() {
    if (publishing.current) return;
    publishing.current = true;
    setBusy(true);
    try {
      setUrl(await publishInvite(shop, person));
      setTracked(true);
      setMessage("Tracked invitation created.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not create invitation.",
      );
    } finally {
      publishing.current = false;
      setBusy(false);
    }
  }
  const phone =
    person.contactMethod === "phone"
      ? person.contact?.replace(/[^0-9]/g, "").replace(/^0(?=\d{9}$)/, "27")
      : undefined;
  return (
    <div className="invite">
      <div className="rowtitle">
        <strong>Invite {person.name}</strong>
        <span className="badge">
          {tracked ? "Tracked request" : "Untracked link"}
        </span>
      </div>
      <p className="muted small">
        {tracked
          ? "This request is saved to your account and can be opened on another device."
          : "This link shares the amount only. Sign in and create a tracked invitation to save it to your account."}
      </p>
      <div className="linkrow">
        <input aria-label="Invite link" readOnly value={url} />
        <Button variant="secondary" onClick={copy}>
          Copy link
        </Button>
        <Button variant="secondary" onClick={share}>
          Share
        </Button>
      </div>
      <div className="actions shareactions">
        <a
          className="button secondary"
          target="_blank"
          rel="noreferrer"
          href={
            "https://wa.me/" +
            (phone || "") +
            "?text=" +
            encodeURIComponent(text)
          }
        >
          WhatsApp
        </a>
        {person.contactMethod === "email" && person.contact && (
          <a
            className="button secondary"
            href={
              "mailto:" +
              encodeURIComponent(person.contact) +
              "?subject=" +
              encodeURIComponent(shop.shopName) +
              "&body=" +
              encodeURIComponent(text)
            }
          >
            Email invite
          </a>
        )}
        <a
          className="button secondary"
          target="_blank"
          rel="noreferrer"
          href={url}
        >
          Open request
        </a>
      </div>
      {supabase && !tracked && (
        <Button variant="secondary" disabled={busy} onClick={publish}>
          {busy ? "Creating invitation..." : "Create tracked invitation"}
        </Button>
      )}
      {qr && (
        <details className="qr-details">
          <summary>Show invitation QR code</summary>
          <img
            className="qrimage"
            src={qr}
            alt={"Invitation QR for " + person.name}
          />
        </details>
      )}
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
