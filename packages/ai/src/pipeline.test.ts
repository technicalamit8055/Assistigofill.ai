/**
 * Golden extraction tests.
 * Master spec §23.1 — fake documents in, expected fields out, with confidence bands asserted.
 *
 * These are the regression net for the extractor: a rule change that quietly stops finding a
 * father's name shows up here rather than in a customer's profile.
 */

import { describe, expect, it } from 'vitest';
import { DEMO_DOCUMENTS, DEMO_DOCUMENT_BY_CODE } from './fixtures';
import { containsAadhaarLikeNumber } from './safety';
import { extractionStatus, runExtraction } from './pipeline';
import { MockOcrProvider } from './providers/mock';

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function extractDemo(code: string) {
  const document = DEMO_DOCUMENT_BY_CODE.get(code);
  if (!document) throw new Error(`unknown fixture: ${code}`);
  return runExtraction({
    bytes: bytesOf(document.text),
    mimeType: document.mimeType,
    filename: document.filename,
    provider: new MockOcrProvider(),
  });
}

describe.each(DEMO_DOCUMENTS.filter((document) => Object.keys(document.expected).length > 0))(
  'golden extraction: $code',
  (fixture) => {
    it('classifies the document correctly', async () => {
      const { extraction } = await extractDemo(fixture.code);
      expect(extraction.documentType).toBe(fixture.documentType);
    });

    it('extracts every expected field with the expected value', async () => {
      const { extraction } = await extractDemo(fixture.code);
      const byKey = new Map(extraction.fields.map((field) => [field.key, field.value]));

      for (const [key, expected] of Object.entries(fixture.expected)) {
        expect(byKey.get(key), `field ${key}`).toBe(expected);
      }
    });

    it('never emits a field outside the customer field registry', async () => {
      const { extraction } = await extractDemo(fixture.code);
      for (const field of extraction.fields) {
        expect(field.key.startsWith('customer.')).toBe(true);
      }
    });
  },
);

describe('father vs applicant name', () => {
  it("never resolves the applicant's own name from a father's-name label", async () => {
    // The single most damaging extraction error: it files the wrong person (§14.4).
    const { extraction } = await extractDemo('aadhaar_like');
    const fullName = extraction.fields.find((field) => field.key === 'customer.full_name');
    const fatherName = extraction.fields.find((field) => field.key === 'customer.father_name');

    expect(fullName?.value).toBe('Sunita Devi');
    expect(fatherName?.value).toBe('Ram Prasad');
  });

  it('handles a Hindi-only father label', async () => {
    const { extraction } = await runExtraction({
      bytes: bytesOf('आधार\nनाम : सुनीता देवी\nपिता का नाम : राम प्रसाद'),
      mimeType: 'application/pdf',
      filename: 'hindi.pdf',
      hintedType: 'aadhaar_like',
      provider: new MockOcrProvider(),
    });

    const byKey = new Map(extraction.fields.map((field) => [field.key, field.value]));
    expect(byKey.get('customer.full_name')).toBe('सुनीता देवी');
    expect(byKey.get('customer.father_name')).toBe('राम प्रसाद');
  });
});

describe('review rules (§12.6)', () => {
  it('always marks high-risk fields for review however confident the extractor is', async () => {
    const { extraction } = await extractDemo('aadhaar_like');

    for (const key of ['customer.date_of_birth', 'customer.aadhaar_last4']) {
      const found = extraction.fields.find((field) => field.key === key);
      expect(found?.status, key).toBe('needs_review');
      expect(found?.reviewReason, key).toBe('high_risk_field');
    }
  });

  it('reports the document as review_required when any field needs a human', async () => {
    const { extraction } = await extractDemo('pan');
    expect(extractionStatus(extraction)).toBe('review_required');
  });

  it('gives every field a reason when it asks for review', async () => {
    const { extraction } = await extractDemo('income_certificate');
    for (const field of extraction.fields) {
      if (field.status === 'needs_review') expect(field.reviewReason).not.toBeNull();
      else expect(field.reviewReason).toBeNull();
    }
  });
});

describe('Aadhaar handling', () => {
  it('produces only the last four, never the full number', async () => {
    const { extraction, rawText } = await extractDemo('aadhaar_like');
    const aadhaar = extraction.fields.find((field) => field.key === 'customer.aadhaar_last4');

    expect(aadhaar?.value).toBe('0000');
    for (const field of extraction.fields) {
      expect(containsAadhaarLikeNumber(field.value), `value of ${field.key}`).toBe(false);
      expect(containsAadhaarLikeNumber(field.sourceText), `source of ${field.key}`).toBe(false);
    }
    expect(containsAadhaarLikeNumber(rawText)).toBe(false);
  });

  it('does not claim an unlabelled 12-digit run that fails the checksum', async () => {
    // A transaction reference that happens to be twelve digits is not an Aadhaar.
    const { extraction } = await runExtraction({
      bytes: bytesOf('UNIQUE IDENTIFICATION AUTHORITY\nReference 2000 0000 0000'),
      mimeType: 'application/pdf',
      filename: 'ref.pdf',
      provider: new MockOcrProvider(),
    });
    expect(extraction.fields.find((field) => field.key === 'customer.aadhaar_last4')).toBeUndefined();
  });
});

describe('document class scoping', () => {
  it('does not extract an address from a PAN card', async () => {
    const { extraction } = await extractDemo('pan');
    expect(extraction.fields.some((field) => field.key.startsWith('customer.address.'))).toBe(false);
  });

  it('does not extract a Class 10 board from an income certificate', async () => {
    const { extraction } = await extractDemo('income_certificate');
    expect(extraction.fields.some((field) => field.key.startsWith('customer.education.'))).toBe(
      false,
    );
  });
});

describe('unreadable and empty input', () => {
  it('classifies a text-free image as a photo rather than inventing fields', async () => {
    const { extraction } = await runExtraction({
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      mimeType: 'image/jpeg',
      filename: 'demo-passport-photo.jpg',
      provider: new MockOcrProvider(),
    });

    expect(extraction.documentType).toBe('photo');
    expect(extraction.fields).toEqual([]);
    expect(extraction.confidence).toBeNull();
  });

  it('returns unknown, with a warning, for a PDF it cannot place', async () => {
    const { extraction } = await runExtraction({
      bytes: bytesOf('Some entirely unrelated prose about nothing in particular at all.'),
      mimeType: 'application/pdf',
      filename: 'mystery.pdf',
      provider: new MockOcrProvider(),
    });

    expect(extraction.documentType).toBe('unknown');
    expect(extraction.warnings.map((warning) => warning.code)).toContain('UNKNOWN_DOCUMENT_TYPE');
  });
});

describe('AI provider opt-in (§12.3)', () => {
  it('falls back to the local provider and warns when the org has not opted in', async () => {
    const offBox = {
      name: 'pretend-cloud',
      sendsDataOffBox: true,
      extract: () => {
        throw new Error('must not run without org opt-in');
      },
    };

    const { extraction } = await runExtraction({
      bytes: bytesOf(DEMO_DOCUMENT_BY_CODE.get('pan')?.text ?? ''),
      mimeType: 'image/jpeg',
      filename: 'demo-pan.jpg',
      aiProcessingEnabled: false,
      provider: offBox,
    });

    expect(extraction.provider).toBe('mock');
    expect(extraction.warnings.map((warning) => warning.code)).toContain(
      'AI_PROCESSING_NOT_ENABLED',
    );
  });
});
