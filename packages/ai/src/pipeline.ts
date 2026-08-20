/**
 * The extraction pipeline.
 * Master spec §12.1; docs/AI_PIPELINE.md §1.
 *
 *   upload → OCR → classification → field extraction → normalisation → confidence → (human review)
 *
 * This module stops at the boundary of human review. It proposes; it never writes to a customer
 * profile. Nothing reaches `customers` until an operator accepts it (§12.6, §9.3).
 */

import type { DocumentType } from '@assistigo/core';
import { classifyDocument } from './classify';
import { extractFields, meanConfidence } from './extract';
import { getOcrProvider } from './providers';
import { sanitizeRawText } from './safety';
import type { ExtractionResult, ExtractionWarning, OcrProvider } from './types';

export type RunExtractionInput = {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  filename: string;
  /** The type the operator declared on upload, if any. Evidence, not an instruction. */
  hintedType?: DocumentType | null;
  /** Provider name, normally `OCR_PROVIDER`. */
  providerName?: string;
  /** `organizations.settings.ai_processing_enabled` (§12.3, §19.3). */
  aiProcessingEnabled?: boolean;
  /** Injection point for tests. */
  provider?: OcrProvider;
};

export type RunExtractionOutput = {
  extraction: ExtractionResult;
  /**
   * OCR text with identifiers masked, safe to persist. Retained only until the extraction is
   * reviewed (docs/AI_PIPELINE.md §7).
   */
  rawText: string;
};

export async function runExtraction(input: RunExtractionInput): Promise<RunExtractionOutput> {
  const warnings: ExtractionWarning[] = [];

  let provider = input.provider ?? getOcrProvider(input.providerName);

  // A provider that ships bytes to a third party may not run without the organization having
  // opted in. Falling back to the local provider keeps the operator working; the warning is
  // what tells them why the result is thinner than they expected (docs/AI_PIPELINE.md §2).
  if (provider.sendsDataOffBox && input.aiProcessingEnabled !== true) {
    warnings.push({
      code: 'AI_PROCESSING_NOT_ENABLED',
      messageKey: 'documents.warnings.aiProcessingNotEnabled',
    });
    provider = getOcrProvider('mock');
  }

  const ocr = await provider.extract({
    bytes: input.bytes,
    mimeType: input.mimeType,
    filename: input.filename,
    hintedType: input.hintedType ?? null,
    aiProcessingEnabled: input.aiProcessingEnabled ?? false,
  });

  const classification = classifyDocument({
    text: ocr.rawText,
    filename: input.filename,
    mimeType: input.mimeType,
    hintedType: input.hintedType ?? null,
  });

  if (classification.documentType === 'unknown') {
    warnings.push({
      code: 'UNKNOWN_DOCUMENT_TYPE',
      messageKey: 'documents.warnings.unknownDocumentType',
    });
  }

  const { fields, warnings: extractionWarnings } = extractFields({
    ocr,
    documentType: classification.documentType,
  });

  return {
    extraction: {
      documentType: classification.documentType,
      classificationConfidence: classification.confidence,
      provider: ocr.provider,
      providerRequestId: ocr.providerRequestId,
      fields,
      warnings: [...warnings, ...extractionWarnings],
      confidence: meanConfidence(fields),
    },
    rawText: sanitizeRawText(ocr.rawText),
  };
}

/**
 * The status an extraction row should carry once the pipeline has run (§18.2).
 *
 * `review_required` whenever any field needs a human, which — because every high-risk field is
 * always reviewed — is true for essentially every identity document. That is intended.
 */
export function extractionStatus(result: ExtractionResult): 'completed' | 'review_required' {
  return result.fields.some((field) => field.status === 'needs_review')
    ? 'review_required'
    : 'completed';
}

/** The matching `documents.status` value (§18.2). */
export function documentStatusAfterExtraction(
  result: ExtractionResult,
): 'extracted' | 'review_required' {
  return extractionStatus(result) === 'review_required' ? 'review_required' : 'extracted';
}
