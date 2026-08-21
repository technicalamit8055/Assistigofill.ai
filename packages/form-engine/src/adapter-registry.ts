/**
 * The adapters that ship with the build.
 * Master spec §14.7; docs/FORM_ENGINE.md §6.
 *
 * `portal_adapters` is still the authority — an adapter can be fixed there overnight without
 * waiting days for Chrome Web Store review. But an empty table used to mean "no portal is
 * supported anywhere", which made the extension useless on a fresh install and on any
 * deployment whose seed had not run. These built-ins are the floor: whatever is in the database
 * wins, and this is what the mapper falls back to.
 *
 * They are validated at import rather than trusted. A malformed adapter is a mapping that
 * proposes a customer field key that does not exist, and the failure mode of that is a wrong
 * value in a citizen's application form.
 */

import { portalAdapterSchema, type PortalAdapter } from './adapters';
import biharRtps from './adapters/bihar-rtps.json';

/**
 * Parsed eagerly. If an adapter JSON is broken, the right time to find out is at build and
 * test time, not when an operator presses "Detect fields" in front of a customer.
 */
export const BUILT_IN_ADAPTERS: readonly PortalAdapter[] = [biharRtps].map((raw) =>
  portalAdapterSchema.parse(raw),
);

export const BUILT_IN_ADAPTER_BY_SLUG: ReadonlyMap<string, PortalAdapter> = new Map(
  BUILT_IN_ADAPTERS.map((adapter) => [adapter.slug, adapter]),
);

/**
 * Merges database adapters over the built-ins, keyed by slug.
 *
 * Slug rather than id, because the point of overriding a built-in is to publish a corrected
 * version of *that* adapter — a fix that arrived with a fresh uuid would otherwise sit
 * alongside the stale copy and the two would compete on specificity.
 *
 * Later entries in `databaseAdapters` win, so a caller that wants an organization's own patch to
 * beat the global row for the same slug passes the global ones first. The type carries no
 * `organizationId`, deliberately — the mapper has no business knowing whose adapter it is.
 */
export function mergeAdapters(
  databaseAdapters: readonly PortalAdapter[],
  builtIns: readonly PortalAdapter[] = BUILT_IN_ADAPTERS,
): PortalAdapter[] {
  const bySlug = new Map<string, PortalAdapter>();

  for (const adapter of builtIns) bySlug.set(adapter.slug, adapter);
  for (const adapter of databaseAdapters) bySlug.set(adapter.slug, adapter);

  return [...bySlug.values()];
}
