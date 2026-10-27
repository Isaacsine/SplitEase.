// Scope app-owned data to the signed-in account. Auth tokens use authStorage separately.
let accountId: string | null = null;
let guestId = "";
let adoptedDraftScope: string | null = null;
export function isAdoptedDraft() {
  return adoptedDraftScope === privateScope();
}
const listeners = new Set<() => void>();
function guest() {
  if (guestId) return guestId;
  try {
    guestId = localStorage.getItem("splitease-guest-id") || crypto.randomUUID();
    localStorage.setItem("splitease-guest-id", guestId);
  } catch {
    guestId = crypto.randomUUID();
  }
  return guestId;
}
export function privateScope() {
  return accountId ? `user:${accountId}` : `guest:${guest()}`;
}
export function subscribePrivateScope(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function scoped(key: string, scope = privateScope()) {
  return `splitease:${scope}:${key}`;
}
export function setPrivateAccount(id: string | null, adoptDraft = false) {
  if (id === accountId) return;
  const previous = privateScope();
  if (!id && accountId) {
    guestId = crypto.randomUUID();
    try {
      localStorage.setItem("splitease-guest-id", guestId);
    } catch {
      /* In-memory guest session remains isolated. */
    }
  }
  accountId = id;
  adoptedDraftScope = null;
  // A deliberate sign-in can save the current guest split, never another account's data.
  if (id && adoptDraft && previous.startsWith("guest:")) {
    try {
      const draft = localStorage.getItem(
        scoped("splitease-draft-v2", previous),
      );
      const target = scoped("splitease-draft-v2");
      if (draft && !localStorage.getItem(target)) {
        localStorage.setItem(target, draft);
        adoptedDraftScope = privateScope();
      }
    } catch {
      /* Storage errors are reported by the draft UI. */
    }
  }
  listeners.forEach((listener) => listener());
}
function store(session: boolean) {
  return {
    getItem(key: string) {
      return (session ? sessionStorage : localStorage).getItem(scoped(key));
    },
    setItem(key: string, value: string) {
      (session ? sessionStorage : localStorage).setItem(scoped(key), value);
    },
    removeItem(key: string) {
      (session ? sessionStorage : localStorage).removeItem(scoped(key));
    },
  };
}
export const privateLocal = store(false);
export const privateSession = store(true);
export function assertPrivateScope(scope: string) {
  if (scope !== privateScope())
    throw new Error("Your account changed. Please try again.");
}

// These records came only from the retired simulator. Keep groups, files and accounts.
export function clearRetiredTestData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (
        key === "splitease-wallet-v1" ||
        key.endsWith(":splitease-wallet-v1")
      ) {
        localStorage.removeItem(key);
        continue;
      }
      if (
        key === "splitease-demo-rooms-v1" ||
        key.endsWith(":splitease-demo-rooms-v1")
      ) {
        const rooms = JSON.parse(localStorage.getItem(key) || "{}");
        for (const room of Object.values(rooms) as Array<{
          completed: boolean;
          members: Array<{ state: string; repaid: number }>;
          events?: Array<{ action: string }>;
        }>) {
          room.completed = false;
          room.members.forEach((member) => {
            member.state = "pending";
            member.repaid = 0;
          });
          room.events = room.events?.filter((event) =>
            ["created", "joined", "method"].includes(event.action),
          );
        }
        localStorage.setItem(key, JSON.stringify(rooms));
      }
    }
  } catch {
    /* A blocked or corrupt legacy store must not prevent sign-in. */
  }
}
