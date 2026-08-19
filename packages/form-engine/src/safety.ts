/**
 * Safety classification — the hard rules.
 * Master spec §14.5, §14.8, §19.7. See docs/DEVELOPMENT_RULES.md §1.
 *
 * Assistigo must never:
 *   - read or solve a CAPTCHA,
 *   - retrieve or enter an OTP,
 *   - autofill payment credentials,
 *   - click a final submit control.
 *
 * These predicates are the single place those rules are expressed. Both the server-side mapper
 * and the content script consult them, so a field has to get past the same check twice before
 * anything is typed into it.
 *
 * Design note: these are deliberately over-eager. A false positive costs the operator one
 * manually typed field. A false negative means Assistigo typed into a CAPTCHA box or clicked
 * "Pay now". Those are not comparable, so ambiguity always resolves to "skip".
 *
 * Misclassifying a CAPTCHA as an OTP (or vice versa) is harmless — both are skipped, and the
 * operator is told to fill it themselves either way.
 */

import type { SafetyClass } from './types';

/** Everything a classifier may look at. A subset of DetectedField, so DOM callers can use it too. */
export type ClassifiableField = {
  inputType?: string | null;
  name?: string | null;
  id?: string | null;
  className?: string | null;
  placeholder?: string | null;
  labelText?: string | null;
  ariaLabel?: string | null;
  nearbyText?: string | null;
  autocomplete?: string | null;
  maxLength?: number | null;
};

