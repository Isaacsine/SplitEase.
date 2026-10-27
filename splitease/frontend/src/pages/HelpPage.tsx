const supportEmail = "sinethembankosi70@gmail.com";
const supportWhatsApp = "27726816869";
const questions = [
  ["Who can see my information?", "Your signed-in account is private. Sending an invitation shares its name and amount. Shared groups show names, shares, chat and photos only to the organiser and signed-in people who accepted their own invitation. Opening a shared group invitation while signed in links that seat to your account. There is no public profile directory."],
  ["What about a shared device?", "Sign out when finished. Account data is separated in this app. Guest drafts belong to this browser, so sign in before keeping private information on a shared device."],

  [
    "How do I split a bill?",
    "Add a name and total, add your people, then share their invitation links. Choose equal shares, amounts or percentages.",
  ],
  [
    "How do I pay?",
    "Open your invitation, sign in and choose Pay now. Stripe handles checkout. We currently use test payments: no real money moves.",
  ],
  [
    "Which card should I use?",
    "For a successful test, use 4242 4242 4242 4242, any future expiry and any three-digit CVC. Never use real card details for testing.",
  ],
  [
    "Why hasn't the group balance changed?",
    "Your Stripe receipt confirms a test payment. Group balances are not connected to those receipts yet.",
  ],
  [
    "How do monthly plans work?",
    "Agree on each person's amount and track payments manually. The organiser confirms receipt. SplitEase does not collect automatically, hold a savings pot or send payouts.",
  ],
  [
    "Can I use my phone's fingerprint?",
    "Sign in with Google or email first. On a supported phone, open Account and enable phone sign-in. Your phone may use a fingerprint, Face ID or its screen lock.",
  ],
  [
    "Can I scan any QR code?",
    "Scan a SplitEase invitation, upload its QR image or paste its link. Review the name and amount before continuing.",
  ],
  [
    "What if a payment fails?",
    "Check your connection and retry checkout. If a receipt is pending, choose Check payment status. Contact us if the problem continues.",
  ],
];
export function HelpPage() {
  return (
    <section className="help-page">
      <div className="workspace-heading">
        <div>
          <p className="workspace-kicker">A LITTLE GUIDANCE</p>
          <h1>Here to help.</h1>
          <p className="muted">
            Quick answers. A real person when you need one.
          </p>
        </div>
      </div>
      <div className="help-grid">
        <section className="panel help-guide">
          <h2>Split in three steps</h2>
          <ol className="help-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Add your bill</strong>
                <p>Name it. Set the total.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Invite your people</strong>
                <p>Choose shares. Send a link.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Pay your share</strong>
                <p>Open the link. Continue to Stripe.</p>
              </div>
            </li>
          </ol>
          <a className="button primary" href="#pay">
            Start a split
          </a>
        </section>
        <section className="panel help-contact">
          <span className="pill">LET'S TALK</span>
          <h2>Need a hand?</h2>
          <p>Send your split name and what went wrong.</p>
          <a
            className="button primary"
            href={`https://wa.me/${supportWhatsApp}?text=${encodeURIComponent("Hi SplitEase, I need help with my split.")}`}
            target="_blank"
            rel="noreferrer"
          >
            Chat on WhatsApp
          </a>
          <a
            className="button secondary"
            href={`mailto:${supportEmail}?subject=SplitEase%20help`}
          >
            Email support
          </a>
          <address>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            <a href={`tel:+${supportWhatsApp}`}>072 681 6869</a>
          </address>
          <small className="muted">
            Keep passwords, API keys and card details private.
          </small>
        </section>
      </div>
      <section className="panel help-answers">
        <h2>Quick answers</h2>
        {questions.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
    </section>
  );
}
