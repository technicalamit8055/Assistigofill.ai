import { describe, expect, it } from 'vitest';
import {
  adapterDependencyDepth,
  adapterFieldMatchScore,
  adapterFieldMatches,
  findAdapterField,
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

describe('adapterFieldMatchScore — negative patterns', () => {
  const applicantName = {
    key: 'applicant_name',
    customerField: 'customer.full_name',
    inputType: 'text',
    labelPatterns: ['नाम'],
    negativePatterns: ['पिता', 'माता'],
  };

  it('rejects a field a negative pattern disqualifies, even when a positive one matches', () => {
    expect(
      adapterFieldMatchScore(applicantName, {
        signature: 'sig',
        name: 'attr_1005',
        id: 'attr_1005',
        labelText: 'पिता का नाम / Name of Father',
      }),
    ).toBeNull();
  });

  it('still claims the field the pattern was written for', () => {
    expect(
      adapterFieldMatchScore(applicantName, {
        signature: 'sig',
        name: 'attr_1003',
        id: 'attr_1003',
        labelText: 'आवेदक का नाम / Name of Applicant',
      }),
    ).not.toBeNull();
  });

  it('looks at the placeholder and aria-label too', () => {
    expect(
      adapterFieldMatchScore(
        {
          key: 'dob',
          customerField: 'customer.date_of_birth',
          inputType: 'text',
          labelPatterns: ['date of birth'],
        },
        {
          signature: 'sig',
          name: null,
          id: null,
          labelText: null,
          ariaLabel: 'Date of Birth',
        },
      ),
    ).not.toBeNull();
  });

  it('does not let the key substring-match a label', () => {
    /*
     * The old behaviour matched the adapter key against the label text as a loose substring, so
     * a key of "name" claimed "पिता का नाम". The key is an attribute-space identifier; it now
     * only matches name/id, and only as a whole token.
     */
    expect(
      adapterFieldMatchScore(
        { key: 'name', customerField: 'customer.full_name', inputType: 'text' },
        { signature: 'sig', name: 'attr_1005', id: 'attr_1005', labelText: "Father's Name" },
      ),
    ).toBeNull();
  });

  it('matches a key against name/id across naming conventions', () => {
    for (const attribute of ['applicant_name', 'applicantName', 'applicant-name']) {
      expect(
        adapterFieldMatchScore(
          { key: 'applicant_name', customerField: 'customer.full_name', inputType: 'text' },
          { signature: 'sig', name: attribute, id: null, labelText: null },
        ),
        attribute,
      ).not.toBeNull();
    }
  });
});

describe('findAdapterField — longest match wins', () => {
  const fields = [
    {
      key: 'district',
      customerField: 'customer.address.district',
      inputType: 'select-one',
      labelPatterns: ['जिला'],
    },
    {
      key: 'permanent_district',
      customerField: 'customer.permanent_address.district',
      inputType: 'select-one',
      labelPatterns: ['स्थायी जिला'],
    },
  ];

  it('prefers the more specific pattern regardless of array order', () => {
    const field = {
      signature: 'sig',
      name: 'attr_9',
      id: 'attr_9',
      labelText: 'स्थायी जिला / Permanent District',
    };

    expect(findAdapterField({ fields }, field)?.key).toBe('permanent_district');
    expect(findAdapterField({ fields: [...fields].reverse() }, field)?.key).toBe(
      'permanent_district',
    );
  });

  it('returns null when nothing claims the field', () => {
    expect(
      findAdapterField(
        { fields },
        { signature: 'sig', name: 'captchaCode', id: 'captchaCode', labelText: 'Enter captcha' },
      ),
    ).toBeNull();
  });
});

describe('adapterDependencyDepth', () => {
  it('counts the chain', () => {
    const depths = adapterDependencyDepth({
      fields: [
        {
          key: 'block',
          customerField: 'customer.address.block',
          inputType: 'select-one',
          dependsOn: 'district',
        },
        { key: 'state', customerField: 'customer.address.state', inputType: 'select-one' },
        {
          key: 'district',
          customerField: 'customer.address.district',
          inputType: 'select-one',
          dependsOn: 'state',
        },
      ],
    });

    expect(depths.get('state')).toBe(0);
    expect(depths.get('district')).toBe(1);
    expect(depths.get('block')).toBe(2);
  });

  it('treats a dangling parent as no dependency rather than throwing', () => {
    const depths = adapterDependencyDepth({
      fields: [
        {
          key: 'block',
          customerField: 'customer.address.block',
          inputType: 'select-one',
          dependsOn: 'missing',
        },
      ],
    });
    expect(depths.get('block')).toBe(0);
  });

  it('survives a cycle, because a broken adapter must still fill the rest of the form', () => {
    const depths = adapterDependencyDepth({
      fields: [
        { key: 'a', customerField: 'customer.address.state', inputType: 'text', dependsOn: 'b' },
        { key: 'b', customerField: 'customer.address.district', inputType: 'text', dependsOn: 'a' },
      ],
    });
    expect(depths.get('a')).toBeTypeOf('number');
    expect(depths.get('b')).toBeTypeOf('number');
  });
});
