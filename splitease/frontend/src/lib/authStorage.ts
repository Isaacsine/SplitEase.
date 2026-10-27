const preferenceKey = "splitease-keep-signed-in";
const memory = new Map<string, string>();
const seen = new Set<string>();
export function keepsSignedIn() {
  try {
    return localStorage.getItem(preferenceKey) !== "false";
  } catch {
    return true;
  }
}
export function setKeepSignedIn(value: boolean) {
  const from = keepsSignedIn() ? localStorage : sessionStorage,
    to = value ? localStorage : sessionStorage;
  for (const key of seen) {
    const item = from.getItem(key);
    if (item !== null) to.setItem(key, item);
  }
  localStorage.setItem(preferenceKey, String(value));
  if (from !== to) for (const key of seen) from.removeItem(key);
}
export const authStorage = {
  getItem(key: string) {
    seen.add(key);
    try {
      return (keepsSignedIn() ? localStorage : sessionStorage).getItem(key);
    } catch {
      return memory.get(key) || null;
    }
  },
  setItem(key: string, value: string) {
    seen.add(key);
    try {
      (keepsSignedIn() ? localStorage : sessionStorage).setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem(key: string) {
    seen.add(key);
    memory.delete(key);
    for (const getStore of [() => localStorage, () => sessionStorage])
      try {
        getStore().removeItem(key);
      } catch {}
  },
};
