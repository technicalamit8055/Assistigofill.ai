/**
 * Typed application errors.
 * Master spec §27.3 — user-facing errors are plain and actionable, internal errors carry a
 * trace id, and sensitive values never appear in an error message.
 *
 * `messageKey` is a translation key, not English prose: the API returns the key and the client
 * renders it in the operator's language.
 */

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'ENTITLEMENT_EXCEEDED'
  | 'INVALID_STATUS_TRANSITION'
  | 'UNSUPPORTED_MEDIA'
  | 'PROVIDER_UNAVAILABLE'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  PERMISSION_DENIED: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  ENTITLEMENT_EXCEEDED: 402,
  INVALID_STATUS_TRANSITION: 422,
  UNSUPPORTED_MEDIA: 415,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly messageKey: string;
  /** Extra context for the client. MUST NOT contain customer values. */
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    messageKey: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(messageKey);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.messageKey = messageKey;
    if (options?.details) this.details = options.details;
    if (options?.cause !== undefined) this.cause = options.cause;
  }

  /** Body returned to the client. Deliberately free of internals. */
  toResponseBody(traceId: string): {
    error: {
      code: ErrorCode;
      messageKey: string;
      traceId: string;
      details?: Record<string, unknown>;
    };
  } {
    return {
      error: {
        code: this.code,
        messageKey: this.messageKey,
        traceId,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export const unauthenticated = (key = 'errors.unauthenticated') =>
  new AppError('UNAUTHENTICATED', key);

export const permissionDenied = (
  key = 'errors.permission_denied',
  details?: Record<string, unknown>,
) => new AppError('PERMISSION_DENIED', key, details ? { details } : undefined);

export const notFound = (key = 'errors.not_found') => new AppError('NOT_FOUND', key);

export const validationFailed = (details?: Record<string, unknown>) =>
  new AppError('VALIDATION_FAILED', 'errors.validation_failed', details ? { details } : undefined);

export const conflict = (key: string, details?: Record<string, unknown>) =>
  new AppError('CONFLICT', key, details ? { details } : undefined);

export const entitlementExceeded = (key: string, details?: Record<string, unknown>) =>
  new AppError('ENTITLEMENT_EXCEEDED', key, details ? { details } : undefined);

export const unsupportedMedia = (key = 'errors.unsupported_media') =>
  new AppError('UNSUPPORTED_MEDIA', key);

export const providerUnavailable = (key = 'errors.provider_unavailable') =>
  new AppError('PROVIDER_UNAVAILABLE', key);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Short, non-guessable id used to tie a user-visible error to a server log line. */
export function newTraceId(random: () => number = Math.random): string {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Math.floor(random() * alphabet.length)] ?? '2';
  }
  return out;
}
