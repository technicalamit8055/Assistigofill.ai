import { describe, expect, it } from 'vitest';
import {
  adapterFieldMatches,
  adapterMatchesUrl,
  selectAdapter,
  urlPatternToRegExp,
  type PortalAdapter,
} from './adapters';

function adapter(overrides: Partial<PortalAdapter> & { slug: string }): PortalAdapter {
  return {
    id: `id-${overrides.slug}`,
    portalName: 'Demo Portal',
    formName: 'Application',
    urlPatterns: ['https://demo.assistigo.test/**'],
    version: '1.0.0',
    status: 'active',
    fields: [],
    documentRequirements: [],
    ...overrides,
  };
}

describe('urlPatternToRegExp', () => {
  it('matches a single wildcard within one path segment', () => {
    const re = urlPatternToRegExp('https://demo.test/*/apply');
    expect(re.test('https://demo.test/scholarship/apply')).toBe(true);
    expect(re.test('https://demo.test/a/b/apply')).toBe(false);
  });

  it('matches a double wildcard across segments', () => {
    const re = urlPatternToRegExp('https://demo.test/**');
    expect(re.test('https://demo.test/a/b/c')).toBe(true);
  });

  it('treats dots as literal, so one adapter cannot claim another portal', () => {
    const re = urlPatternToRegExp('https://bihar.example.gov.in/apply');
    expect(re.test('https://bihar.example.gov.in/apply')).toBe(true);
    expect(re.test('https://biharXexample.gov.in/apply')).toBe(false);
  });

  it('is case-insensitive on the host', () => {
    expect(urlPatternToRegExp('https://Demo.test/apply').test('https://demo.test/apply')).toBe(
      true,
    );
  });

  it('handles a URL containing regex metacharacters', () => {
    const re = urlPatternToRegExp('https://demo.test/form(2024)/apply');
    expect(re.test('https://demo.test/form(2024)/apply')).toBe(true);
    expect(re.test('https://demo.test/form2024/apply')).toBe(false);
  });
});

describe('adapterMatchesUrl', () => {
  it('matches on origin plus path', () => {
    const a = adapter({ slug: 'demo', urlPatterns: ['https://demo.assistigo.test/scholarship/*'] });
    expect(adapterMatchesUrl(a, 'https://demo.assistigo.test', '/scholarship/apply')).toBe(true);
    expect(adapterMatchesUrl(a, 'https://demo.assistigo.test', '/recruitment/apply')).toBe(false);
  });

  it('never matches a deprecated adapter', () => {
    const a = adapter({ slug: 'old', status: 'deprecated' });
    expect(adapterMatchesUrl(a, 'https://demo.assistigo.test', '/anything')).toBe(false);
  });
});

describe('selectAdapter', () => {
  it('prefers the more specific pattern', () => {
    const broad = adapter({ slug: 'broad', urlPatterns: ['https://demo.assistigo.test/**'] });
    const specific = adapter({
      slug: 'specific',
      urlPatterns: ['https://demo.assistigo.test/scholarship/apply'],
    });

    const chosen = selectAdapter(
      [broad, specific],
      'https://demo.assistigo.test',
      '/scholarship/apply',
    );
    expect(chosen?.slug).toBe('specific');
  });

  it('prefers an active adapter over one still in testing', () => {
    const testing = adapter({ slug: 'testing', status: 'testing' });
    const active = adapter({ slug: 'active', status: 'active' });

    const chosen = selectAdapter([testing, active], 'https://demo.assistigo.test', '/apply');
    expect(chosen?.slug).toBe('active');
  });

  it('returns null when nothing matches', () => {
    expect(selectAdapter([adapter({ slug: 'a' })], 'https://other.test', '/apply')).toBeNull();
  });
});

describe('adapterFieldMatches', () => {
  const field = {
    signature: 'sig',
    name: 'applicant_name',
    id: 'applicantName',
    labelText: "Applicant's Name",
  };

  it('matches on the adapter key appearing in the field naming', () => {
    expect(
      adapterFieldMatches(
        { key: 'applicant_name', customerField: 'customer.full_name', inputType: 'text' },
        field,
      ),
    ).toBe(true);
  });

  it('falls back to label patterns when the key does not match', () => {
    expect(
      adapterFieldMatches(
        {
          key: 'nomatch',
          customerField: 'customer.full_name',
          inputType: 'text',
          labelPatterns: ["applicant's name"],
        },
        field,
      ),
    ).toBe(true);
  });

  it('does not match an unrelated field', () => {
    expect(
      adapterFieldMatches(
        { key: 'father_name', customerField: 'customer.father_name', inputType: 'text' },
        field,
      ),
    ).toBe(false);
  });
});
