import { publicAppUrl } from "../../lib/publicLinks";
import { parseRoom } from "../rooms/rooms";
export function getInviteRoute(raw: string): string | null {
  if (raw.length > 8192) return null;
  try {
    const url = new URL(raw);
    const publicUrl = new URL(publicAppUrl());
    const trusted = [new URL(location.href), publicUrl].some(
      (base) => url.origin === base.origin && url.pathname === base.pathname,
    );
    if (
      !trusted ||
      url.username ||
      url.password ||
      url.search ||
      (url.protocol !== "https:" && url.origin !== location.origin)
    )
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
