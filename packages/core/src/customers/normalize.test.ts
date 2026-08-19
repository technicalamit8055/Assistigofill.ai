import { describe, expect, it } from 'vitest';
import {
  aadhaarLastFour,
  ageFromDateOfBirth,
  formatIndianDate,
  formatInr,
  formatMobile,
  isPanFormatValid,
  looksLikeAadhaar,
  nameComparisonKey,
  normalizeEmail,
  normalizeIfsc,
  normalizeMobile,
  normalizeName,
  normalizePan,
  normalizePincode,
  parseIndianDate,
  toE164Mobile,
} from './normalize';

describe('normalizeName', () => {
  it('collapses whitespace but never changes spelling or case', () => {
    expect(normalizeName('  Amit   kumar  SINGH ').value).toBe('Amit kumar SINGH');
  });

  it('preserves Devanagari names', () => {
    expect(normalizeName('अमित कुमार').value).toBe('अमित कुमार');
  });

  it('strips zero-width characters pasted from PDFs', () => {
    expect(normalizeName('Amit​Kumar').value).toBe('AmitKumar');
  });

  it('keeps the original for provenance', () => {
    const out = normalizeName('  Amit  ');
    expect(out.original).toBe('  Amit  ');
    expect(out.value).toBe('Amit');
  });

  it('flags empty input rather than inventing a value', () => {
    expect(normalizeName('   ')).toMatchObject({ value: null, valid: false, reason: 'EMPTY' });
  });
});

describe('nameComparisonKey', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(nameComparisonKey('Amit Kumar')).toBe(nameComparisonKey('  AMIT   kumar. '));
  });
});

describe('normalizeMobile', () => {
  it.each([
    ['9900012345', '9900012345'],
    ['+91 99000 12345', '9900012345'],
    ['+919900012345', '9900012345'],
    ['09900012345', '9900012345'],
    ['99000-12345', '9900012345'],
    ['91 9900012345', '9900012345'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeMobile(input).value).toBe(expected);
  });

  it('rejects numbers that are not Indian mobile numbers', () => {
    expect(normalizeMobile('1234567890')).toMatchObject({ value: null, reason: 'PREFIX' });
    expect(normalizeMobile('99000')).toMatchObject({ value: null, reason: 'LENGTH' });
    expect(normalizeMobile('')).toMatchObject({ value: null, reason: 'EMPTY' });
  });

  it('formats for display and for E.164', () => {
    expect(formatMobile('9900012345')).toBe('99000 12345');
    expect(toE164Mobile('99000 12345')).toBe('+919900012345');
  });
});

describe('normalizePincode', () => {
  it('accepts six digits in the Indian range', () => {
    expect(normalizePincode('110 001').value).toBe('110001');
  });

  it('rejects out-of-range and wrong-length values', () => {
    expect(normalizePincode('910001')).toMatchObject({ value: null, reason: 'RANGE' });
    expect(normalizePincode('0110011')).toMatchObject({ value: null, reason: 'LENGTH' });
  });
});

describe('normalizePan', () => {
  it('uppercases and strips spaces', () => {
    expect(normalizePan(' zzzpd1234q ').value).toBe('ZZZPD1234Q');
  });

  it('rejects malformed PANs', () => {
    expect(normalizePan('ZZZP1234Q')).toMatchObject({ value: null, reason: 'FORMAT' });
  });

  it('format validity is not proof of authenticity — it only checks shape', () => {
    expect(isPanFormatValid('AAAAA0000A')).toBe(true);
  });
});

describe('normalizeIfsc', () => {
  it('accepts a well-formed IFSC', () => {
    expect(normalizeIfsc('sbin0001234').value).toBe('SBIN0001234');
  });
  it('rejects one without the mandatory 0 in position five', () => {
    expect(normalizeIfsc('SBIN1001234')).toMatchObject({ value: null, reason: 'FORMAT' });
  });
});

describe('aadhaar handling', () => {
  it('recognises a Verhoeff-valid 12-digit run', () => {
    // Checksum-valid by construction for this test. Not a real UIDAI allocation, and it is
    // never stored — only the last four survive extraction.
    expect(looksLikeAadhaar('234567890124')).toBe(true);
    expect(looksLikeAadhaar('2345 6789 0124')).toBe(true);
  });

  it('rejects a checksum-invalid run', () => {
    expect(looksLikeAadhaar('234567890123')).toBe(false);
  });

  it('rejects numbers starting 0 or 1, and wrong lengths', () => {
    expect(looksLikeAadhaar('123456789012')).toBe(false);
    expect(looksLikeAadhaar('012345678901')).toBe(false);
    expect(looksLikeAadhaar('12345678901')).toBe(false);
  });

  it('only ever yields the last four digits', () => {
    expect(aadhaarLastFour('2345 6789 0124')).toBe('0124');
    expect(aadhaarLastFour('012')).toBeNull();
  });
});

describe('parseIndianDate', () => {
  it('reads day-first formats, which is the Indian convention', () => {
    expect(parseIndianDate('03/04/1990').value).toBe('1990-04-03');
    expect(parseIndianDate('3-4-1990').value).toBe('1990-04-03');
    expect(parseIndianDate('03.04.1990').value).toBe('1990-04-03');
  });

  it('reads ISO input unchanged', () => {
    expect(parseIndianDate('1990-04-03').value).toBe('1990-04-03');
  });

  it('reads textual months', () => {
    expect(parseIndianDate('12 Mar 1990').value).toBe('1990-03-12');
    expect(parseIndianDate('12-March-1990').value).toBe('1990-03-12');
  });

  it('expands two-digit years around the 1930 pivot', () => {
    expect(parseIndianDate('01/01/95').value).toBe('1995-01-01');
    expect(parseIndianDate('01/01/05').value).toBe('2005-01-01');
  });

  it('rejects impossible dates instead of rolling them over', () => {
    expect(parseIndianDate('31/02/1990').value).toBeNull();
    expect(parseIndianDate('not a date')).toMatchObject({ reason: 'UNRECOGNISED_FORMAT' });
  });

  it('formats back to Indian display form', () => {
    expect(formatIndianDate('1990-04-03')).toBe('03/04/1990');
  });
});

describe('ageFromDateOfBirth', () => {
  it('derives age and respects the birthday boundary', () => {
    const asOf = new Date(Date.UTC(2026, 3, 2)); // 2 Apr 2026
    expect(ageFromDateOfBirth('1990-04-03', asOf)).toBe(35);
    expect(ageFromDateOfBirth('1990-04-02', asOf)).toBe(36);
  });

  it('returns null for unusable input', () => {
    expect(ageFromDateOfBirth(null)).toBeNull();
    expect(ageFromDateOfBirth('03/04/1990')).toBeNull();
  });
});

describe('misc formatting', () => {
  it('normalises email', () => {
    expect(normalizeEmail('  Demo@Example.COM ').value).toBe('demo@example.com');
    expect(normalizeEmail('not-an-email')).toMatchObject({ valid: false });
  });

  it('formats rupees with lakh grouping', () => {
    expect(formatInr(123456)).toContain('1,23,456');
  });
});
