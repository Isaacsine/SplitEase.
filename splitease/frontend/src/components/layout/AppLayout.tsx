import type { ReactNode } from "react";
import { Header } from "./Header";
const flowSteps = ["Add the expense", "Add people", "Choose the split", "Share invites", "Track payments"] as const;
export function AppLayout({
  children,
  activity = false,
}: {
  children: ReactNode;
  activity?: boolean;
}) {
  const home = !location.hash || location.hash === "#pay";
  return (
    <>
      <Header activity={activity} />
      <main className="wrap">
        <div className="prototype-strip">
          <span className="status-dot" />
          Prototype - no real payments
        </div>
        {home && (
          <div className="workspace-heading">
            <div>
              <p className="workspace-kicker">EXPENSES</p>
              <h1>New split</h1>
              <p className="muted">
                Add the bill. Bring your people. Share the cost.
              </p>
            </div>
            <a className="button secondary" href="#scan">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h3v3H8zm6 0h2v3h-2zm-6 6h3v2H8zm6 0h2v2h-2z" />
              </svg>
              Scan a QR code
            </a>
            <a className="button ghost" href="#scan-invite">
              Scan to invite
            </a>
            <section className="flow-guide" aria-label="How SplitEase works">
              <div className="flow-guide-heading">
                <span className="flow-guide-icon" aria-hidden="true">✓</span>
                <div>
                  <strong>How it works</strong>
                  <small>Get from bill to shared payment in five simple steps.</small>
                </div>
              </div>
              <ol className="flow-steps">
                {flowSteps.map((step, index) => (
                  <li key={step}>
                    <span className="flow-step-number">{String(index + 1).padStart(2, "0")}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {/*
            <strong>How it works</strong>
            <span>Add the expense</span>
            <span aria-hidden="true">→</span>
            <span>Add people</span>
            <span aria-hidden="true">→</span>
            <span>Choose the split</span>
            <span aria-hidden="true">→</span>
            <span>Share invites</span>
            <span aria-hidden="true">→</span>
            <span>Track payments</span>
            */}
            </section>
          </div>
        )}
        {children}
      </main>
    </>
  );
}
