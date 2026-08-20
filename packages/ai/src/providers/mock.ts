/**
 * Mock OCR provider — the default (docs/AI_PIPELINE.md §2).
 *
 * Deterministic, offline and free, so local development, CI and the demo seed all behave the
 * same way every run. It reads text three ways, in order:
 *
 *   1. the upload is UTF-8 text (how tests and the seed feed it a document),
 *   2. the filename matches one of the demo fixtures,
 *   3. neither — it returns empty text, which the classifier correctly reports as a photo or
 *      an unknown document rather than inventing fields.
 *
 * It never fabricates a value that is not in its input. A mock that guesses would make the
 * review UI look better than the real pipeline, which is the opposite of useful.
 */

import { findDemoDocumentByFilename } from '../fixtures';
import type { OcrInput, OcrProvider, OcrResult } from '../types';

const PRINTABLE_RATIO_FOR_TEXT = 0.85;

/** True when the bytes decode to something that looks like human-readable text. */
function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  let printable = 0;
  for (const byte of sample) {
    // Tab, newline, carriage return, or anything from space upward.
    if (byte === 9 || byte === 10 || byte === 13 || byte >= 32) printable += 1;
  }
  return printable / sample.length >= PRINTABLE_RATIO_FOR_TEXT;
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/**
 * One block per paragraph, so downstream code exercises the multi-block path rather than
 * assuming a single blob. Boxes are synthesised on a nominal A4-ish grid: they are plausible,
 * and nothing in the pipeline treats them as measurements.
 */
function toBlocks(text: string): OcrResult['blocks'] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');

  let y = 60;
  return paragraphs.map((paragraph) => {
    const lineCount = paragraph.split('\n').length;
    const height = lineCount * 18;
    const bbox = [60, y, 760, y + height] as const;
    y += height + 14;
    return { text: paragraph, page: 1, bbox, confidence: 0.97 };
  });
}

export class MockOcrProvider implements OcrProvider {
  readonly name = 'mock';
  /** Runs entirely in-process; no bytes leave the server. */
  readonly sendsDataOffBox = false;

  extract(input: OcrInput): Promise<OcrResult> {
    let text = '';

    if (looksLikeText(input.bytes)) {
      text = decode(input.bytes);
    } else {
      text = findDemoDocumentByFilename(input.filename)?.text ?? '';
    }

    const blocks = toBlocks(text);

    return Promise.resolve({
      provider: this.name,
      // Stable and derived from the input, so re-running a job produces the same audit trail.
      providerRequestId: `mock-${input.filename}`,
      rawText: text,
      pageCount: blocks.length > 0 ? 1 : 0,
      blocks,
      confidence: blocks.length > 0 ? 0.97 : null,
    });
  }
}
