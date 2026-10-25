import { useCallback, useEffect, useRef, useState } from "react";
import {
  readRoom,
  joinRoom,
  subscribeRoom,
  updateRoom,
  completeRoom,
  broadcastRoom,
} from "./rooms.api";
import {
  rememberRoom,
  type Room,
  type RoomRef,
  type RoomAction,
} from "./rooms";
import type { PaymentChoice, InstalmentCount } from "../payments/paymentPlans";
export function useRoom(ref: RoomRef | null) {
  const [room, setRoom] = useState<Room | null>(null),
    [error, setError] = useState(""),
    [connection, setConnection] = useState("Connecting..."),
    [busy, setBusy] = useState(false);
  const mounted = useRef(true),
    sequence = useRef(0);
  const key = ref?.key,
    mode = ref?.mode,
    seat = ref?.seat;
  const refresh = useCallback(async () => {
    if (!ref) return;
    const seq = ++sequence.current;
    try {
      const room = await readRoom(ref);
      if (mounted.current && seq === sequence.current) {
        setRoom(room);
        setError("");
      }
    } catch (e) {
      if (mounted.current && seq === sequence.current)
        setError(e instanceof Error ? e.message : "Could not load room.");
    }
  }, [key, mode, seat]);
  useEffect(() => {
    mounted.current = true;
    setRoom(null);
    if (!ref) {
      setError("This room link is invalid.");
      return;
    }
    rememberRoom(ref);
    void joinRoom(ref)
      .then(refresh)
      .catch(() => void refresh());
    const stop = subscribeRoom(ref, () => void refresh(), setConnection);
    return () => {
      mounted.current = false;
      sequence.current++;
      stop();
    };
  }, [refresh]);
  async function act(
    id: string,
    action: RoomAction,
    choice: PaymentChoice = "now",
    count: InstalmentCount = 3,
  ) {
    if (!ref || busy) return;
    setBusy(true);
    try {
      sequence.current++;
      const next = await updateRoom(ref, id, action, choice, count);
      if (mounted.current) {
        setRoom(next);
        setError("");
      }
      await broadcastRoom(ref);
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Could not save choice.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function complete() {
    if (!ref) return false;
    setBusy(true);
    try {
      const next = await completeRoom(ref);
      setRoom(next);
      setError("");
      await broadcastRoom(ref);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete split.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { room, error, connection, busy, refresh, act, complete };
}
