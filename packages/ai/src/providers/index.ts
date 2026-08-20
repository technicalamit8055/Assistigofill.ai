/**
 * OCR provider registry.
 * Master spec §12.3 — "Never hard-code the product to a single provider."
 *
 * Selected by the `OCR_PROVIDER` environment variable. `mock` is the default and the only
 * provider available offline, so a developer who has configured nothing still gets a working
 * pipeline.
 */

import { providerUnavailable } from '@assistigo/core';
import type { OcrProvider } from '../types';
import { MockOcrProvider } from './mock';

export const OCR_PROVIDER_NAMES = ['mock', 'tesseract', 'anthropic'] as const;
export type OcrProviderName = (typeof OCR_PROVIDER_NAMES)[number];

export function isOcrProviderName(value: unknown): value is OcrProviderName {
  return typeof value === 'string' && (OCR_PROVIDER_NAMES as readonly string[]).includes(value);
}

const mock = new MockOcrProvider();

/**
 * Resolves a provider by name.
 *
 * `tesseract` and `anthropic` are declared in the spec but not implemented in this phase.
 * They fail loudly rather than falling through to the mock: silently substituting a mock in
 * staging would turn "OCR is misconfigured" into "OCR is mysteriously bad", which is far
 * harder to diagnose.
 */
export function getOcrProvider(name: string = 'mock'): OcrProvider {
  switch (name) {
    case 'mock':
      return mock;
    case 'tesseract':
    case 'anthropic':
      throw providerUnavailable('errors.ocr_provider_not_configured');
    default:
      throw providerUnavailable('errors.ocr_provider_unknown');
  }
}

export { MockOcrProvider };
