import { privateClient } from "../../lib/privateCloud";
import { assertPrivateScope, privateScope } from "../../lib/privateStorage";
import { privateRpc } from "../../lib/privateCloud";
import { privateLocal } from "../../lib/privateStorage";
import { supabase } from "../../lib/supabase";
import { readRoom } from "./rooms.api";
import type { RoomRef } from "./rooms";

export type RoomPhoto = {
  id: string;
  uploaderName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
};

const localKey = "splitease-room-photos-v1";
type StoredPhoto = RoomPhoto & { dataUrl: string; roomKey: string };
function readLocal(): StoredPhoto[] {
  try {
    return JSON.parse(privateLocal.getItem(localKey) || "[]") as StoredPhoto[];
  } catch {
    return [];
  }
}
function writeLocal(photos: StoredPhoto[]) {
  privateLocal.setItem(localKey, JSON.stringify(photos));
}

export async function listRoomPhotos(ref: RoomRef): Promise<RoomPhoto[]> {
  if (ref.mode === "demo")
    return readLocal()
      .filter((photo) => photo.roomKey === ref.key)
      .map(({ dataUrl: url, ...photo }) => ({ ...photo, url }));
  if (!supabase) throw Error("Supabase is not configured.");
  const scope = privateScope();
  await readRoom(ref);
  assertPrivateScope(scope);
  const { data, error } = await privateRpc("list_group_room_photos", {
    p_room_token: ref.key,
    p_member_token: ref.seat || null,
  });
  if (error)
    throw Error(
      "Could not load group photos. Apply the group-photo migration first.",
    );
  const photos = (data || []) as Array<
    Omit<RoomPhoto, "url"> & { storagePath: string }
  >;
  if (!photos.length) return [];
  const { client } = await privateClient();
  assertPrivateScope(scope);
  const { data: signed, error: signingError } = await client.storage
    .from("group-photos")
    .createSignedUrls(
      photos.map((photo) => photo.storagePath),
      300,
    );
  assertPrivateScope(scope);
  if (
    signingError ||
    !signed ||
    signed.length !== photos.length ||
    signed.some((item) => item.error || !item.signedUrl)
  )
    throw Error(
      "Could not authorize these photos. Check the privacy migration.",
    );
  return photos.map((photo, index) => ({
    ...photo,
    url: signed[index].signedUrl!,
  }));
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("Could not read this photo."));
    reader.readAsDataURL(file);
  });
}

export async function uploadRoomPhotos(
  ref: RoomRef,
  files: File[],
): Promise<RoomPhoto[]> {
  const scope = privateScope();
  if (!files.length) return listRoomPhotos(ref);
  const room = await readRoom(ref);
  assertPrivateScope(scope);
  const valid = files.filter(
    (file) =>
      file.type.startsWith("image/") &&
      file.size > 0 &&
      file.size <= 10 * 1024 * 1024,
  );
  if (valid.length !== files.length)
    throw Error("Only image files up to 10 MB can be added.");
  if (ref.mode === "demo") {
    const existing = readLocal();
    for (const file of valid)
      existing.push({
        id: crypto.randomUUID(),
        roomKey: ref.key,
        uploaderName:
          room.members.find((member) => member.isMe)?.name || "Organiser",
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
        url: "",
        dataUrl: await readFile(file),
      });
    assertPrivateScope(scope);
    writeLocal(existing);
    return listRoomPhotos(ref);
  }
  if (!supabase) throw Error("Supabase is not configured.");
  const { client } = await privateClient();
  assertPrivateScope(scope);
  for (const file of valid) {
    assertPrivateScope(scope);
    const path = `${ref.key}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await client.storage
      .from("group-photos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw Error("Could not upload " + file.name + ".");
    assertPrivateScope(scope);
    const { error } = await privateRpc("add_group_room_photo", {
      p_room_token: ref.key,
      p_member_token: ref.seat || null,
      p_file_name: file.name,
      p_storage_path: path,
      p_mime_type: file.type,
      p_size_bytes: file.size,
    });
    if (error) {
      await client.storage.from("group-photos").remove([path]);
      throw Error(error.message || "Could not add this photo to the group.");
    }
  }
  return listRoomPhotos(ref);
}
