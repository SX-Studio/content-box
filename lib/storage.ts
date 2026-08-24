import 'server-only';
import { admin } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

// Upload via the service role (bypasses storage RLS). Buckets: 'master' (private),
// 'preview' (public), 'identity' (private — ID docs/selfies). Paths are stored
// WITHOUT the bucket prefix.
export async function uploadObject(bucket: 'master' | 'preview' | 'identity', path: string, body: Buffer, contentType: string) {
  const { error } = await admin().storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

// Short-lived signed URL for a private object (e.g. an identity doc for a reviewer).
export async function signedUrl(bucket: 'master' | 'identity', path: string, expiresInSeconds = 120): Promise<string | null> {
  const { data } = await admin().storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

// One-time signed URL the client PUTs a large file to directly (bypasses the
// serverless body limit). Returns an absolute upload URL + the stored path.
export async function createUploadUrl(bucket: 'master', path: string): Promise<{ uploadUrl: string; path: string }> {
  const { data, error } = await admin().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`could not create upload url: ${error?.message ?? 'unknown'}`);
  return { uploadUrl: `${env.supabaseUrl()}${data.signedUrl}`, path };
}

// Confirm an object exists in a private bucket (used to validate a client upload
// before we record it).
export async function objectExists(bucket: 'master', path: string): Promise<boolean> {
  return (await signedUrl(bucket, path, 30)) !== null;
}

export function publicUrl(bucket: 'preview', path: string): string {
  return `${env.supabaseUrl()}/storage/v1/object/public/${bucket}/${path}`;
}
