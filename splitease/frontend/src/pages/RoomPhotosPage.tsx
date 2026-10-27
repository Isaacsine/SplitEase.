import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { listRoomPhotos, uploadRoomPhotos, type RoomPhoto } from "../features/rooms/roomPhotos.api";
import { parseRoom, roomLink } from "../features/rooms/rooms";

function readableSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function RoomPhotosPage({ hash }: { hash: string }) {
  const ref = parseRoom(hash.replace("#room-photos", "#room"));
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<RoomPhoto[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  useEffect(() => { if (!ref) return; let active = true; void listRoomPhotos(ref).then((items) => active && setPhotos(items)).catch((e) => active && setError(e instanceof Error ? e.message : "Could not load photos.")); return () => { active = false; }; }, [hash]);
  if (!ref) return <section className="panel"><h2>Group photos</h2><p className="error">This group photo link is invalid.</p><a className="button secondary" href="#pay">Back to split</a></section>;
  const add = async (files: FileList | null) => { if (!files?.length) return; setBusy(true); setError(""); setMessage(""); try { setPhotos(await uploadRoomPhotos(ref, [...files])); setMessage("Photos added for everyone in this group."); } catch (e) { setError(e instanceof Error ? e.message : "Could not add photos."); } finally { setBusy(false); if (input.current) input.current.value = ""; } };
  return <section className="panel room-photos">
    <div className="rowtitle"><div><span className="pill">Shared group album</span><h2>Group photos</h2></div><a className="button secondary" href={roomLink(ref)}>Back to group</a></div>
    <p className="muted">Add the photos from your meal or event once. Only signed-in people invited to this group can view them.</p>
    <div className="photo-upload"><input ref={input} type="file" accept="image/*" multiple onChange={(e) => void add(e.target.files)} disabled={busy} /><Button disabled={busy} onClick={() => input.current?.click()}>{busy ? "Adding photos..." : "Add photos"}</Button></div>
    {error && <p className="error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {!photos.length ? <div className="empty-state"><h3>No photos yet</h3><p>Be the first person in the group to add one.</p></div> : <div className="photo-grid">{photos.map((photo) => <article className="photo-card" key={photo.id}><img src={photo.url} alt={photo.fileName} loading="lazy" /><div className="photo-card-body"><strong title={photo.fileName}>{photo.fileName}</strong><span className="muted">Added by {photo.uploaderName}</span><small className="muted">{date(photo.createdAt)} · {readableSize(photo.sizeBytes)}</small><a className="button secondary" href={photo.url} download={photo.fileName}>Download photo</a></div></article>)}</div>}
  </section>;
}
