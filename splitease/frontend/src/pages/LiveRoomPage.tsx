import { WalletPayment } from "../features/wallet/WalletPayment";
import { RoomTimeline, nextStep } from "../features/rooms/RoomTimeline";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  parseRoom,
  roomCoverage,
  roomLink,
  memberBalance,
  type RoomMember,
} from "../features/rooms/rooms";
import { useRoom } from "../features/rooms/useRoom";
import { RoomChat } from "../features/rooms/RoomChat";
import { Button } from "../components/ui/Button";
import { useShop } from "../features/shops/useShop";
import { formatZAR } from "../lib/money";
import {
  paymentLabels,
  displayDate,
  type PaymentChoice,
  type InstalmentCount,
} from "../features/payments/paymentPlans";
const labels = {
  pending: "Pending",
  cash_declared: "Cash awaiting organiser",
  covered: "Covered",
  credit_funded: "Covered by instalments",
  declined: "Declined",
};
export function LiveRoomPage({ hash }: { hash: string }) {
  const ref = parseRoom(hash);
  const { room, error, connection, busy, refresh, act, complete } =
    useRoom(ref);
  const { reset } = useShop();
  const [selected, setSelected] = useState(""),
    [qr, setQr] = useState(""),
    [message, setMessage] = useState(""),
    [completionMessage, setCompletionMessage] = useState(""),
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
  const coverage = roomCoverage(room);
  const mine = room.members.find((m) => m.isMe);
  const guided = room.mode === "demo";
  const action = (m: RoomMember, type: Parameters<typeof act>[1]) =>
    void act(m.id, type, m.choice, m.count);
  const completeSplit = async () => {
    const completed = await complete();
    if (completed) {
      reset();
      setCompletionMessage(
        "This split is saved in group history. Expense details have been cleared for your next split.",
      );
    }
  };
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
      <div className="coverage-card" id="group-overview">
        <div className="coverage-total">
          <strong>
            {formatZAR(coverage.covered / 100)} of{" "}
            {formatZAR(room.totalCents / 100)} covered
          </strong>
          <span>{coverage.percent}%</span>
        </div>
        <progress
          max={room.totalCents}
          value={coverage.covered}
          aria-label="Bill coverage"
        />
        <p className="muted">
          {formatZAR(coverage.pending / 100)} pending{" "}
          {room.completed ? " - bill completed in simulation" : ""}
        </p>
      </div>
      <div className="payment-disclosure">
        <strong>Payment preview</strong>
        <p>
          Contributions and repayment plans are simulated. No money moves and no
          credit is issued.
        </p>
      </div>
      {room.completed && (
        <div
          className="completion-card"
          role="region"
          aria-label="Split outcome"
        >
          <span className="pill">Split complete</span>
          <h3>{formatZAR(room.totalCents / 100)} covered together</h3>
          <p>
            {new Set(room.members.map((m) => m.choice)).size} payment choices;{" "}
            {
              room.members.filter(
                (m) => m.state === "credit_funded" && m.repaid < m.count,
              ).length
            }{" "}
            repayment plans still active.
          </p>
          <p className="muted">
            A future approved provider would fund an instalment share upfront.
            SplitEase does not issue credit or move money.
          </p>
          {completionMessage && <p role="status">{completionMessage}</p>}
        </div>
      )}
      <div className="room-members" id="group-payments">
        {room.members.map((m) => {
          const canEdit = room.owner || m.isMe;
          const balance = memberBalance(m, room.createdAt.slice(0, 10));
          return (
            <article className="room-member" key={m.id}>
              <div className="rowtitle">
                <div>
                  <h3>
                    {m.name}
                    {m.isMe ? " (you)" : ""}
                  </h3>
                  <span className="muted">{formatZAR(m.shareCents / 100)}</span>
                </div>
                <span className="pill">{labels[m.state]}</span>
              </div>
              {(m.isMe || room.owner) && (
                <p className="next-step">
                  <strong>Next step: </strong>
                  {nextStep(m, room)}
                </p>
              )}
              <div className="grid">
                <div className="field">
                  <label htmlFor={"choice-" + m.id}>Payment choice</label>
                  <select
                    id={"choice-" + m.id}
                    aria-label={m.name + " room payment choice"}
                    value={m.choice}
                    disabled={!canEdit || busy || room.completed}
                    onChange={(e) =>
                      void act(
                        m.id,
                        "method",
                        e.target.value as PaymentChoice,
                        m.count,
                      )
                    }
                  >
                    {Object.entries(paymentLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {m.choice === "instalments" && (
                  <div className="field">
                    <label htmlFor={"count-" + m.id}>Illustrative plan</label>
                    <select
                      id={"count-" + m.id}
                      value={m.count}
                      disabled={!canEdit || busy || room.completed}
                      onChange={(e) =>
                        void act(
                          m.id,
                          "method",
                          "instalments",
                          Number(e.target.value) as InstalmentCount,
                        )
                      }
                    >
                      <option value={3}>3 monthly repayments</option>
                      <option value={4}>4 monthly repayments</option>
                    </select>
                  </div>
                )}
              </div>
              {m.state === "credit_funded" && (
                <p className="muted">
                  Remaining illustrative credit:{" "}
                  <strong>{formatZAR(balance.remaining / 100)}</strong> -{" "}
                  {m.repaid}/{m.count} repayments previewed.
                </p>
              )}
              {m.isMe &&
                ref &&
                !room.completed &&
                m.choice === "now" &&
                !["covered", "credit_funded"].includes(m.state) && (
                  <WalletPayment
                    target={{ kind: "room", ref, item: m.id }}
                    cents={m.shareCents}
                    disabled={busy}
                    onPaid={refresh}
                    onBank={() => act(m.id, "pay", m.choice, m.count)}
                  />
                )}
              <div className="actions">
                {canEdit &&
                  !room.completed &&
                  m.state !== "covered" &&
                  m.state !== "credit_funded" && (
                    <>
                      <Button
                        disabled={
                          busy ||
                          (m.choice === "instalments" && !balance.plan.length)
                        }
                        onClick={() =>
                          action(
                            m,
                            m.choice === "instalments" ? "credit" : "pay",
                          )
                        }
                      >
                        {m.choice === "instalments"
                          ? "Use instalments for "
                          : m.choice === "cash"
                            ? "Declare cash for "
                            : "Record contribution for "}
                        {m.name}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => action(m, "decline")}
                      >
                        Decline contribution for {m.name}
                      </Button>
                    </>
                  )}
                {room.owner &&
                  !room.completed &&
                  m.choice === "cash" &&
                  m.state !== "covered" && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => action(m, "cash")}
                    >
                      Confirm cash from {m.name}
                    </Button>
                  )}
                {canEdit &&
                  m.state === "credit_funded" &&
                  m.repaid < m.count && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => action(m, "repay")}
                    >
                      Record repayment for {m.name}
                    </Button>
                  )}
                {canEdit && !room.completed && m.state !== "pending" && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => action(m, "reset")}
                  >
                    Reset {m.name} contribution
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {room.owner && (
        <Button
          disabled={busy || room.completed || coverage.pending > 0}
          onClick={() => void completeSplit()}
        >
          {room.completed ? "Split completed" : "Complete split"}
        </Button>
      )}
      <div id="group-history"><RoomTimeline room={room} /></div>
      {ref && <div id="group-chat"><RoomChat ref={ref} /></div>}
      <div className="photo-album-link">
        <div>
          <h3>Group photos</h3>
          <p className="muted">Share event photos with everyone in this group.</p>
        </div>
        <a className="button secondary" href={photosLink}>Open group photos</a>
      </div>
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
          A participant link can change only that person's simulated choices.
          Cash receipt still needs the organiser. Keep edit links with their
          intended recipient.
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
