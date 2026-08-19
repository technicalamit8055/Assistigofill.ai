import { z } from 'zod';
import type { NextResponse } from 'next/server';
import { unauthenticated } from '@assistigo/core';
import { handler, ok, parseBody } from '@/lib/api/response';
import { logger } from '@/lib/api/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { hashPairingCode, openSession } from '@/lib/extension/pairing';
import { extensionPreflight, withExtensionCors } from '@/lib/extension/cors';

/**
 * POST /api/extension/pair
 *
 * Called by the extension service worker with the code the connect page handed it. Returns the
 * session that code was minted against (docs/EXTENSION.md §3).
 *
 * Deliberately unauthenticated: the code *is* the credential. It carries 256 bits of entropy,
 * lives for two minutes and redeems once, so there is nothing here worth guessing at.
 *
 * Every failure returns the same 401 — an unknown code, an expired code and an already-redeemed
 * code must be indistinguishable, or this becomes an oracle.
 */

const bodySchema = z.object({
  code: z.string().min(10).max(200),
});

export const OPTIONS = extensionPreflight;

const pair = handler('extension.pair', async (request) => {
  const { code } = await parseBody(request, bodySchema);
  const codeHash = hashPairingCode(code);

  // Service role: extension_pairing_codes has RLS on and no policies (migration 0012). The
  // RPC does the check-and-consume in one statement so two racing redemptions cannot both win.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('consume_extension_pairing_code', {
    p_code_hash: codeHash,
  });

  if (error) throw error;

  const row = (data as { paired_user_id: string; sealed_session: string }[] | null)?.[0];
  if (!row) throw unauthenticated('extension.pairing_failed');

  const session = await openSession(row.sealed_session, codeHash);
  if (!session) {
    // The row was valid but would not decrypt: a rotated FIELD_ENCRYPTION_KEY, or tampering.
    // Worth an operator's attention; the user still just sees "pairing failed".
    logger.error('extension.pair_decrypt_failed', { userId: row.paired_user_id });
    throw unauthenticated('extension.pairing_failed');
  }

  logger.info('extension.paired', { userId: row.paired_user_id });

  return ok(session);
});

// Wrapped outside `handler` so the 401s above carry CORS headers too: without them the browser
// reports a generic CORS failure and the real status never reaches the service worker.
export const POST = async (request: Request): Promise<NextResponse> =>
  withExtensionCors(request, await pair(request));
