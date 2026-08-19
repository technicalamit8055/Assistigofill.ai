import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { publicEnv, serverEnv } from '../env';

/**
 * Extension pairing.
 * Master spec §15.1.2; docs/EXTENSION.md §3.
 *
 * Moves a signed-in dashboard session into the Chrome extension so no password is ever typed
 * into extension UI. The code is the only credential in flight, and it is worth exactly one
 * redemption within a two-minute window.
 *
 * The code itself is never persisted — only its SHA-256 — so a dump of
 * `extension_pairing_codes` yields nothing replayable. The session it guards is AES-256-GCM
 * encrypted with the code hash as additional authenticated data, so a ciphertext cannot be
 * moved onto a different code's row.
 */

/** Short enough that an abandoned connect tab stops being useful almost immediately. */
export const PAIRING_CODE_TTL_MS = 120_000;

/** A Chrome extension id is 32 characters from a-p. */
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

export const extensionSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** Epoch milliseconds, matching StoredSession in the extension. */
  expiresAt: z.number().int().positive(),
});

export type ExtensionSession = z.infer<typeof extensionSessionSchema>;

/** 256 bits of entropy, URL-safe so it survives a postMessage or a query string unchanged. */
export function newPairingCode(): string {
  return randomBytes(32).toString('base64url');
}

export function hashPairingCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

/**
 * AAD binds the ciphertext to the code that unlocks it. Without this, a stolen
 * `session_payload` could be paired with an attacker-chosen code row.
 */
function aadFor(codeHash: string): string {
  return `extension-pairing:${codeHash}`;
}

export async function sealSession(session: ExtensionSession, codeHash: string): Promise<string> {
  // Dynamic import: crypto.ts is server-only and excluded from the core barrel so it can never
  // be pulled into a browser or extension bundle (packages/core/src/index.ts).
  const { encryptField } = await import('@assistigo/core/privacy/crypto');
  return encryptField(JSON.stringify(session), aadFor(codeHash));
}

export async function openSession(
  payload: string,
  codeHash: string,
): Promise<ExtensionSession | null> {
  const { decryptField } = await import('@assistigo/core/privacy/crypto');
  try {
    return extensionSessionSchema.parse(JSON.parse(decryptField(payload, aadFor(codeHash))));
  } catch {
    // Wrong key, tampered row, or a payload written by an older format. All are "no session".
    return null;
  }
}

/**
 * Extension ids permitted to receive a pairing code.
 *
 * This is the gate that stops a crafted `/extension/connect?ext=<attacker-id>` link from
 * handing an operator's code to someone else's extension. In local development the allowlist
 * may be empty (see .env.example) and any well-formed id is accepted; anywhere else, an empty
 * allowlist means nothing is allowed.
 */
export function resolveExtensionId(requested: string | null | undefined): string | null {
  if (!requested || !EXTENSION_ID_PATTERN.test(requested)) return null;

  const allowed = (serverEnv().EXTENSION_ALLOWED_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (allowed.length > 0) return allowed.includes(requested) ? requested : null;

  return publicEnv().NEXT_PUBLIC_APP_ENV === 'local' ? requested : null;
}
