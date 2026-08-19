'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '../env';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client. Anon key only — never a service key. */
export function getSupabaseBrowserClient() {
  if (client) return client;
  const env = publicEnv();
  client = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}
