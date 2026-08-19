/**
 * Portal adapters.
 * Master spec §14.7; docs/FORM_ENGINE.md §6.
 *
 * Adapters are **data, not code**. They live in `portal_adapters` and are seeded from JSON, so
 * a broken portal can be fixed without shipping a new extension build — which matters because
 * an extension update takes days to clear Chrome Web Store review while a portal can change
 * overnight.
 */

import { z } from 'zod';

export const ADAPTER_STATUSES = ['draft', 'testing', 'active', 'deprecated'] as const;
export type AdapterStatus = (typeof ADAPTER_STATUSES)[number];

export const adapterFieldSchema = z.object({
  key: z.string().min(1).max(80),
  customerField: z.string().regex(/^customer\./, 'must be a customer.* field key'),
  /** Preferred when the portal's markup is stable. */
  selector: z.string().max(300).optional(),
  /** Fallback when a selector drifts, and the reason adapters degrade gracefully. */
  labelPatterns: z.array(z.string().max(200)).max(20).optional(),
  inputType: z.string().max(40),
  transform: z.string().max(60).optional(),
  required: z.boolean().optional(),
  /** Forces review even when the mapping is certain (§14.6). */
  reviewRequired: z.boolean().optional(),
  /** For dependent dropdowns: the adapter key that must be filled first. */
  dependsOn: z.string().max(80).optional(),
});

export type AdapterField = z.infer<typeof adapterFieldSchema>;

export const documentRequirementSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().max(200),
  presetCode: z.string().max(80).optional(),
  required: z.boolean().default(true),
  notes: z.string().max(300).optional(),
});

export type DocumentRequirement = z.infer<typeof documentRequirementSchema>;

export const portalAdapterSchema = z.object({
  id: z.string(),
  slug: z.string().min(1).max(80),
  portalName: z.string().min(1).max(160),
  formName: z.string().min(1).max(160),
  region: z.string().max(120).optional(),
  urlPatterns: z.array(z.string().max(400)).min(1).max(20),
  version: z.string().max(20),
  status: z.enum(ADAPTER_STATUSES),
  lastVerifiedAt: z.string().optional(),
  fields: z.array(adapterFieldSchema).max(300),
  documentRequirements: z.array(documentRequirementSchema).max(50).default([]),
  notes: z.string().max(1000).optional(),
  knownIssues: z.string().max(1000).optional(),
});

export type PortalAdapter = z.infer<typeof portalAdapterSchema>;

/**
 * Glob matching for URL patterns: `*` matches within a path segment, `**` across segments.
 *
 * A regex written by hand in a JSON adapter would be a footgun — one unescaped `.` and an
 * adapter meant for `bihar.example.gov.in` starts claiming `biharXexample.gov.in`.
 */
export function urlPatternToRegExp(pattern: string): RegExp {
  /*
   * Split on the wildcards first, escape only the literal segments, then rejoin. The obvious
   * alternative — substituting a placeholder character for `**` and swapping it back afterwards
   * — breaks the moment a URL legitimately contains that character, and hides the bug until a
   * real portal trips over it.
   */
  const source = pattern
    .split(/(\*\*|\*)/)
    .map((part) => {
      if (part === '**') return '.*';
      if (part === '*') return '[^/]*';
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');

  return new RegExp(`^${source}$`, 'i');
}

export function adapterMatchesUrl(adapter: PortalAdapter, origin: string, path: string): boolean {
  if (adapter.status === 'deprecated') return false;
  const url = `${origin}${path}`;
  return adapter.urlPatterns.some((pattern) => urlPatternToRegExp(pattern).test(url));
}

/**
 * Picks the adapter for a page.
 *
 * When several match, the most specific pattern wins — an adapter targeting
 * `https://demo.example/scholarship/apply` should beat one targeting `https://demo.example/*`.
 * Specificity is measured as pattern length minus wildcards, which is crude but predictable.
 */
export function selectAdapter(
  adapters: readonly PortalAdapter[],
  origin: string,
  path: string,
): PortalAdapter | null {
  const url = `${origin}${path}`;

  const matches = adapters
    .filter((adapter) => adapterMatchesUrl(adapter, origin, path))
    .map((adapter) => {
      const best = adapter.urlPatterns
        .filter((pattern) => urlPatternToRegExp(pattern).test(url))
        .reduce((longest, pattern) => (pattern.length > longest.length ? pattern : longest), '');
      const wildcards = (best.match(/\*/g) ?? []).length;
      return { adapter, specificity: best.length - wildcards * 10 };
    });

  if (matches.length === 0) return null;

  // A tested adapter beats a draft one at equal specificity.
  const statusRank: Record<AdapterStatus, number> = {
    active: 3,
    testing: 2,
    draft: 1,
    deprecated: 0,
  };

  matches.sort(
    (a, b) =>
      statusRank[b.adapter.status] - statusRank[a.adapter.status] || b.specificity - a.specificity,
  );

  return matches[0]?.adapter ?? null;
}

/**
 * Whether an adapter field describes a given detected field.
 * Selector matching happens in the content script (it needs the DOM); here we match on the
 * label patterns and the field's own naming, which is what survives into the metadata payload.
 */
export function adapterFieldMatches(
  adapterField: AdapterField,
  field: { signature: string; name: string | null; id: string | null; labelText: string | null },
): boolean {
  if (adapterField.selector && field.signature.includes(adapterField.selector)) return true;

  const haystack = [field.name, field.id, field.labelText]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();

  if (adapterField.key && haystack.includes(adapterField.key.toLowerCase())) return true;

  return (adapterField.labelPatterns ?? []).some((pattern) =>
    haystack.includes(pattern.toLowerCase()),
  );
}
