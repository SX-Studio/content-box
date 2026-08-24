// Pure content-input validation (testable without a DB or files).
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB (images via the route)

// Video is uploaded directly to storage (bypassing the serverless body limit); a
// poster image supplies the blurred preview/thumbnail (no server-side transcoding).
export const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export function extForVideoMime(mime: string): string {
  return mime === 'video/webm' ? 'webm' : mime === 'video/quicktime' ? 'mov' : 'mp4';
}

export function validateContentInput(title: string, priceRaw: unknown): { title: string; price: number } {
  const t = (title ?? '').trim();
  if (t.length < 1 || t.length > 120) throw new Error('Title must be 1–120 characters');
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0 || price > 100_000) {
    throw new Error('Price must be a whole number of tokens (0–100000)');
  }
  return { title: t, price };
}

export function extForMime(mime: string): string {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
}
