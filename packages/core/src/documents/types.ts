/**
 * Document domain vocabulary.
 * Master spec §12.2 (classes), §18.2 (documents), §12.7 (retention), §13 (tools).
 */

export const DOCUMENT_TYPES = [
  'aadhaar_like',
  'pan',
  'voter_id',
  'marksheet_10',
  'marksheet_12',
  'caste_certificate',
  'income_certificate',
  'residence_certificate',
  'photo',
  'signature',
  'receipt',
  'application_pdf',
  'generic',
  'unknown',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Narrows a value read back from the database or an API payload.
 *
 * The `documents.document_type` column has a check constraint, but the row types in the app are
 * hand-written, so this is what turns a `string` into a `DocumentType` without a cast.
 */
export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, { en: string; hi: string }> = {
  aadhaar_like: { en: 'Aadhaar-like ID', hi: 'आधार जैसा पहचान पत्र' },
  pan: { en: 'PAN card', hi: 'पैन कार्ड' },
  voter_id: { en: 'Voter ID', hi: 'वोटर आईडी' },
  marksheet_10: { en: 'Class 10 marksheet', hi: 'कक्षा 10 अंकपत्र' },
  marksheet_12: { en: 'Class 12 marksheet', hi: 'कक्षा 12 अंकपत्र' },
  caste_certificate: { en: 'Caste certificate', hi: 'जाति प्रमाण पत्र' },
  income_certificate: { en: 'Income certificate', hi: 'आय प्रमाण पत्र' },
  residence_certificate: { en: 'Residence certificate', hi: 'निवास प्रमाण पत्र' },
  photo: { en: 'Photograph', hi: 'फोटो' },
  signature: { en: 'Signature', hi: 'हस्ताक्षर' },
  receipt: { en: 'Receipt', hi: 'रसीद' },
  application_pdf: { en: 'Application PDF', hi: 'आवेदन पीडीएफ' },
  generic: { en: 'Other document', hi: 'अन्य दस्तावेज़' },
  unknown: { en: 'Unclassified', hi: 'अवर्गीकृत' },
};

/** Document classes that carry identity numbers and must be handled with extra care (§19.3). */
export const HIGH_SENSITIVITY_DOCUMENT_TYPES: readonly DocumentType[] = [
  'aadhaar_like',
  'pan',
  'voter_id',
];

export const DOCUMENT_STATUSES = [
  'uploaded',
  'processing',
  'extracted',
  'review_required',
  'verified',
  'failed',
  'deleted',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const EXTRACTION_STATUSES = [
  'pending',
  'completed',
  'review_required',
  'failed',
  'accepted',
  'rejected',
] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const DERIVATIVE_TOOL_TYPES = ['photo', 'signature', 'pdf'] as const;
export type DerivativeToolType = (typeof DERIVATIVE_TOOL_TYPES)[number];

// ---------------------------------------------------------------------------
// Upload validation
// ---------------------------------------------------------------------------

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export function isAllowedUploadMimeType(mime: string): mime is AllowedUploadMimeType {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Magic-byte prefixes. The client-declared MIME type and the file extension are both
 * attacker-controlled, so the server sniffs the first bytes before accepting an upload
 * (docs/SECURITY.md §4).
 */
export const MAGIC_BYTES: Record<AllowedUploadMimeType, readonly number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // RIFF....WEBP — the middle four bytes are the file size, so they are wildcarded by the caller.
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

export function sniffMimeType(bytes: Uint8Array): AllowedUploadMimeType | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES) as [
    AllowedUploadMimeType,
    readonly number[][],
  ][]) {
    for (const signature of signatures) {
      if (signature.every((byte, index) => bytes[index] === byte)) {
        if (mime === 'image/webp') {
          // Confirm the WEBP fourcc at offset 8 so any RIFF container is not accepted.
          const webp = [0x57, 0x45, 0x42, 0x50];
          if (!webp.every((byte, index) => bytes[8 + index] === byte)) continue;
        }
        return mime;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Storage paths
// ---------------------------------------------------------------------------

export const DOCUMENT_BUCKET = 'customer-documents';
export const DERIVATIVE_BUCKET = 'prepared-files';

/**
 * Paths are org-scoped so a storage policy can be expressed as a simple prefix check and a
 * leaked path from one organization cannot address another's object.
 */
export function documentStoragePath(input: {
  organizationId: string;
  customerId: string | null;
  documentId: string;
  filename: string;
}): string {
  const safeName = sanitizeFilename(input.filename);
  const scope = input.customerId ? `customer/${input.customerId}` : 'unassigned';
  return `org/${input.organizationId}/${scope}/${input.documentId}/${safeName}`;
}

export function derivativeStoragePath(input: {
  organizationId: string;
  derivativeId: string;
  filename: string;
}): string {
  return `org/${input.organizationId}/derivative/${input.derivativeId}/${sanitizeFilename(input.filename)}`;
}

/**
 * Control characters (U+0000–U+001F and U+007F) that must never reach a storage path.
 * Matching them is the entire purpose of this pattern.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

/** Strips directory traversal and control characters from an operator-supplied filename. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base
    .replace(CONTROL_CHARS, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return cleaned === '' ? 'file' : cleaned;
}

/** Signed URLs are short-lived by policy (docs/SECURITY.md §4). */
export const SIGNED_URL_TTL_SECONDS = 300;

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

export const RETENTION_PRESETS = [
  { code: 'keep', months: null, label: { en: 'Keep until deleted', hi: 'हटाने तक रखें' } },
  { code: '12m', months: 12, label: { en: '12 months', hi: '12 महीने' } },
  { code: '24m', months: 24, label: { en: '24 months', hi: '24 महीने' } },
  { code: '36m', months: 36, label: { en: '36 months', hi: '36 महीने' } },
] as const;

export type RetentionPresetCode = (typeof RETENTION_PRESETS)[number]['code'];

export const DEFAULT_RETENTION: RetentionPresetCode = 'keep';
