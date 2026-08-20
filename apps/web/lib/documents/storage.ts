import 'server-only';

import {
  DOCUMENT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  sniffMimeType,
  unsupportedMedia,
  type AllowedUploadMimeType,
} from '@assistigo/core';
import type { AssistigoSupabaseClient } from '../supabase/server';

/**
 * Private storage access.
 * Master spec §19.3; docs/SECURITY.md §4 — private buckets, short-lived signed URLs, and the
 * client's declared MIME type is never trusted.
 */

/**
 * A one-time upload URL scoped to exactly one object path.
 *
 * Bytes go straight from the operator's browser to Supabase Storage rather than through a route
 * handler, because a 15 MB upload through a serverless function is slow and fragile. The
 * security property that the server — not the client — decides what a file really is, is
 * preserved by `assertDeclaredTypeMatchesBytes` below, which runs before the document is
 * processed or usable.
 */
export async function createSignedUploadUrl(
  supabase: AssistigoSupabaseClient,
  storagePath: string,
): Promise<{ url: string; token: string }> {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error) throw error;
  return { url: data.signedUrl, token: data.token };
}

/** Short-lived read URL. Expiry is capped by policy, never chosen by the caller (§19.3). */
export async function createSignedDownloadUrl(
  supabase: AssistigoSupabaseClient,
  storagePath: string,
  bucket: string = DOCUMENT_BUCKET,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) throw error;
  return data.signedUrl;
}

export async function downloadObject(
  supabase: AssistigoSupabaseClient,
  storagePath: string,
  bucket: string = DOCUMENT_BUCKET,
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeObject(
  supabase: AssistigoSupabaseClient,
  storagePath: string,
  bucket: string = DOCUMENT_BUCKET,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) throw error;
}

/**
 * Confirms the stored bytes really are what the upload claimed.
 *
 * The declared MIME type and the file extension are both attacker-controlled, so the first
 * bytes are sniffed server-side before anything else touches the file (docs/SECURITY.md §4).
 * A mismatch is rejected: a PDF that is really an HTML page is how a storage bucket becomes an
 * XSS host.
 */
export function assertDeclaredTypeMatchesBytes(
  bytes: Uint8Array,
  declared: AllowedUploadMimeType,
): void {
  const actual = sniffMimeType(bytes);
  if (actual === null || actual !== declared) {
    throw unsupportedMedia('errors.file_type_mismatch');
  }
}

/** Enough bytes for every signature in the magic-byte table. */
export const SNIFF_BYTE_COUNT = 32;
