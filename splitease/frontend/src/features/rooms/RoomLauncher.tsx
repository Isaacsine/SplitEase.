import { useState } from "react";
import { useShop } from "../shops/useShop";
import { createLiveRoom } from "./rooms.api";
import { roomLink } from "./rooms";
import { Button } from "../../components/ui/Button";
export function RoomLauncher() {
  const { shop } = useShop();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function create() {
    setBusy(true);
    setError("");
    try {
      const ref = await createLiveRoom(shop);
      location.hash = roomLink(ref).split("#")[1];
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create group.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="group-launcher" aria-label="Shared group">
      <h3>Keep everyone together</h3>
      <p className="muted">
        Shares, chat and photos in one place.
      </p>
      <Button aria-label="Create group" disabled={busy} onClick={create}>
        {busy ? "Creating shared group..." : "Create shared group"}
      </Button>
      <p className="launcher-note">Sign in to share a group across devices.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
