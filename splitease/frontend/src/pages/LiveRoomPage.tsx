import { revokeRoomInvitation } from "../features/rooms/rooms.api";
import { StripeSandboxCheckout } from "../features/payments/StripeSandboxCheckout";
import { RoomTimeline } from "../features/rooms/RoomTimeline";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  parseRoom,
  roomLink,
} from "../features/rooms/rooms";
import { useRoom } from "../features/rooms/useRoom";
import { RoomChat } from "../features/rooms/RoomChat";
import { Button } from "../components/ui/Button";
import { formatZAR } from "../lib/money";
export function LiveRoomPage({ hash }: { hash: string }) {
  const ref = parseRoom(hash);
  const { room, error, connection, busy, refresh } =
    useRoom(ref);
  const [selected, setSelected] = useState(""),
    [qr, setQr] = useState(""),
    [message, setMessage] = useState(""),
    [hubTab, setHubTab] = useState("overview");
  const member =
    room?.members.find((m) => m.id === selected) ||
    room?.members.find((m) => m.isMe) ||
    room?.members[0];
  const link =
    ref && member?.seatToken
      ? roomLink({ ...ref, seat: member.seatToken })
      : ref
        ? roomLink(ref)
        : "";
  const photosLink = ref ? roomLink(ref).replace("#room=", "#room-photos=") : "";
  useEffect(() => {
    let active = true;
    if (link)
      QRCode.toDataURL(link, { width: 240, margin: 2 })
        .then((data) => {
          if (active) setQr(data);
        })
        .catch(() => {
          if (active) setQr("");
        });
    return () => {
      active = false;
    };
  }, [link]);
  if (!room)
    return (
      <section className="panel">
        <h2>Group room</h2>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          <p role="status">Loading room...</p>
        )}
        <Button variant="secondary" onClick={refresh}>
          Try again
        </Button>
        <a className="button ghost" href="#pay">
          Back to split
        </a>
      </section>
    );
  const mine = room.members.find((m) => m.isMe);
  const guided = room.mode === "demo";
  return (
    <section className="panel live-room">
      <div className="rowtitle">
        <div>
          <span className="pill">
            {guided ? "On this device" : "Shared group"}
          </span>
          <h2 className="requestheading">{room.title}</h2>
        </div>
        <Button variant="secondary" disabled={busy} onClick={refresh}>
          Refresh group
        </Button>
      </div>
      <p className="connection" role="status">
        {connection}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <nav className="group-hub" aria-label="Group hub">
        <strong>Group hub</strong>
        {(["overview", "payments", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={hubTab === tab ? "active" : ""}
            aria-current={hubTab === tab ? "page" : undefined}
            onClick={() => {
              setHubTab(tab);
              document.getElementById("group-" + tab)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <a href={photosLink} onClick={() => setHubTab("photos")} className={hubTab === "photos" ? "active" : ""}>
          Photos
        </a>
        <button type="button" onClick={() => { setHubTab("chat"); document.getElementById("group-chat")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={hubTab === "chat" ? "active" : ""}>
          Chat
        </button>
      </nav>
      <div className="notice" id="group-overview">
        <strong>Test payments</strong>
        <p>Test checkout is available for your share. Group totals are not linked yet.</p>
      </div>
      <div className="room-members" id="group-payments">
        {room.members.map((m) => <article className="room-member" key={m.id}>
          <div className="rowtitle">
            <h3>{m.name}{m.isMe ? " (you)" : ""}</h3>
            <strong>{formatZAR(m.shareCents / 100)}</strong>
          </div>
          {m.isMe ? <StripeSandboxCheckout key={m.id} cents={m.shareCents} /> : <p className="muted">Waiting for their checkout.</p>}
        </article>)}
      </div>
      <div id="group-history"><RoomTimeline room={room} /></div>
      {ref && <div id="group-chat"><RoomChat ref={ref} /></div>}
      <div className="photo-album-link">
        <div>
          <h3>Group photos</h3>
          <p className="muted">Share event photos with everyone in this group.</p>
        </div>
        <a className="button secondary" href={photosLink}>Open group photos</a>
      </div>
      {room.owner && ref?.mode === "cloud" && member && !member.isMe && <Button variant="ghost" disabled={busy} onClick={async () => { try { await revokeRoomInvitation(ref, member.id); await refresh(); setMessage("Invitation revoked. Send the new link to invite them again."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not revoke the invitation."); } }}>Revoke selected invitation</Button>}
      <div className="invite">
        <h3>Invite to this group</h3>
        {room.owner && (
          <div className="field">
            <label htmlFor="room-invite-person">Participant link</label>
            <select
              id="room-invite-person"
              value={member?.id || ""}
              onChange={(e) => {
                setSelected(e.target.value);
                setMessage("");
              }}
            >
              {room.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="linkrow">
          <input aria-label="Participant link to share" readOnly value={link} />
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage("Room link copied.");
              } catch {
                setMessage("Select and copy the link manually.");
              }
            }}
          >
            Copy link
          </Button>
          <a
            className="button secondary"
            target="_blank"
            rel="noreferrer"
            href={link}
          >
            Open participant view
          </a>
        </div>
        <p className="muted small">
          Send each link privately.
        </p>
        {qr && (
          <details>
            <summary>Show QR code</summary>
            <img className="qrimage" src={qr} alt="Participant invitation QR" />
          </details>
        )}
        {message && <p role="status">{message}</p>}
      </div>
      {mine && (
        <p className="muted">
          Your contribution in this view: {formatZAR(mine.shareCents / 100)}.
        </p>
      )}
      <div className="actions">
        <a className="button secondary" href="#balances">
          My balances
        </a>
        <a className="button ghost" href="#pay">
          Back to split
        </a>
      </div>
    </section>
  );
}
