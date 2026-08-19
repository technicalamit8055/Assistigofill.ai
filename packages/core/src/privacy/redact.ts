/**
 * The only sanctioned way to build a log or error payload.
 * Master spec §19.6, §24.2 — never log Aadhaar/PAN/bank values, raw OCR text, field values,
 * customer names, mobile numbers or emails.
 *
 * Usage:
 *   logger.warn('extraction.failed', redact({ documentId, error, fields }));
 */

/** Key names whose values are dropped entirely, matched case-insensitively as substrings. */
const SENSITIVE_KEY_PATTERNS = [
  'aadhaar',
  'aadhar',
  'pan',
  'account',
  'ifsc',
  'card',
  'cvv',
  'otp',
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'signature',
  'full_name',
  'fullname',
  'father_name',
  'mother_name',
  'spouse_name',
  'guardian_name',
  'mobile',
  'phone',
  'email',
  'address',
  'dob',
  'date_of_birth',
  'income',
  'category',
  'caste',
  'religion',
  'disability',
  'raw_text',
  'rawtext',
  'sourcetext',
  'source_text',
  'value',
  'values',
  'proposed_value',
  'voter',
  'passport',
  'licence',
  'license',
  'ration',
] as const;

/** Keys that are safe and useful to keep verbatim even though they might match above. */
const ALLOWED_KEYS = new Set([
  'valueType',
  'valueCount',
  'sessionId',
  'accountStatus',
  'panelSide',
]);

const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 200;

function isSensitiveKey(key: string): boolean {
  if (ALLOWED_KEYS.has(key)) return false;
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

function describe(value: unknown): string {
  if (value === null) return '[redacted:null]';
  if (Array.isArray(value)) return `[redacted:array:${value.length}]`;
  const type = typeof value;
  if (type === 'string') return `[redacted:string:${(value as string).length}]`;
  if (type === 'number' || type === 'boolean' || type === 'bigint') return `[redacted:${type}]`;
  if (type === 'object') return '[redacted:object]';
  return `[redacted:${type}]`;
}

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      // Error messages can carry interpolated values; keep the type, drop the text.
      message: scrubFreeText(value.message),
      stack: undefined,
    };
  }

  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'string') {
    return scrubFreeText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;

  if (depth >= MAX_DEPTH) return '[redacted:depth]';

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
    return items;
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? describe(child) : redactValue(child, depth + 1);
    }
    return out;
  }

  return describe(value);
}

/**
 * Scrub identifier-shaped substrings out of free text (error messages, notes) and cap length.
 * Deliberately aggressive: a false positive costs a log line's readability, a false negative
 * costs a privacy incident.
 */
export function scrubFreeText(text: string): string {
  const scrubbed = text
    // 12-digit Aadhaar-like runs, with or without separators
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[redacted:id12]')
    // PAN
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[redacted:pan]')
    // Indian mobile numbers, optionally +91 prefixed
    .replace(/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, '[redacted:mobile]')
    // email
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[redacted:email]')
    // long digit runs (account numbers)
    .replace(/\b\d{9,18}\b/g, '[redacted:digits]');

  return scrubbed.length > MAX_STRING_LENGTH
    ? `${scrubbed.slice(0, MAX_STRING_LENGTH)}…[+${scrubbed.length - MAX_STRING_LENGTH}]`
    : scrubbed;
}

/** Redact an arbitrary payload for logging. */
export function redact<T>(payload: T): unknown {
  return redactValue(payload, 0);
}

/** Convenience for building a safe structured log line. */
export function safeLogPayload(
  event: string,
  payload: Record<string, unknown> = {},
): Record<string, unknown> {
  return { event, ...(redact(payload) as Record<string, unknown>) };
}
