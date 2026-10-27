import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getInviteRoute, inviteLandingRoute } from "../features/payments/qr";
export function ScanToPayPage({
  mode = "pay",
}: {
  mode?: "pay" | "invite";
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const [running, setRunning] = useState(false),
    [busy, setBusy] = useState(false),
    [raw, setRaw] = useState(""),
    [scanned, setScanned] = useState(""),
    [error, setError] = useState("");
  function stop() {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    setRunning(false);
  }
  useEffect(
    () => () => {
      generation.current++;
      controls.current?.stop();
      const stream = video.current?.srcObject;
      if (stream instanceof MediaStream)
        stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  function read(value: string) {
    stop();
    setScanned(value.slice(0, 8192));
    setError("");
  }
  async function camera() {
    stop();
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Camera access needs HTTPS or localhost. Upload a QR image instead.",
        );
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        video.current!,
        (result, _error, scanner) => {
          if (result && generation.current === current) {
            scanner.stop();
            read(result.getText());
          }
        },
      );
      if (generation.current !== current) result.stop();
      else {
        controls.current = result;
        setRunning(true);
      }
    } catch (e) {
      if (generation.current === current)
        setError(
          e instanceof Error
            ? e.message
            : "Camera access failed. You can upload a QR image or paste a link.",
        );
    } finally {
      if (generation.current === current) setBusy(false);
      else setBusy(false);
    }
  }
  async function image(file: File) {
    stop();
    if (file.size > 10 * 1024 * 1024)
      return setError("Choose an image smaller than 10 MB.");
    setError("");
    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 25000000) throw Error("Image dimensions are too large.");
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      read(result.getText());
    } catch {
      setError("No readable QR code was found. Try a clearer image.");
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  }
  const route = scanned ? getInviteRoute(scanned) : null;
  const inviteMode = mode === "invite";
  const inviteRoute =
    route && inviteMode ? inviteLandingRoute(route) : route;
  const isGroup = route?.startsWith("#room=");
  return (
    <section className="panel">
      <h2>{inviteMode ? "Scan to invite" : "Scan to pay"}</h2>
      <p className="muted">
        {inviteMode
          ? "Scan a SplitEase invitation."
          : "Scan a SplitEase QR code or upload an image."}
      </p>
      <div className="scanner">
        <video
          ref={video}
          muted
          playsInline
          autoPlay
          className={running ? "" : "idle"}
        />
        {!running && (
          <div className="scanplaceholder">
            <span aria-hidden="true">&#9638;</span>
            <strong>Point your camera at a QR code</strong>
            <small>
              Choose Start camera when ready.
            </small>
          </div>
        )}
      </div>
      <div className="actions">
        <Button disabled={busy} onClick={running ? stop : camera}>
          {busy ? "Opening..." : running ? "Stop camera" : "Start camera"}
        </Button>
        <label className="button secondary upload">
          Upload QR image
          <input
            type="file"
            accept="image/*"
            aria-label="Upload QR image"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.[0]) void image(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          read(raw);
        }}
      >
        <Input
          label="Or paste a payment link or QR content"
          value={raw}
          maxLength={8192}
          required
          onChange={(e) => setRaw(e.target.value)}
          placeholder="https://..."
        />
        <Button variant="secondary" type="submit" disabled={busy}>
          Read payment request
        </Button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {scanned && (
        <div className="notice">
          <strong>
            {route ? "SplitEase request detected" : "QR code detected"}
          </strong>
          {route ? (
            <>
              <p>
                {inviteMode
                  ? "This invitation will open a web landing page where the recipient can accept or decline it."
                  : isGroup
                  ? "This is a group invitation. Open the shared room to choose your contribution and see the group timeline."
                  : "This is an individual invitation. Review your share and payment choice before continuing."}
              </p>
              <Button
                aria-label="Review request"
                onClick={() => {
                  location.hash = inviteRoute!;
                }}
              >
                {inviteMode
                  ? "Open invitation landing page"
                  : isGroup
                    ? "Open group room"
                    : "Review your share"}
              </Button>
            </>
          ) : (
            <>
              <p>
                This code is not a supported SplitEase request. Try an invitation QR.
              </p>
              <details>
                <summary>Show scanned content</summary>
                <pre className="qr-content">{scanned}</pre>
              </details>
            </>
          )}
        </div>
      )}
      <p className="muted small">
        Scanning reads a request only. It does not debit your bank account.
        {inviteMode
          ? " Recipients can continue in their browser without installing the app."
          : " Bank payment processing needs a real provider connection."}
      </p>
      <a className="button ghost" href={inviteMode ? "#scan" : "#scan-invite"}>
        {inviteMode ? "Scan to pay instead" : "Scan to invite instead"}
      </a>
    </section>
  );
}
