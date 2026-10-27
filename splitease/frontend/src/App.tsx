import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { StripeReturnPage } from "./pages/StripeReturnPage";
import { lazy, Suspense } from "react";
import { UnavailableFeaturePage } from "./pages/UnavailableFeaturePage";
const PlansPage = lazy(() =>
  import("./pages/PlansPage").then((m) => ({ default: m.PlansPage })),
);
const PlanPage = lazy(() =>
  import("./pages/PlanPage").then((m) => ({ default: m.PlanPage })),
);
const LiveRoomPage = lazy(() =>
  import("./pages/LiveRoomPage").then((m) => ({ default: m.LiveRoomPage })),
);
const RoomPhotosPage = lazy(() =>
  import("./pages/RoomPhotosPage").then((m) => ({ default: m.RoomPhotosPage })),
);
const BalancesPage = lazy(() =>
  import("./pages/BalancesPage").then((m) => ({ default: m.BalancesPage })),
);
const ReceiptPage = lazy(() =>
  import("./pages/ReceiptPage").then((m) => ({ default: m.ReceiptPage })),
);
const AccountPage = lazy(() =>
  import("./pages/AccountPage").then((m) => ({ default: m.AccountPage })),
);
import { HelpPage } from "./pages/HelpPage";
import { PaymentReturnPage } from "./pages/PaymentReturnPage";
import { useEffect, useState } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { PayTogetherPage } from "./pages/PayTogetherPage";
import { ActivityPage } from "./pages/ActivityPage";
import { JoinShopPage } from "./pages/JoinShopPage";
import { ScanToPayPage } from "./pages/ScanToPayPage";
import { InviteLandingPage } from "./pages/InviteLandingPage";
export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const read = () => setHash(location.hash);
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return (
    <AppLayout activity={hash === "#activity"}>
      <ErrorBoundary key={hash}><Suspense fallback={<p role="status">Loading...</p>}>
        {hash === "#help" ? (
          <HelpPage />
        ) : hash === "#account" ? (
          <AccountPage />
        ) : hash === "#wallet" ? (
          <UnavailableFeaturePage />
        ) : hash === "#plans" ? (
          <PlansPage />
        ) : hash.startsWith("#plan=") ? (
          <PlanPage key={hash} hash={hash} />
        ) : hash.startsWith("#room-photos=") ? (
          <RoomPhotosPage key={hash} hash={hash} />
        ) : hash.startsWith("#room=") ? (
          <LiveRoomPage key={hash} hash={hash} />
        ) : hash === "#balances" ? (
          <BalancesPage />
        ) : hash === "#receipt" ? (
          <ReceiptPage />
        ) : hash.startsWith("#stripe-return=") ? (
          <StripeReturnPage key={hash} hash={hash} />
        ) : hash.startsWith("#payment-return=") ? (
          <PaymentReturnPage key={hash} hash={hash} />
        ) : hash === "#activity" ? (
          <ActivityPage />
        ) : hash === "#scan" ? (
          <ScanToPayPage />
        ) : hash === "#scan-invite" ? (
          <ScanToPayPage mode="invite" />
        ) : hash.startsWith("#invite-landing=") ? (
          <InviteLandingPage encoded={hash.slice(16)} />
        ) : hash.startsWith("#join=") || hash.startsWith("#invite=") ? (
          <JoinShopPage key={hash} hash={hash} />
        ) : (
          <PayTogetherPage />
        )}
      </Suspense></ErrorBoundary>
    </AppLayout>
  );
}
