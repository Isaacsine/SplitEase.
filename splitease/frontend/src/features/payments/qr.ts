import { parseRoom } from "../rooms/rooms";
export function getInviteRoute(raw: string): string | null {
  if (raw.length > 8192) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.origin !== location.origin)
      return null;
    if (url.origin !== location.origin || url.pathname !== location.pathname)
      return null;
    if (
      (url.hash.startsWith("#room=") && !!parseRoom(url.hash)) ||
      url.hash.startsWith("#join=") ||
      /^#invite=[0-9a-f-]{36}(?:&(?:choice=(?:now|cash|instalments)|count=[34]))*$/i.test(
        url.hash,
      )
    )
      return url.hash;
    return null;
  } catch {
    return null;
  }
}

export function inviteLandingRoute(route: string) {
  return "#invite-landing=" + encodeURIComponent(route);
}
