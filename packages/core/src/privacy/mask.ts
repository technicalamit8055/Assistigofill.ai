/**
 * Display masking for sensitive identifiers.
 * Master spec §11.1, §19.3, §27.5 — masked by default, reveal is an explicit audited action.
 *
 * These functions are for *display*. They are not a security control on their own:
 * the unmasked value must simply never be sent to a client that lacks
 * `customer.reveal_sensitive`.
 */

const BULLET = '•';

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '');
}

/**
 * Aadhaar-like identifiers. We only ever hold the last four (§19.3), so the input here is
 * normally already just four digits — but accept a longer string defensively and keep the tail.
 */
export function maskAadhaar(lastFourOrFull: string | null | undefined): string | null {
  if (!lastFourOrFull) return null;
  const digits = digitsOnly(lastFourOrFull);
  if (digits.length < 4) return null;
  return `XXXX XXXX ${digits.slice(-4)}`;
}

/** PAN: keep the first three (issuer block) and the last two, mask the identifying middle. */
export function maskPan(pan: string | null | undefined): string | null {
  if (!pan) return null;
  const value = pan.trim().toUpperCase();
  if (value.length !== 10) return `${BULLET.repeat(6)}${value.slice(-2)}`;
  return `${value.slice(0, 3)}${BULLET.repeat(4)}${value.slice(-2)}`;
}

/** Mobile: show the last four only — enough for an operator to confirm the right customer. */
export function maskMobile(mobile: string | null | undefined): string | null {
  if (!mobile) return null;
  const digits = digitsOnly(mobile);
  if (digits.length < 4) return null;
  return `${BULLET.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function maskAccountNumber(account: string | null | undefined): string | null {
  if (!account) return null;
  const value = account.trim();
  if (value.length <= 4) return BULLET.repeat(value.length);
  return `${BULLET.repeat(value.length - 4)}${value.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return BULLET.repeat(email.length);
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 1);
  return `${head}${BULLET.repeat(Math.max(1, local.length - 1))}${domain}`;
}

/**
 * Preview of a name for audit trails and fill-session logs: first letter of each word only.
 * "Amit Kumar Singh" -> "A… K… S…". Enough to debug a mapping, useless as a data leak.
 */
export function maskName(name: string | null | undefined): string | null {
  if (!name) return null;
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `${[...word][0] ?? ''}…`)
      .join(' ') || null
  );
}

/**
 * The value preview stored in `fill_session_fields.proposed_value_preview` (§18.2).
 * Never store the full value: sessions are an audit trail, not a copy of the customer record.
 */
export function previewValue(value: string | null | undefined, maxLength = 12): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return '';
  if (/^\d[\d\s-]*$/.test(trimmed)) return maskMobile(trimmed) ?? BULLET.repeat(4);
  if (trimmed.length <= 3) return `${trimmed[0] ?? ''}…`;
  const head = trimmed.slice(0, Math.min(2, maxLength));
  return `${head}…(${trimmed.length})`;
}

export function maskLast4(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = digitsOnly(value);
  return digits.length >= 4 ? digits.slice(-4) : null;
}
