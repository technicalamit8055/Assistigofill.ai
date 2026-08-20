/**
 * `npm run db:seed` entry point.
 *
 * Talks to Supabase with the service-role key, so it must run against a local/dev project only —
 * never point SUPABASE_SERVICE_ROLE_KEY at a production project when running this.
 */

import { createClient } from '@supabase/supabase-js';
import { seedDemoData } from '../packages/database/src/index';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env.local, run "supabase start", and re-run.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    console.error(
      `Refusing to seed ${url} — this script only runs against a local Supabase ` +
        '(NEXT_PUBLIC_SUPABASE_URL starting with http://127.0.0.1 or http://localhost).',
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Seeding demo data into ${url} ...`);
  const result = await seedDemoData(admin);
  console.log(`Done. Organization ${result.organizationId}, ${result.customerIds.length} customers.`);
  console.log('Demo sign-in (any role): password is AssistigoDemo!2026');
  for (const [role, userId] of Object.entries(result.memberUserIds)) {
    console.log(`  ${role.padEnd(14)} ${userId}`);
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
