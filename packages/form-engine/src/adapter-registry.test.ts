/**
 * The adapters that ship with the build.
 *
 * An adapter is treated as a near-certain statement about a form (0.99 confidence), so a typo in
 * one is not a cosmetic bug — it is a wrong value typed confidently into a citizen's application.
 * These tests are the only thing standing between a hand-edited JSON file and that outcome.
 */

import { describe, expect, it } from 'vitest';
import { isCustomerFieldKey, isForbiddenFieldKey } from '@assistigo/core';
import { BUILT_IN_ADAPTERS, BUILT_IN_ADAPTER_BY_SLUG, mergeAdapters } from './adapter-registry';
import { adapterDependencyDepth, portalAdapterSchema, type PortalAdapter } from './adapters';
import { TRANSFORM_NAMES } from './transforms';

describe('built-in adapters — integrity', () => {
  it('ships at least one', () => {
    expect(BUILT_IN_ADAPTERS.length).toBeGreaterThan(0);
  });

  it('every adapter passes its own schema', () => {
    for (const adapter of BUILT_IN_ADAPTERS) {
      expect(() => portalAdapterSchema.parse(adapter)).not.toThrow();
    }
  });

  it('slugs and ids are unique', () => {
    const slugs = BUILT_IN_ADAPTERS.map((adapter) => adapter.slug);
    const ids = BUILT_IN_ADAPTERS.map((adapter) => adapter.id);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ids are uuids, because fill_sessions.portal_adapter_id is a uuid foreign key', () => {
    for (const adapter of BUILT_IN_ADAPTERS) {
      expect(adapter.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });

  it('every customerField names a field that actually exists in the registry', () => {
    for (const adapter of BUILT_IN_ADAPTERS) {
      for (const field of adapter.fields) {
        expect(
          isCustomerFieldKey(field.customerField),
          `${adapter.slug}/${field.key} → ${field.customerField}`,
        ).toBe(true);
      }
    }
  });

  it('no adapter maps a forbidden field key', () => {
    // Chiefly: a full Aadhaar number, which is never stored and so can never be filled.
    for (const adapter of BUILT_IN_ADAPTERS) {
      for (const field of adapter.fields) {
        expect(isForbiddenFieldKey(field.customerField)).toBe(false);
      }
    }
  });

  it('every transform names a real transform', () => {
    for (const adapter of BUILT_IN_ADAPTERS) {
      for (const field of adapter.fields) {
        if (!field.transform) continue;
        expect(TRANSFORM_NAMES, `${adapter.slug}/${field.key}`).toContain(field.transform);
      }
    }
  });

  it('field keys are unique within an adapter', () => {
    for (const adapter of BUILT_IN_ADAPTERS) {
      const keys = adapter.fields.map((field) => field.key);
      expect(new Set(keys).size, adapter.slug).toBe(keys.length);
    }
  });

  it('every dependsOn names a sibling field, so no dependency dangles', () => {
    for (const adapter of BUILT_IN_ADAPTERS) {
      const keys = new Set(adapter.fields.map((field) => field.key));
      for (const field of adapter.fields) {
        if (!field.dependsOn) continue;
        expect(keys, `${adapter.slug}/${field.key}`).toContain(field.dependsOn);
      }
    }
  });

  it('every field can be matched somehow — a selector, label patterns, or its key', () => {
    for (const adapter of BUILT_IN_ADAPTERS) {
      for (const field of adapter.fields) {
        const matchable =
          Boolean(field.selector) || (field.labelPatterns ?? []).length > 0 || field.key.length > 0;
        expect(matchable, `${adapter.slug}/${field.key}`).toBe(true);
      }
    }
  });
});

describe('bihar rtps adapter — policy', () => {
  const adapter = BUILT_IN_ADAPTER_BY_SLUG.get('bihar-rtps-serviceonline') as PortalAdapter;

  it('is registered', () => {
    expect(adapter).toBeDefined();
  });

  it('never proposes anything for an Aadhaar field', () => {
    /*
     * The portal's आधार संख्या field wants twelve digits. Assistigo stores four by policy, so
     * there is no value it could put there that would be right — including the last four, which
     * would look filled and be wrong. This has to stay true even if someone later adds an
     * `aadhaar_last4` mapping for a portal that genuinely asks for four digits.
     */
    for (const field of adapter.fields) {
      expect(field.customerField).not.toContain('aadhaar');
      for (const pattern of field.labelPatterns ?? []) {
        expect(pattern.toLowerCase()).not.toContain('aadhaar');
        expect(pattern).not.toContain('आधार');
      }
    }
  });

  it('orders the address chain state → district → block → panchayat', () => {
    const depths = adapterDependencyDepth(adapter);
    expect(depths.get('state')).toBe(0);
    expect(depths.get('district')).toBe(1);
    expect(depths.get('block')).toBe(2);
    expect(depths.get('panchayat')).toBe(3);
  });

  it('is not marked active until it has been verified against the live portal', () => {
    // `testing` still maps forms; it just proposes at 0.90 rather than 0.99, which keeps every
    // field in the review band. Promote it after the manual smoke test (docs/ROADMAP.md).
    expect(adapter.status).toBe('testing');
  });
});

describe('mergeAdapters', () => {
  const builtIn: PortalAdapter = portalAdapterSchema.parse({
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'demo-portal',
    portalName: 'Demo',
    formName: 'Demo form',
    urlPatterns: ['https://demo.example/**'],
    version: '1.0.0',
    status: 'active',
    fields: [],
    documentRequirements: [],
  });

  it('returns the built-ins when the database has nothing', () => {
    expect(mergeAdapters([], [builtIn])).toEqual([builtIn]);
  });

  it('lets a database row for the same slug win', () => {
    const patched = { ...builtIn, id: '22222222-2222-4222-8222-222222222222', version: '1.1.0' };
    const merged = mergeAdapters([patched], [builtIn]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.version).toBe('1.1.0');
  });

  it('keeps a database adapter that has no built-in counterpart', () => {
    const other = { ...builtIn, id: '33333333-3333-4333-8333-333333333333', slug: 'other-portal' };
    expect(
      mergeAdapters([other], [builtIn])
        .map((adapter) => adapter.slug)
        .sort(),
    ).toEqual(['demo-portal', 'other-portal']);
  });

  it('lets the last database entry win, which is how org overrides beat global rows', () => {
    const global = { ...builtIn, version: '2.0.0' };
    const orgOwn = { ...builtIn, version: '3.0.0' };
    expect(mergeAdapters([global, orgOwn], [builtIn])[0]?.version).toBe('3.0.0');
  });
});
