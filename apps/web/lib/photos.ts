import { browserClient } from "@/lib/supabase/lazy";

/**
 * Re-encode a photo as JPEG before upload: smaller files, and EXIF (GPS, device) is dropped.
 * The compressor's worker build loads from a CDN, which our CSP blocks, so it runs inline.
 */
export async function preparePhoto(
  file: File,
  { maxSizeMB = 1.5, maxSide = 1600 }: { maxSizeMB?: number; maxSide?: number } = {},
): Promise<File> {
  const { default: compress } = await import("browser-image-compression");
  return compress(file, {
    maxSizeMB,
    maxWidthOrHeight: maxSide,
    fileType: "image/jpeg",
    preserveExif: false,
    useWebWorker: false,
  });
}

/**
 * Prepare a photo and upload it to `bucket` under `folder`, with a random name (a path must
 * never reveal who uploaded it). Returns the stored path and a local preview URL. Throws if
 * the upload fails.
 */
export async function uploadPhoto(bucket: string, folder: string, file: File) {
  const photo = await preparePhoto(file);
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const supabase = await browserClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, photo, { contentType: "image/jpeg" });
  if (error) throw error;
  return { path, preview: URL.createObjectURL(photo) };
}
