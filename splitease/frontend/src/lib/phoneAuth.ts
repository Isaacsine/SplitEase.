// Device eligibility is a UI restriction, not a security boundary. Screen width
// alone would incorrectly offer phone sign-in on a narrow laptop window.
export async function supportsPhonePasskeys(): Promise<boolean> {
  const phone = /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent);
  if (!phone || !window.isSecureContext || !window.PublicKeyCredential ||
      !navigator.credentials?.create || !navigator.credentials?.get) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function phoneAuthError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if ((error instanceof Error && ["NotAllowedError", "AbortError"].includes(error.name)) ||
      /CANCEL|ABORT|NOT_ALLOWED/i.test(code)) {
    return "Phone verification was cancelled or timed out. Try again, or use Google or your password.";
  }
  return error instanceof Error ? error.message : "Could not verify your phone. Try Google or your password.";
}
