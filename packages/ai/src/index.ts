/**
 * @assistigo/ai — document intelligence: OCR provider abstraction, classification and
 * field extraction.
 *
 * Pure domain logic. No Supabase client, no React, no storage access — the caller hands over
 * bytes and receives proposed fields. Nothing in this package writes to a customer profile;
 * that only ever happens after a human accepts the extraction (master spec §12.6).
 */

export * from './types';
export * from './safety';
export * from './classify';
export * from './rules';
export * from './extract';
export * from './pipeline';
export * from './text';
export * from './fixtures';
export { getOcrProvider, isOcrProviderName, MockOcrProvider, OCR_PROVIDER_NAMES } from './providers';
export type { OcrProviderName } from './providers';
