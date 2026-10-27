import { ShopProvider } from "../../features/shops/useShop";
import { privateScope, subscribePrivateScope } from "../../lib/privateStorage";
import { useSyncExternalStore, type ReactNode } from "react";
import { Header } from "./Header";
export function AppLayout({
  children,
}: {
  children: ReactNode;
  activity?: boolean;
}) {
  const scope = useSyncExternalStore(subscribePrivateScope, privateScope, privateScope);
  const home = !location.hash || location.hash === "#pay";
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="wrap" tabIndex={-1}>
        <div className="page-utility">
          <a
            className="payment-mode"
            href="#help"
            aria-label="Payment environment"
          >
            <span className="status-dot" />
            Test payments
          </a>
        </div>
        {home && (
          <div className="workspace-heading home-heading">
            <div>
              <p className="workspace-kicker">TOGETHER, EASIER</p>
              <h1>Good times. Fair shares.</h1>
              <p className="muted">Add a bill. Invite your people.</p>
            </div>
            <a className="button ghost help-shortcut" href="#help">
              How it works <span aria-hidden="true">&#8599;</span>
            </a>
          </div>
        )}
        <ShopProvider key={scope}>{children}</ShopProvider>
      </main>
    </>
  );
}
