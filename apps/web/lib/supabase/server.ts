import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '../env';

/** Until generated types are wired in (see database.types.ts), the client is schema-agnostic. */
export type AssistigoSupabaseClient = SupabaseClient;

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Per-request Supabase client bound to the signed-in user's cookies.
 * Every query made through this client is subject to RLS — which is exactly what we want.
 */
export async function createSupabaseServerClient(): Promise<AssistigoSupabaseClient> {
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The middleware refreshes the session
          // instead, so this is safe to swallow.
        }
      },
    },
  });
}

/**
 * Supabase client for a request that authenticates with a bearer token — i.e. the Chrome
 * extension. Still runs under the user's JWT, so RLS applies exactly as it does on the web.
 */
export function createSupabaseTokenClient(accessToken: string): AssistigoSupabaseClient {
  const env = publicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Anonymous client, bound to no user and holding no cookies.
 *
 * For the handful of calls that authenticate themselves with something other than a session —
 * currently only `/api/extension/refresh`, which presents a refresh token. Carries the anon
 * key, so RLS still treats it as an unauthenticated caller.
 */
export function createSupabaseAnonClient(): AssistigoSupabaseClient {
  const env = publicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Service-role client. BYPASSES RLS.
 *
 * Permitted callers, and nothing else (docs/SECURITY.md §2):
 *   - the background job worker
 *   - the billing webhook
 *   - the seed script
 *
 * Any other use is a bug. Authorization must be resolved before this is ever reached.
 */
export function createSupabaseAdminClient(): AssistigoSupabaseClient {
  const env = publicEnv();
  const secrets = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, secrets.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
