import { describe, expect, it } from 'vitest';
import { applyCustomerValuesSchema, parseTextSchema } from './text-import';

/**
 * The parse step persists nothing, so unlike document review there is no stored extraction for
 * the write route to check a decision against. These schemas are therefore the first gate on
 * values that arrive straight from a browser, and the invariants below are what the route
 * relies on before it touches a profile.
 */

describe('parseTextSchema', () => {
  it('accepts pasted text', () => {
    expect(parseTextSchema.parse({ text: 'Name: Amit Kumar' }).text).toBe('Name: Amit Kumar');
  });

  it('rejects empty text', () => {
    expect(parseTextSchema.safeParse({ text: '' }).success).toBe(false);
  });

  it('rejects a body far larger than any real paste', () => {
    expect(parseTextSchema.safeParse({ text: 'x'.repeat(100_000) }).success).toBe(false);
  });
});

describe('applyCustomerValuesSchema', () => {
  it('accepts a decision carrying a value', () => {
    const parsed = applyCustomerValuesSchema.parse({
      decisions: [
        { fieldKey: 'customer.full_name', action: 'accept', value: 'Amit Kumar', confidence: 0.95 },
      ],
    });

    expect(parsed.decisions[0]?.value).toBe('Amit Kumar');
  });

  it('requires a value on accept, because nothing was stored to fall back to', () => {
    // Document review can read the value off the stored extraction. This route cannot, so an
    // `accept` with no value is a client bug that must not reach the writer.
    expect(
      applyCustomerValuesSchema.safeParse({
        decisions: [{ fieldKey: 'customer.full_name', action: 'accept' }],
      }).success,
    ).toBe(false);
  });

  it('requires a value on edit', () => {
    expect(
      applyCustomerValuesSchema.safeParse({
        decisions: [{ fieldKey: 'customer.full_name', action: 'edit', value: '   ' }],
      }).success,
    ).toBe(false);
  });

  it('allows reject without a value', () => {
    expect(
      applyCustomerValuesSchema.safeParse({
        decisions: [{ fieldKey: 'customer.pan', action: 'reject' }],
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown action', () => {
    expect(
      applyCustomerValuesSchema.safeParse({
        decisions: [{ fieldKey: 'customer.full_name', action: 'overwrite', value: 'x' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty or oversized decision list', () => {
    expect(applyCustomerValuesSchema.safeParse({ decisions: [] }).success).toBe(false);
    expect(
      applyCustomerValuesSchema.safeParse({
        decisions: Array.from({ length: 201 }, () => ({
          fieldKey: 'customer.full_name',
          action: 'accept' as const,
          value: 'Amit Kumar',
        })),
      }).success,
    ).toBe(false);
  });

  it('rejects a confidence outside 0–1', () => {
    expect(
      applyCustomerValuesSchema.safeParse({
        decisions: [
          { fieldKey: 'customer.full_name', action: 'accept', value: 'Amit Kumar', confidence: 2 },
        ],
      }).success,
    ).toBe(false);
  });
});
