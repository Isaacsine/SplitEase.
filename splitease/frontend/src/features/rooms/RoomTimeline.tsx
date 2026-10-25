import type { Room, RoomEvent, RoomMember } from "./rooms";
import { memberBalance } from "./rooms";
import { formatZAR } from "../../lib/money";
import { paymentLabels, displayDate } from "../payments/paymentPlans";
function describe(event: RoomEvent, room: Room) {
  const name =
    room.members.find((m) => m.id === event.memberId)?.name || "Participant";
  switch (event.action) {
    case "created":
      return "Organiser created the room.";
    case "joined":
      return name + " joined through their participant link.";
    case "method":
      return (
        event.actor +
        " changed " +
        name +
        "'s choice to " +
        paymentLabels[event.choice || "now"] +
        "."
      );
    case "pay":
      return event.choice === "cash"
        ? event.actor +
            " declared cash for " +
            name +
            "; awaiting organiser confirmation."
        : event.actor + " previewed paying now for " + name + " (simulation).";
    case "cash":
      return "Organiser confirmed cash from " + name + " (simulation).";
    case "credit":
      return (
        event.actor + " previewed credit funding for " + name + " (simulation)."
      );
    case "repay":
      return (
        event.actor + " previewed a repayment for " + name + " (simulation)."
      );
    case "decline":
      return (
        event.actor +
        " declined the contribution for " +
        name +
        " (simulation)."
      );
    case "reset":
      return event.actor + " reset " + name + "'s preview.";
    case "completed":
      return "Organiser completed the split (simulation).";
  }
}
export function nextStep(m: RoomMember, room: Room) {
  if (m.state === "cash_declared")
    return room.owner
      ? "Confirm cash receipt after receiving it (simulation)."
      : "Waiting for cash confirmation from the organiser.";
  if (m.state === "covered") return "This share is covered in simulation.";
  if (m.state === "credit_funded") {
    const b = memberBalance(m, room.createdAt.slice(0, 10)),
      next = b.plan[m.repaid];
    return next && m.isMe
      ? "Next repayment: " +
          formatZAR(next.amount) +
          " on " +
          displayDate(next.due) +
          " (simulation)."
      : next
        ? "Share covered; repayment preview remains available in the personal view."
        : "Share covered; all repayments previewed.";
  }
  if (m.state === "declined")
    return "Choose another payment method or retry your simulated contribution.";
  return m.choice === "cash"
    ? "Declare the cash contribution, then wait for organiser confirmation."
    : m.choice === "instalments"
      ? "Review the illustrative plan, then preview credit funding."
      : "Choose your payment method, then preview your contribution.";
}
export function RoomTimeline({ room }: { room: Room }) {
  return (
    <section className="room-timeline" aria-label="Group activity timeline">
      <h3>Group activity</h3>
      <p className="muted small">
        Recent changes from your group. Times shown in South Africa. This
        history is read-only.
      </p>
      {room.events === undefined && room.mode === "cloud" && (
        <p className="notice">
          Activity history is not available for this group yet.
        </p>
      )}
      <ol>
        {(room.events || []).map((e) => (
          <li key={e.id}>
            <p>{describe(e, room)}</p>
            <time dateTime={e.createdAt}>
              {new Intl.DateTimeFormat("en-ZA", {
                dateStyle: "medium",
                timeStyle: "medium",
                timeZone: "Africa/Johannesburg",
              }).format(new Date(e.createdAt))}
            </time>
          </li>
        ))}
      </ol>
      {room.events?.length === 0 && <p className="muted">No activity yet.</p>}
    </section>
  );
}
