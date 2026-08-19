import { describe, expect, it } from 'vitest';
import { redact, scrubFreeText, safeLogPayload } from './redact';
import { maskAadhaar, maskMobile, maskPan, maskName, previewValue } from './mask';

const serialize = (value: unknown) => JSON.stringify(value);

describe('redact', () => {
  it('drops sensitive keys but keeps their shape', () => {
    const out = redact({
      customerId: 'c-1',
      full_name: 'Amit Kumar',
      mobile: '9900012345',
      aadhaar_last4: '0000',
      pan: 'ZZZPD1234Q',
    }) as Record<string, unknown>;

    expect(out.customerId).toBe('c-1');
    expect(out.full_name).toBe('[redacted:string:10]');
    expect(out.mobile).toBe('[redacted:string:10]');
    expect(out.aadhaar_last4).toBe('[redacted:string:4]');
    expect(out.pan).toBe('[redacted:string:10]');
  });

  it('never leaks an identifier through a nested structure', () => {
    const out = redact({
      extraction: {
        fields: [
          { key: 'customer.full_name', value: 'Amit Kumar', confidence: 0.98 },
          { key: 'customer.pan', value: 'ZZZPD1234Q', confidence: 0.91 },
        ],
        raw_text: 'Name: Amit Kumar\nPAN: ZZZPD1234Q',
      },
    });

    const json = serialize(out);
    expect(json).not.toContain('Amit');
    expect(json).not.toContain('ZZZPD1234Q');
    // structural information survives, which is what makes the log useful
    expect(json).toContain('customer.full_name');
    expect(json).toContain('0.98');
  });

  it('scrubs identifier-shaped text out of error messages', () => {
    const out = redact(new Error('Failed to parse 9900012345 for aadhaar 1234 5678 9012')) as {
      message: string;
    };
    expect(out.message).not.toMatch(/9900012345/);
    expect(out.message).toContain('[redacted:mobile]');
    expect(out.message).toContain('[redacted:id12]');
  });

  it('does not include a stack trace', () => {
    const out = redact(new Error('boom')) as Record<string, unknown>;
    expect(out.stack).toBeUndefined();
  });

  it('caps arrays and depth so a log line cannot explode', () => {
    const big = Array.from({ length: 50 }, (_, i) => i);
    const out = redact({ items: big }) as { items: unknown[] };
    expect(out.items.length).toBe(21);
    expect(out.items[20]).toBe('[+30 more]');

    const deep = { a: { b: { c: { d: { e: { f: { g: 'too deep' } } } } } } };
    expect(serialize(redact(deep))).toContain('[redacted:depth]');
  });

  it('safeLogPayload keeps the event name readable', () => {
    const line = safeLogPayload('fill.completed', { sessionId: 's-1', full_name: 'Amit Kumar' });
    expect(line.event).toBe('fill.completed');
    expect(line.sessionId).toBe('s-1');
    expect(line.full_name).toBe('[redacted:string:10]');
  });
});

describe('scrubFreeText', () => {
  it('removes PAN, mobile, email and long digit runs', () => {
    const text = scrubFreeText(
      'contact demo@example.com or +91 9900012345, pan ZZZPD1234Q, acct 123456789012',
    );
    expect(text).not.toContain('demo@example.com');
    expect(text).not.toContain('9900012345');
    expect(text).not.toContain('ZZZPD1234Q');
    expect(text).not.toContain('123456789012');
  });
});

describe('masking', () => {
  it('masks aadhaar to last four only', () => {
    expect(maskAadhaar('0000')).toBe('XXXX XXXX 0000');
    expect(maskAadhaar('123456780000')).toBe('XXXX XXXX 0000');
    expect(maskAadhaar(null)).toBeNull();
  });

  it('masks PAN keeping issuer block and tail', () => {
    expect(maskPan('ZZZPD1234Q')).toBe('ZZZ••••4Q');
  });

  it('masks mobile to last four', () => {
    expect(maskMobile('9900012345')).toBe('••••••2345');
  });

  it('reduces a name to initials for audit previews', () => {
    expect(maskName('Amit Kumar Singh')).toBe('A… K… S…');
  });

  it('previews values without revealing them', () => {
    expect(previewValue('Amit Kumar')).toBe('Am…(10)');
    expect(previewValue('9900012345')).toBe('••••••2345');
    expect(previewValue('')).toBe('');
    expect(previewValue(null)).toBeNull();
  });
});
