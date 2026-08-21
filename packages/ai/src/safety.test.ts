/**
 * Safety regression tests.
 * docs/DEVELOPMENT_RULES.md §1 rule 5 — full Aadhaar numbers are never stored.
 *
 * These guard a product rule, not an implementation detail. Do not weaken them.
 */

import { describe, expect, it } from 'vitest';
import {
  containsAadhaarLikeNumber,
  maskIdentifiersInText,
  sanitizeExtractedFields,
  sanitizeRawText,
} from './safety';
import type { ExtractedField } from './types';

function field(overrides: Partial<ExtractedField> = {}): ExtractedField {
  return {
    key: 'customer.full_name',
    label: 'Name',
    value: 'Sunita Devi',
    confidence: 0.9,
    sourceText: 'Name : Sunita Devi',
    page: 1,
    bbox: null,
    status: 'ok',
    reviewReason: null,
    ...overrides,
  };
}

describe('maskIdentifiersInText', () => {
  it.each([
    ['2000 0000 0000', 'XXXX XXXX 0000'],
    ['200000000000', 'XXXX XXXX 0000'],
    ['2000-0000-0000', 'XXXX XXXX 0000'],
  ])('masks %s down to the last four', (input, expected) => {
    expect(maskIdentifiersInText(input)).toBe(expected);
  });

  it('masks an Aadhaar-like number embedded in a sentence', () => {
    expect(maskIdentifiersInText('आधार संख्या : 2000 0000 0000 जारी')).toBe(
      'आधार संख्या : XXXX XXXX 0000 जारी',
    );
  });

  it('masks numbers that fail the Verhoeff check too', () => {
    // Deliberately broader than looksLikeAadhaar(): a mistyped Aadhaar is still an Aadhaar we
    // must not store.
    expect(maskIdentifiersInText('1111 1111 1111')).toBe('XXXX XXXX 1111');
  });

  it('leaves shorter and longer digit runs alone', () => {
    expect(maskIdentifiersInText('Roll Number : 1234567')).toBe('Roll Number : 1234567');
    expect(maskIdentifiersInText('Txn 1234567890123456')).toBe('Txn 1234567890123456');
    expect(maskIdentifiersInText('PIN 261001')).toBe('PIN 261001');
  });

  it('does not mangle a PAN', () => {
    expect(maskIdentifiersInText('ZZZPD1234Q')).toBe('ZZZPD1234Q');
  });
});

describe('containsAadhaarLikeNumber', () => {
  it('is stateless across calls', () => {
    // The underlying regex is /g, so a leaked lastIndex would make every other call wrong.
    expect(containsAadhaarLikeNumber('2000 0000 0000')).toBe(true);
    expect(containsAadhaarLikeNumber('2000 0000 0000')).toBe(true);
    expect(containsAadhaarLikeNumber('no numbers here')).toBe(false);
  });
});

describe('sanitizeExtractedFields', () => {
  it('reduces an Aadhaar value to its last four', () => {
    const [result] = sanitizeExtractedFields([
      field({ key: 'customer.aadhaar_last4', value: '2000 0000 0000' }),
    ]);
    expect(result?.value).toBe('0000');
  });

  it('masks the source snippet so the full number is never persisted', () => {
    const [result] = sanitizeExtractedFields([
      field({
        key: 'customer.aadhaar_last4',
        value: '0000',
        sourceText: 'आधार संख्या / Aadhaar Number : 2000 0000 0000',
      }),
    ]);
    expect(result?.sourceText).toBe('आधार संख्या / Aadhaar Number : XXXX XXXX 0000');
    expect(containsAadhaarLikeNumber(result?.sourceText ?? '')).toBe(false);
  });

  it('retains fields keyed to customer.aadhaar for auto-fill', () => {
    const result = sanitizeExtractedFields([
      field({ key: 'customer.aadhaar', value: '200000000000' }),
    ]);
    expect(result.length).toBe(1);
    expect(result[0]?.key).toBe('customer.aadhaar');
    expect(result[0]?.value).toBe('200000000000');
  });

  it('drops an Aadhaar value too short to be a last-four', () => {
    expect(sanitizeExtractedFields([field({ key: 'customer.aadhaar_last4', value: '12' })])).toEqual(
      [],
    );
  });

  it('masks an Aadhaar that leaked into an unrelated field', () => {
    const [result] = sanitizeExtractedFields([
      field({ key: 'customer.address.printed', value: 'Rampur, ID 2000 0000 0000' }),
    ]);
    expect(result?.value).toBe('Rampur, ID XXXX XXXX 0000');
  });

  it('leaves ordinary fields untouched', () => {
    const [result] = sanitizeExtractedFields([field()]);
    expect(result?.value).toBe('Sunita Devi');
    expect(result?.sourceText).toBe('Name : Sunita Devi');
  });
});

describe('sanitizeRawText', () => {
  it('masks identifiers and bounds the length', () => {
    const text = sanitizeRawText('Aadhaar : 2000 0000 0000');
    expect(text).toBe('Aadhaar : XXXX XXXX 0000');
    expect(sanitizeRawText('x'.repeat(50_000)).length).toBe(20_000);
  });
});
