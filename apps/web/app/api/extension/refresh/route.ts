import { z } from 'zod';
import type { NextResponse } from 'next/server';
import { unauthenticated } from '@assistigo/core';
import { handler, ok, parseBody } from '@/lib/api/response';
import { createSupabaseAnonClient } from '@/lib/supabase/server';
import { extensionSessionSchema } from '@/lib/extension/pairing';
import { extensionPreflight, withExtensionCors } from '@/lib/extension/cors';

/**
 * POST /api/extension/refresh
 *
 * The service worker calls this when its access token is close to expiring
 * (apps/extension/src/shared/api.ts). Unauthenticated by nature: the refresh token is the
 * credential being presented.
 *
 * Refreshing through Supabase rather than minting our own token is what makes
 * "signing out of the dashboard revokes the extension session" true — a revoked refresh token
 * family fails here, and the extension drops its session (docs/EXTENSION.md §3).
 */

const bodySchema = z.object({
  refreshToken: z.string().min(1).max(1000),
});

export const OPTIONS = extensionPreflight;

const refresh = handler('extension.refresh', async (request) => {
  const { refreshToken } = await parseBody(request, bodySchema);

  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  const session = data?.session;
  // A revoked, rotated or expired token all land here, and all mean the same thing to the
  // extension: reconnect. The reason is never echoed back.
  if (error || !session?.access_token || !session.refresh_token) {
    throw unauthenticated('extension.session_expired');
  }

  return ok(
    extensionSessionSchema.parse({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at
        ? session.expires_at * 1000
        : Date.now() + (session.expires_in ?? 3600) * 1000,
    }),
  );
});

export const POST = async (request: Request): Promise<NextResponse> =>
  withExtensionCors(request, await refresh(request));
