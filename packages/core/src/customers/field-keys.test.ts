import { describe, expect, it } from 'vitest';
import {
  ALWAYS_REVIEW_FIELD_KEYS,
  CUSTOMER_FIELDS,
  CUSTOMER_FIELD_BY_KEY,
  ENCRYPTED_FIELD_KEYS,
  FORBIDDEN_FIELD_KEYS,
  getCustomerField,
  isForbiddenFieldKey,
  isSensitiveField,
  requiresReview,
} from './field-keys';

describe('customer field registry', () => {
  it('has unique keys', () => {
    const keys = CUSTOMER_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every field an English and a Hindi label (§20.3)', () => {
    for (const field of CUSTOMER_FIELDS) {
      expect(field.label.en.trim(), field.key).not.toBe('');
      expect(field.label.hi.trim(), field.key).not.toBe('');
    }
  });

  it('namespaces every key under customer.', () => {
    for (const field of CUSTOMER_FIELDS) {
      expect(field.key.startsWith('customer.'), field.key).toBe(true);
    }
  });

  it('gives every enum field its options', () => {
    for (const field of CUSTOMER_FIELDS) {
      if (field.dataType === 'enum') {
        expect(field.options?.length, field.key).toBeGreaterThan(0);
      }
    }
  });

  it('covers the Indian address model from §11.2', () => {
    for (const part of [
      'house_number',
      'street',
      'village_town_city',
      'ward',
      'post_office',
      'panchayat',
      'block',
      'police_station',
      'district',
      'state',
      'pincode',
      'country',
      'printed',
    ]) {
      expect(CUSTOMER_FIELD_BY_KEY.has(`customer.address.${part}`), part).toBe(true);
      expect(CUSTOMER_FIELD_BY_KEY.has(`customer.permanent_address.${part}`), part).toBe(true);
    }
  });
});

describe('sensitive data rules', () => {
  it('has no storage location anywhere for a full Aadhaar number (§19.3)', () => {
    for (const key of FORBIDDEN_FIELD_KEYS) {
      expect(CUSTOMER_FIELD_BY_KEY.has(key), key).toBe(false);
      expect(isForbiddenFieldKey(key)).toBe(true);
    }
    // The only Aadhaar-derived field is the last four.
    const aadhaarFields = CUSTOMER_FIELDS.filter((f) => f.key.includes('aadhaar'));
    expect(aadhaarFields.map((f) => f.key)).toEqual(['customer.aadhaar_last4']);
    expect(getCustomerField('customer.aadhaar_last4')?.maxLength).toBe(4);
  });

  it('always reviews the high-risk fields listed in §14.6', () => {
    for (const key of [
      'customer.aadhaar_last4',
      'customer.pan',
      'customer.bank.account_number',
      'customer.category',
      'customer.annual_income',
      'customer.date_of_birth',
      'customer.certificate.disability.number',
    ]) {
      expect(requiresReview(key), key).toBe(true);
    }
    expect(requiresReview('customer.full_name')).toBe(false);
  });

  it('encrypts PAN and bank account rather than storing them in a column', () => {
    expect(ENCRYPTED_FIELD_KEYS.has('customer.pan')).toBe(true);
    expect(ENCRYPTED_FIELD_KEYS.has('customer.bank.account_number')).toBe(true);
    expect(getCustomerField('customer.pan')?.storage.kind).toBe('encrypted');
  });

  it('marks contact details sensitive so they are masked by default', () => {
    expect(isSensitiveField('customer.mobile')).toBe(true);
    expect(isSensitiveField('customer.email')).toBe(true);
    expect(isSensitiveField('customer.address.district')).toBe(false);
  });

  it('never stores age as a primary value (§11.2)', () => {
    expect(getCustomerField('customer.age')?.storage.kind).toBe('derived');
  });

  it('every always-review field is also masked', () => {
    for (const key of ALWAYS_REVIEW_FIELD_KEYS) {
      expect(isSensitiveField(key), key).toBe(true);
    }
  });
});
