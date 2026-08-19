/**
 * Validation and normalisation for Indian customer data.
 * Master spec §12.5.
 *
 * Guiding rule: normalisation must never *invent* data and must never destroy the original.
 * When a value cannot be normalised confidently the function returns `null` so the caller can
 * fall back to the value as printed on the document.
 */

/** Zero-width and BOM characters that sneak in from PDF copy-paste. */
const ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g');

/**
 * Latin letters, the Devanagari block (U+0900–U+097F) and whitespace are kept.
 * The range deliberately spans Devanagari combining marks (matras) — a name's vowel signs are
 * part of the name, so keeping them is the point.
 */
// eslint-disable-next-line no-misleading-character-class
const NON_NAME_CHARS = new RegExp('[^a-z\\u0900-\\u097F\\s]', 'g');

export type NormalizedValue<T = string> = {
  /** Normalised form, or null when the input could not be understood. */
  value: T | null;
  /** Exactly what was passed in, preserved for display and provenance. */
  original: string;
  valid: boolean;
  /** Machine-readable reason when `valid` is false. */
  reason?: string;
};

function result(original: string, value: string | null, reason?: string): NormalizedValue {
  return reason ? { value, original, valid: false, reason } : { value, original, valid: true };
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/**
 * Names are preserved as written (§11.1, §12.5): we only collapse whitespace and strip
 * zero-width characters. No title-casing, no transliteration, no reordering into
 * first/last — Indian names do not reliably split that way.
 */
export function normalizeName(input: string | null | undefined): NormalizedValue {
  const original = input ?? '';
  const cleaned = original.replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
  if (cleaned === '') return result(original, null, 'EMPTY');
  return result(original, cleaned);
}

/** Loose comparison key for duplicate detection. Never stored, never displayed. */
export function nameComparisonKey(name: string): string {
  return name.toLowerCase().replace(NON_NAME_CHARS, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Mobile
// ---------------------------------------------------------------------------

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Returns the bare 10-digit Indian mobile number, dropping +91 / 0 / 91 prefixes. */
export function normalizeMobile(input: string | null | undefined): NormalizedValue {
  const original = input ?? '';
  let digits = original.replace(/\D+/g, '');
  if (digits === '') return result(original, null, 'EMPTY');

  if (digits.length > 10) {
    if (digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  }
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length !== 10) return result(original, null, 'LENGTH');
  if (!INDIAN_MOBILE.test(digits)) return result(original, null, 'PREFIX');
  return result(original, digits);
}

export function toE164Mobile(input: string | null | undefined): string | null {
  const { value } = normalizeMobile(input);
  return value ? `+91${value}` : null;
}

/** Display form used across the dashboard: 98765 43210 */
export function formatMobile(input: string | null | undefined): string | null {
  const { value } = normalizeMobile(input);
  return value ? `${value.slice(0, 5)} ${value.slice(5)}` : null;
}

// ---------------------------------------------------------------------------
// PIN code
// ---------------------------------------------------------------------------

export function normalizePincode(input: string | null | undefined): NormalizedValue {
  const original = input ?? '';
  const digits = original.replace(/\D+/g, '');
  if (digits === '') return result(original, null, 'EMPTY');
  if (digits.length !== 6) return result(original, null, 'LENGTH');
  // Indian PIN codes never start with 0 or 9.
  if (!/^[1-8]\d{5}$/.test(digits)) return result(original, null, 'RANGE');
  return result(original, digits);
}

// ---------------------------------------------------------------------------
// PAN
// ---------------------------------------------------------------------------

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Format check only. A well-formed PAN is NOT proof that the PAN exists or belongs to the
 * customer (§12.5) — never present this as verification.
 */
export function normalizePan(input: string | null | undefined): NormalizedValue {
  const original = input ?? '';
  const candidate = original.replace(/\s+/g, '').toUpperCase();
  if (candidate === '') return result(original, null, 'EMPTY');
  if (!PAN_PATTERN.test(candidate)) return result(original, null, 'FORMAT');
  return result(original, candidate);
}

export function isPanFormatValid(value: string): boolean {
  return PAN_PATTERN.test(value.replace(/\s+/g, '').toUpperCase());
}

// ---------------------------------------------------------------------------
// IFSC
// ---------------------------------------------------------------------------

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeIfsc(input: string | null | undefined): NormalizedValue {
  const original = input ?? '';
  const candidate = original.replace(/\s+/g, '').toUpperCase();
  if (candidate === '') return result(original, null, 'EMPTY');
  if (!IFSC_PATTERN.test(candidate)) return result(original, null, 'FORMAT');
  return result(original, candidate);
}

// ---------------------------------------------------------------------------
// Aadhaar-like identifiers
// ---------------------------------------------------------------------------

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const;

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const;

/**
 * Verhoeff checksum, used by UIDAI. We use it ONLY to decide whether a 12-digit run on a
 * document is likely an Aadhaar number, so that the extractor knows to keep just the last four
 * and discard the rest (§19.3). We never store or return the full number from this module.
 */
export function looksLikeAadhaar(input: string): boolean {
  const digits = input.replace(/\D+/g, '');
  if (digits.length !== 12) return false;
  if (digits.startsWith('0') || digits.startsWith('1')) return false;

  let checksum = 0;
  const reversed = [...digits].reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    const digit = Number(reversed[i]);
    const p = VERHOEFF_P[i % 8]?.[digit] ?? 0;
    checksum = VERHOEFF_D[checksum]?.[p] ?? 0;
  }
  return checksum === 0;
}

/**
 * The only Aadhaar-derived value Assistigo retains. Everything else is dropped at the
 * extraction boundary.
 */
export function aadhaarLastFour(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D+/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function iso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parses the date formats that actually appear on Indian documents and portals and returns an
 * ISO date string. Ambiguous day/month pairs are resolved as DAY FIRST, which is the Indian
 * convention — an American reading would silently corrupt dates like 03/04/1990.
 */
export function parseIndianDate(input: string | null | undefined): NormalizedValue {
  const original = input ?? '';
  const text = original.trim();
  if (text === '') return result(original, null, 'EMPTY');

  // yyyy-mm-dd / yyyy/mm/dd
  const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch as unknown as [string, string, string, string];
    const year = Number(y),
      month = Number(m),
      day = Number(d);
    return isRealDate(year, month, day)
      ? result(original, iso(year, month, day))
      : result(original, null, 'INVALID_DATE');
  }

  // dd-mm-yyyy / dd/mm/yyyy / dd.mm.yyyy, also 2-digit years
  const dmyMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch as unknown as [string, string, string, string];
    const day = Number(d);
    const month = Number(m);
    let year = Number(y);
    if (y.length === 2) year = year > 30 ? 1900 + year : 2000 + year;
    return isRealDate(year, month, day)
      ? result(original, iso(year, month, day))
      : result(original, null, 'INVALID_DATE');
  }

  // 12 Mar 1990 / 12-March-1990
  const textualMatch = text.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s-,]+(\d{4})$/);
  if (textualMatch) {
    const [, d, monthName, y] = textualMatch as unknown as [string, string, string, string];
    const month = MONTHS[monthName.toLowerCase()];
    if (!month) return result(original, null, 'UNKNOWN_MONTH');
    const day = Number(d),
      year = Number(y);
    return isRealDate(year, month, day)
      ? result(original, iso(year, month, day))
      : result(original, null, 'INVALID_DATE');
  }

  return result(original, null, 'UNRECOGNISED_FORMAT');
}

/** Indian display format. The database always holds ISO. */
export function formatIndianDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match as unknown as [string, string, string, string];
  return `${d}/${m}/${y}`;
}

/**
 * Age is always derived, never stored as a primary value (§11.2), because a stored age is wrong
 * the day after it is written.
 */
export function ageFromDateOfBirth(
  isoDate: string | null | undefined,
  asOf = new Date(),
): number | null {
  if (!isoDate) return null;
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match as unknown as [string, string, string, string];
  const birth = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number.isNaN(birth.getTime())) return null;

  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function normalizeEmail(input: string | null | undefined): NormalizedValue {
  const original = input ?? '';
  const candidate = original.trim().toLowerCase();
  if (candidate === '') return result(original, null, 'EMPTY');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(candidate)) return result(original, null, 'FORMAT');
  return result(original, candidate);
}

/** Indian currency display: 1,23,456 (lakh grouping), not 123,456. */
export function formatInr(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
