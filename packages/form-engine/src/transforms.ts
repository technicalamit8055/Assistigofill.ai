/**
 * Named value transforms.
 * Master spec §14.7 (`AdapterField.transform`); docs/FORM_ENGINE.md §7.
 *
 * Every transform is pure and total. The contract that matters:
 *
 *   **A transform never invents data.** If the input cannot be transformed confidently it
 *   returns `null`, the field is skipped with `no_value`, and the operator fills it by hand.
 *   Returning a plausible guess would put a wrong value into a government application.
 */

import {
  aadhaarLastFour,
  formatIndianDate,
  normalizeMobile,
  normalizePincode,
} from '@assistigo/core';

export type Transform = (value: string | null | undefined) => string | null;

function nonEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function isoParts(value: string): [string, string, string] | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return [match[1] as string, match[2] as string, match[3] as string];
}

const GENDER_FULL: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  transgender: 'Transgender',
  other: 'Other',
};

const GENDER_SHORT: Record<string, string> = {
  male: 'M',
  female: 'F',
  transgender: 'T',
  other: 'O',
};

const CATEGORY_CODE: Record<string, string> = {
  general: 'GEN',
  obc: 'OBC',
  sc: 'SC',
  st: 'ST',
  ews: 'EWS',
  other: 'OTHER',
};

const CATEGORY_FULL: Record<string, string> = {
  general: 'General',
  obc: 'OBC',
  sc: 'Scheduled Caste',
  st: 'Scheduled Tribe',
  ews: 'EWS',
  other: 'Other',
};

export const TRANSFORMS: Record<string, Transform> = {
  // --- dates ---------------------------------------------------------------
  /** ISO → 03/04/1990, the format most Indian portals expect. */
  'date.ddmmyyyy': (value) => {
    const input = nonEmpty(value);
    return input ? formatIndianDate(input) : null;
  },
  'date.ddmmyyyy_dash': (value) => {
    const input = nonEmpty(value);
    const parts = input ? isoParts(input) : null;
    return parts ? `${parts[2]}-${parts[1]}-${parts[0]}` : null;
  },
  'date.yyyymmdd': (value) => {
    const input = nonEmpty(value);
    const parts = input ? isoParts(input) : null;
    return parts ? `${parts[0]}${parts[1]}${parts[2]}` : null;
  },
  /** Native <input type="date"> wants ISO. */
  'date.iso': (value) => {
    const input = nonEmpty(value);
    return input && isoParts(input) ? input : null;
  },
  'date.day': (value) => {
    const parts = nonEmpty(value) ? isoParts(String(value).trim()) : null;
    return parts ? parts[2] : null;
  },
  'date.month': (value) => {
    const parts = nonEmpty(value) ? isoParts(String(value).trim()) : null;
    return parts ? parts[1] : null;
  },
  'date.year': (value) => {
    const parts = nonEmpty(value) ? isoParts(String(value).trim()) : null;
    return parts ? parts[0] : null;
  },

  // --- text ----------------------------------------------------------------
  'text.upper': (value) => nonEmpty(value)?.toUpperCase() ?? null,
  'text.lower': (value) => nonEmpty(value)?.toLowerCase() ?? null,
  /**
   * Title case is offered because some portals reject mixed case, but it is never applied to a
   * name by default — §12.5 says names keep the spelling on the document.
   */
  'text.titlecase': (value) => {
    const input = nonEmpty(value);
    if (!input) return null;
    return input
      .split(/\s+/)
      .map((word) => (word[0] ?? '').toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },
  'text.nospace': (value) => nonEmpty(value)?.replace(/\s+/g, '') ?? null,

  // --- identifiers ---------------------------------------------------------
  'mobile.10digit': (value) => normalizeMobile(value).value,
  'mobile.e164': (value) => {
    const digits = normalizeMobile(value).value;
    return digits ? `+91${digits}` : null;
  },
  'pin.6digit': (value) => normalizePincode(value).value,
  'aadhaar.last4': (value) => aadhaarLastFour(value),

  // --- enumerations --------------------------------------------------------
  'gender.full': (value) => {
    const key = nonEmpty(value)?.toLowerCase();
    return key ? (GENDER_FULL[key] ?? null) : null;
  },
  'gender.mf': (value) => {
    const key = nonEmpty(value)?.toLowerCase();
    return key ? (GENDER_SHORT[key] ?? null) : null;
  },
  'category.code': (value) => {
    const key = nonEmpty(value)?.toLowerCase();
    return key ? (CATEGORY_CODE[key] ?? null) : null;
  },
  'category.full': (value) => {
    const key = nonEmpty(value)?.toLowerCase();
    return key ? (CATEGORY_FULL[key] ?? null) : null;
  },

  // --- numbers -------------------------------------------------------------
  /** Strips grouping so "1,20,000" reaches a numeric portal field as "120000". */
  'number.plain': (value) => {
    const input = nonEmpty(value);
    if (!input) return null;
    const digits = input.replace(/[,\s₹]/g, '');
    return /^\d+(\.\d+)?$/.test(digits) ? digits : null;
  },
};

export function applyTransform(name: string | undefined, value: string | null): string | null {
  if (!name) return value;
  const transform = TRANSFORMS[name];
  if (!transform) {
    // An unknown transform means an adapter references something that no longer exists.
    // Skipping is the safe failure: the operator types the field instead of getting a raw value
    // in a format the portal will reject.
    return null;
  }
  return transform(value);
}

export const TRANSFORM_NAMES = Object.keys(TRANSFORMS);
