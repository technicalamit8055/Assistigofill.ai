/**
 * The wire contract between the content script, the background worker and the mapping API.
 * Master spec §14.2.
 *
 * The single most important property of this schema: it carries **field metadata, never
 * customer values**. `hasValue` says whether a field is already filled; it never says with
 * what. Proposed values travel in the opposite direction, once, at fill time.
 */

import { z } from 'zod';

export const SAFETY_CLASSES = ['normal', 'captcha', 'otp', 'payment', 'submit'] as const;
export type SafetyClass = (typeof SAFETY_CLASSES)[number];

export const MAPPING_SOURCES = [
  'adapter',
  'org_custom',
  'history',
  'dictionary',
  'ai',
  'manual',
] as const;
export type MappingSource = (typeof MAPPING_SOURCES)[number];

export const fieldOptionSchema = z.object({
  value: z.string().max(300),
  label: z.string().max(300),
});
export type FieldOption = z.infer<typeof fieldOptionSchema>;

/** Nearby text is capped hard: a whole paragraph of page content is not metadata. */
const NEARBY_TEXT_MAX = 120;

export const detectedFieldSchema = z.object({
  /** Stable identity for this field across detections of the same form. */
  signature: z.string().min(1).max(200),
  tagName: z.enum(['input', 'select', 'textarea']),
  inputType: z.string().max(40),
  name: z.string().max(200).nullable(),
  id: z.string().max(200).nullable(),
  placeholder: z.string().max(200).nullable(),
  labelText: z.string().max(300).nullable(),
  ariaLabel: z.string().max(300).nullable(),
  nearbyText: z.string().max(NEARBY_TEXT_MAX).nullable(),
  sectionHeading: z.string().max(200).nullable(),
  options: z.array(fieldOptionSchema).max(500).nullable(),
  required: z.boolean(),
  maxLength: z.number().int().positive().nullable(),
  pattern: z.string().max(300).nullable(),
  /** Whether the field already holds something — never what it holds. */
  hasValue: z.boolean(),
  visible: z.boolean(),
  disabled: z.boolean(),
  readOnly: z.boolean(),
  /** Index of the frame the field was found in; 0 is the top document. */
  frame: z.number().int().min(0).default(0),
  /** Index within the detected set, used to keep review order stable. */
  order: z.number().int().min(0),
});

export type DetectedField = z.infer<typeof detectedFieldSchema>;

export const pageContextSchema = z.object({
  /** Origin plus path only. Query strings can carry PII and are never transmitted. */
  origin: z.string().max(300),
  path: z.string().max(500),
  title: z.string().max(300).nullable(),
  /** Frames that could not be read because they are cross-origin. */
  blockedFrames: z.number().int().min(0).default(0),
});

export type PageContext = z.infer<typeof pageContextSchema>;

export const detectionPayloadSchema = z.object({
  page: pageContextSchema,
  fields: z.array(detectedFieldSchema).max(500),
  extensionVersion: z.string().max(30).optional(),
});

export type DetectionPayload = z.infer<typeof detectionPayloadSchema>;

/** A single proposed mapping, before the operator has looked at it. */
export type FieldMapping = {
  signature: string;
  customerField: string | null;
  source: MappingSource | null;
  /** 0–1. */
  confidence: number;
  reviewRequired: boolean;
  safetyClass: SafetyClass;
  /** Named transform from transforms.ts, applied to the customer value before filling. */
  transform?: string;
  /** Why this field will not be filled, when it will not be. */
  skipReason?: SkipReason;
};

export const SKIP_REASONS = [
  'captcha_field',
  'otp_field',
  'payment_field',
  'submit_control',
  'no_mapping',
  'no_value',
  'already_filled',
  'not_visible',
  'disabled',
  'readonly',
  'unsupported_type',
  'dependent_not_ready',
  'operator_skipped',
  'low_confidence',
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export const SKIP_REASON_LABELS: Record<SkipReason, { en: string; hi: string }> = {
  captcha_field: { en: 'CAPTCHA — fill this yourself', hi: 'कैप्चा — इसे खुद भरें' },
  otp_field: { en: 'OTP — fill this yourself', hi: 'ओटीपी — इसे खुद भरें' },
  payment_field: { en: 'Payment field — never filled', hi: 'भुगतान फ़ील्ड — कभी नहीं भरा जाता' },
  submit_control: { en: 'Submit button — never clicked', hi: 'सबमिट बटन — कभी नहीं दबाया जाता' },
  no_mapping: { en: 'No matching customer field', hi: 'कोई मेल खाता फ़ील्ड नहीं' },
  no_value: { en: 'Customer has no value for this', hi: 'ग्राहक के पास यह जानकारी नहीं है' },
  already_filled: { en: 'Already filled', hi: 'पहले से भरा है' },
  not_visible: { en: 'Not visible on the page', hi: 'पेज पर दिखाई नहीं देता' },
  disabled: { en: 'Disabled', hi: 'निष्क्रिय' },
  readonly: { en: 'Read-only', hi: 'केवल पढ़ने योग्य' },
  unsupported_type: { en: 'Field type not supported', hi: 'यह फ़ील्ड प्रकार समर्थित नहीं' },
  dependent_not_ready: { en: 'Waiting on an earlier dropdown', hi: 'पिछले ड्रॉपडाउन का इंतज़ार' },
  operator_skipped: { en: 'You skipped this', hi: 'आपने इसे छोड़ा' },
  low_confidence: { en: 'Needs your confirmation', hi: 'आपकी पुष्टि चाहिए' },
};

/** What the content script is told to do, per field. Values appear only here. */
export const fillInstructionSchema = z.object({
  signature: z.string(),
  value: z.string().max(2000),
  inputType: z.string(),
});
export type FillInstruction = z.infer<typeof fillInstructionSchema>;

export const FILL_ACTIONS = ['filled', 'skipped', 'edited', 'failed'] as const;
export type FillAction = (typeof FILL_ACTIONS)[number];

export const fillResultSchema = z.object({
  signature: z.string(),
  action: z.enum(FILL_ACTIONS),
  skipReason: z.enum(SKIP_REASONS).nullable().optional(),
  error: z.string().max(300).nullable().optional(),
});
export type FillResult = z.infer<typeof fillResultSchema>;

export const CONFIDENCE = {
  high: 0.9,
  medium: 0.7,
} as const;

export type ConfidenceBand = 'high' | 'medium' | 'low';

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= CONFIDENCE.high) return 'high';
  if (score >= CONFIDENCE.medium) return 'medium';
  return 'low';
}