function haystack(field: ClassifiableField): string {
  return (
    [
      field.inputType,
      field.name,
      field.id,
      field.className,
      field.placeholder,
      field.labelText,
      field.ariaLabel,
      field.nearbyText,
      field.autocomplete,
    ]
      .filter((part): part is string => typeof part === 'string' && part !== '')
      .join(' ')
      .toLowerCase()
      // Separators between words vary wildly across portals: captcha_code, captchaCode, captcha-code.
      .replace(/[_\-.]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function matchesAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

// ---------------------------------------------------------------------------
// CAPTCHA
// ---------------------------------------------------------------------------

const CAPTCHA_MARKERS = [
  'captcha',
  'recaptcha',
  'hcaptcha',
  'h captcha',
  'turnstile',
  'funcaptcha',
  'arkose',
  'securimage',
  'image code',
  'code shown',
  'code in the image',
  'code from image',
  // Portals phrase this as "enter the text shown", "type the text shown", "text shown below"…
  'text shown',
  'verification image',
  'i am not a robot',
  'not a robot',
  'कैप्चा',
  'चित्र में दिया कोड',
  'सुरक्षा कोड',
] as const;

export function isCaptchaField(field: ClassifiableField): boolean {
  return matchesAny(haystack(field), CAPTCHA_MARKERS);
}

// ---------------------------------------------------------------------------
// OTP
// ---------------------------------------------------------------------------

const OTP_MARKERS = [
  'otp',
  'one time password',
  'onetime password',
  'one time pin',
  'verification code',
  'verify code',
  'verification pin',
  'auth code',
  'authentication code',
  'security pin',
  'mpin',
  'sms code',
  'ओटीपी',
  'सत्यापन कोड',
  'एकबारगी पासवर्ड',
] as const;

/**
 * `otp` also appears inside unrelated words, so it is matched as a whole token rather than a
 * substring — otherwise a field called "adoption_status" would be classified as an OTP.
 */
const OTP_TOKEN = /\botp\b/;

export function isOtpField(field: ClassifiableField): boolean {
  const text = haystack(field);
  if (OTP_TOKEN.test(text)) return true;
  return matchesAny(
    text,
    OTP_MARKERS.filter((marker) => marker !== 'otp'),
  );
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

const PAYMENT_MARKERS = [
  'card number',
  'cardnumber',
  'credit card',
  'debit card',
  'cc number',
  'cvv',
  'cvc',
  'csc',
  'card verification',
  'expiry',
  'expiration',
  'exp month',
  'exp year',
  'card holder',
  'cardholder',
  'name on card',
  'upi id',
  'upi pin',
  'vpa',
  'virtual payment address',
  'net banking password',
  'netbanking password',
  'transaction password',
  'atm pin',
  'card pin',
  'कार्ड नंबर',
  'सीवीवी',
  'यूपीआई',
] as const;

/** `autocomplete` is the most reliable signal a browser gives us about a payment field. */
const PAYMENT_AUTOCOMPLETE = [
  'cc-number',
  'cc-name',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'cc-type',
] as const;

export function isPaymentField(field: ClassifiableField): boolean {
  const autocomplete = (field.autocomplete ?? '').toLowerCase();
  if (PAYMENT_AUTOCOMPLETE.some((token) => autocomplete.includes(token))) return true;
  return matchesAny(haystack(field), PAYMENT_MARKERS);
}

// ---------------------------------------------------------------------------
// Submit controls
// ---------------------------------------------------------------------------

const SUBMIT_INPUT_TYPES = ['submit', 'image', 'reset'] as const;

const SUBMIT_TEXTS = [
  'submit',
  'final submit',
  'save and submit',
  'save & submit',
  'proceed',
  'proceed to pay',
  'confirm',
  'confirm and pay',
  'pay now',
  'make payment',
  'continue to payment',
  'place order',
  'agree and submit',
  'जमा करें',
  'सबमिट',
  'आगे बढ़ें',
  'भुगतान करें',
  'पुष्टि करें',
] as const;

/**
 * Anything that could commit the application.
 *
 * `text` is the control's visible label. The content script also refuses to click anything at
 * all, so this is the second line of defence rather than the first.
 */
export function isSubmitControl(control: {
  tagName?: string | null;
  inputType?: string | null;
  text?: string | null;
  name?: string | null;
  id?: string | null;
}): boolean {
  const type = (control.inputType ?? '').toLowerCase();
  if ((SUBMIT_INPUT_TYPES as readonly string[]).includes(type)) return true;

  const tag = (control.tagName ?? '').toLowerCase();
  if (tag === 'button' && type !== 'button') {
    // A <button> with no explicit type submits its form by default.
    return true;
  }

  const text = [control.text, control.name, control.id]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return matchesAny(text, SUBMIT_TEXTS);
}

// ---------------------------------------------------------------------------
// Combined classification
// ---------------------------------------------------------------------------

/**
 * Order matters only for the label the operator sees; every non-normal class is skipped.
 * Payment is checked first because a CVV field is often also labelled "security code", and
 * "payment field" is the more useful thing to tell the operator.
 */
export function classifyField(field: ClassifiableField): SafetyClass {
  if (isPaymentField(field)) return 'payment';
  if (isCaptchaField(field)) return 'captcha';
  if (isOtpField(field)) return 'otp';
  if (isSubmitControl({ inputType: field.inputType, name: field.name, id: field.id })) {
    return 'submit';
  }
  return 'normal';
}

export function isFillable(safetyClass: SafetyClass): boolean {
  return safetyClass === 'normal';
}

/** Input types Assistigo knows how to fill (§14.5). Everything else is skipped, not guessed at. */
const SUPPORTED_INPUT_TYPES = [
  'text',
  'email',
  'tel',
  'number',
  'date',
  'search',
  'url',
  'select-one',
  'select-multiple',
  'radio',
  'checkbox',
  'textarea',
  '',
] as const;

export function isSupportedInputType(inputType: string): boolean {
  return (SUPPORTED_INPUT_TYPES as readonly string[]).includes(inputType.toLowerCase());
}

/**
 * File inputs cannot be set programmatically — browsers forbid it, and rightly so. The
 * extension surfaces a matching prepared file and the operator picks it (§7.4.5).
 */
export function isFileInput(inputType: string): boolean {
  return inputType.toLowerCase() === 'file';
}

/** Password fields are never filled: Assistigo does not store portal credentials. */
export function isPasswordField(inputType: string): boolean {
  return inputType.toLowerCase() === 'password';
}
