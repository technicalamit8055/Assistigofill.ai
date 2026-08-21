/**
 * `npm run db:seed:adapters` entry point.
 *
 * Publishes the portal adapters that ship with the build into `portal_adapters` as global
 * reference data.
 *
 * Unlike `db:seed`, this is allowed to target a remote project: adapters are how a portal change
 * gets fixed without shipping a new extension, and that is only useful if it can be applied to
 * the environment operators are actually using. It carries no customer data.
 *
 * It still refuses to run silently against a remote project — pass --confirm-remote, so that
 * pointing SUPABASE_SERVICE_ROLE_KEY at production is always a decision rather than an accident.
 */

import { createClient } from '@supabase/supabase-js';
import { seedPortalAdapters } from '../packages/database/src/index';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env.local and re-run.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(url);
  if (!isLocal && !process.argv.includes('--confirm-remote')) {
    console.error(
      `Refusing to seed ${url} without --confirm-remote.\n` +
        'Re-run as: npm run db:seed:adapters -- --confirm-remote',
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Publishing portal adapters to ${url} ...`);
  const result = await seedPortalAdapters(admin);
  console.log(`Done. ${result.count} adapter(s): ${result.slugs.join(', ')}`);
}

main().catch((error) => {
  console.error('Adapter seed failed:', error);
  process.exit(1);
});
