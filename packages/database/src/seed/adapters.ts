/**
 * Portal adapter reference data.
 * Master spec §14.7; docs/FORM_ENGINE.md §6.
 *
 * SERVER ONLY — needs the service-role key, because `portal_adapters` rows with a null
 * `organization_id` are global reference data and no RLS policy lets an authenticated user write
 * them (supabase/migrations/0010_rls_policies.sql).
 *
 * Unlike the demo seed, this is *not* demo data: these rows belong in production too. They carry
 * no customer data, no organization data and no PII — just label patterns and field keys — so
 * this is safe to run against any environment.
 *
 * Idempotent. Upserted on the primary key, so re-running publishes the current JSON over
 * whatever is there rather than accumulating duplicates.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BUILT_IN_ADAPTERS } from '@assistigo/form-engine';

export type AdapterSeedResult = {
  slugs: string[];
  count: number;
};

export async function seedPortalAdapters(admin: SupabaseClient): Promise<AdapterSeedResult> {
  const rows = BUILT_IN_ADAPTERS.map((adapter) => ({
    id: adapter.id,
    // Null: these are global, readable by every organization, writable by none of them.
    organization_id: null,
    slug: adapter.slug,
    portal_name: adapter.portalName,
    form_name: adapter.formName,
    region: adapter.region ?? null,
    url_patterns: adapter.urlPatterns,
    version: adapter.version,
    status: adapter.status,
    field_mappings: adapter.fields,
    document_requirements: adapter.documentRequirements,
    notes: adapter.notes ?? null,
    known_issues: adapter.knownIssues ?? null,
    last_verified_at: adapter.lastVerifiedAt ?? null,
  }));

  const { error } = await admin.from('portal_adapters').upsert(rows, { onConflict: 'id' });
  if (error) throw error;

  return { slugs: rows.map((row) => row.slug), count: rows.length };
}
