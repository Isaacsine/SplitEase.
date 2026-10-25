import { JoinShopPage } from "./JoinShopPage";
import { parseRoom } from "../features/rooms/rooms";

export function InviteLandingPage({ encoded }: { encoded: string }) {
  let route = "";
  try {
    route = decodeURIComponent(encoded);
  } catch {
    route = "";
  }
  if (route.startsWith("#join=") || route.startsWith("#invite="))
    return <JoinShopPage hash={route} landing />;
  const room = parseRoom(route);
  if (!room)
    return (
      <section className="panel">
        <h2>This invitation is unavailable.</h2>
        <a href="#pay">Create your own split</a>
      </section>
    );
  return (
    <section className="panel invite-landing">
      <span className="pill">Group invitation</span>
      <h2>Join this SplitEase group?</h2>
      <p className="muted">
        Open the shared group in your browser to review your contribution and
        choose how you want to pay.
      </p>
      <div className="actions">
        <button className="button primary" onClick={() => (location.hash = route)}>
          Accept invitation
        </button>
        <button
          className="button ghost"
          onClick={() => {
            sessionStorage.setItem("splitease-invite-return", location.hash);
            location.hash = "#account";
          }}
        >
          Sign in to continue
        </button>
        <a className="button secondary" href="#pay">
          Decline
        </a>
      </div>
    </section>
  );
}
