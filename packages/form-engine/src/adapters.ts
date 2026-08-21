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
  /**
   * Phrases that disqualify a field outright.
   *
   * Indispensable on a Hindi portal, where the labels nest: "नाम" is a substring of
   * "पिता का नाम", so an adapter field for the applicant's own name has to be able to say
   * "…but not if the label mentions a father".
   */
  negativePatterns: z.array(z.string().max(200)).max(30).optional(),
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

/** What an adapter needs to know about a detected field in order to claim it. */
export type AdapterMatchable = {
  signature: string;
  name: string | null;
  id: string | null;
  labelText: string | null;
  placeholder?: string | null;
  ariaLabel?: string | null;
};

function normaliseForMatch(text: string): string {
  /*
   * Collapse whitespace and drop the punctuation portals sprinkle through labels — "पिता का
   * नाम *", "Father's Name :" and "Father Name" must all reduce to the same thing, or an
   * adapter written against one office's markup stops matching the next office's.
   */
  return text
    .replace(/[*:?()[\]{}.,/|—–-]+/g, ' ')
    .replace(/['`‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** The text an adapter is allowed to match against. Deliberately excludes `nearbyText`. */
function haystackOf(field: AdapterMatchable): string {
  /*
   * nearbyText is a slice of the surrounding paragraph. It is useful to the fuzzy dictionary,
   * which scores it low on purpose, but an adapter match is treated as near-certain (0.99) —
   * so it may only look at text that genuinely belongs to this one control.
   */
  return normaliseForMatch(
    [field.name, field.id, field.labelText, field.placeholder, field.ariaLabel]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' '),
  );
}

/** Attribute-ish comparison: "applicant_name", "applicantName" and "applicant name" all agree. */
function attributeTokens(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * How strongly an adapter field claims a detected field, or `null` for "not mine".
 *
 * A score rather than a boolean because label patterns on an Indian government form overlap by
 * nature. "जिला" matches both "जिला" and "उप जिला"; the longest match has to win, otherwise
 * whichever adapter field happens to sit earlier in the JSON array silently takes the field.
 */
export function adapterFieldMatchScore(
  adapterField: AdapterField,
  field: AdapterMatchable,
): number | null {
  const haystack = haystackOf(field);
  if (!haystack) return null;

  // Negatives first: a disqualifier outranks every positive signal.
  for (const pattern of adapterField.negativePatterns ?? []) {
    const needle = normaliseForMatch(pattern);
    if (needle && haystack.includes(needle)) return null;
  }

  // A selector baked into the signature is the strongest statement an adapter can make.
  if (adapterField.selector && field.signature.includes(adapterField.selector)) return 1000;

  /*
   * The adapter key matches only against name/id, and only as a whole token. The previous
   * behaviour — substring-matching the key against the label too — meant a key like "name"
   * claimed "पिता का नाम", which is exactly the mismapping negativePatterns exists to stop.
   */
  const key = attributeTokens(adapterField.key);
  if (key) {
    for (const attribute of [field.name, field.id]) {
      const tokens = attributeTokens(attribute);
      if (!tokens) continue;
      if (tokens === key) return 900;
      // Whole-token containment, done with padding rather than a built regex: the key comes
      // from adapter JSON, and interpolating it into a pattern would make a stray "(" in an
      // adapter a thrown SyntaxError on a live portal.
      if (` ${tokens} `.includes(` ${key} `)) return 800;
    }
  }

  // Otherwise the longest matching label pattern wins, measured in normalised characters.
  let best: number | null = null;
  for (const pattern of adapterField.labelPatterns ?? []) {
    const needle = normaliseForMatch(pattern);
    if (!needle) continue;
    if (haystack.includes(needle)) {
      best = Math.max(best ?? 0, needle.length);
    }
  }
  return best;
}

/**
 * Whether an adapter field describes a given detected field.
 * Selector matching happens in the content script (it needs the DOM); here we match on the
 * label patterns and the field's own naming, which is what survives into the metadata payload.
 */
export function adapterFieldMatches(adapterField: AdapterField, field: AdapterMatchable): boolean {
  return adapterFieldMatchScore(adapterField, field) !== null;
}

/**
 * The adapter field that best describes a detected field, or `null` if none do.
 *
 * Use this rather than `adapter.fields.find(adapterFieldMatches)`: `find` returns whichever
 * entry is written first in the JSON, which on a form whose labels nest is a coin toss.
 */
export function findAdapterField(
  adapter: Pick<PortalAdapter, 'fields'>,
  field: AdapterMatchable,
): AdapterField | null {
  let best: AdapterField | null = null;
  let bestScore = -1;

  for (const candidate of adapter.fields) {
    const score = adapterFieldMatchScore(candidate, field);
    if (score === null) continue;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Depth of each adapter field in its `dependsOn` chain: state 0, district 1, block 2, panchayat 3.
 *
 * The fill executor waits for a dependent dropdown to repopulate, but it can only wait for a
 * parent that has already been set. On RTPS the DOM order happens to put state before district;
 * that is a coincidence of one portal's markup, not something to rely on, so the adapter states
 * the dependency and this turns it into a fill order.
 */
export function adapterDependencyDepth(
  adapter: Pick<PortalAdapter, 'fields'>,
): ReadonlyMap<string, number> {
  const byKey = new Map(adapter.fields.map((field) => [field.key, field]));
  const depths = new Map<string, number>();

  const depthOf = (key: string, seen: ReadonlySet<string>): number => {
    const cached = depths.get(key);
    if (cached !== undefined) return cached;

    const field = byKey.get(key);
    const parent = field?.dependsOn;
    // A missing or cyclic parent resolves to depth 0 rather than throwing: a broken adapter
    // should degrade to "fill in DOM order", not refuse to fill the form at all.
    const depth =
      !parent || !byKey.has(parent) || seen.has(parent)
        ? 0
        : depthOf(parent, new Set([...seen, key])) + 1;

    depths.set(key, depth);
    return depth;
  };

  for (const field of adapter.fields) depthOf(field.key, new Set([field.key]));
  return depths;
}
