/**
 * Classification tests.
 * Master spec §12.2 — `unknown` is a first-class result, not a failure.
 */

import { describe, expect, it } from 'vitest';
import { classifyDocument } from './classify';
import { DEMO_DOCUMENT_BY_CODE } from './fixtures';

function classify(text: string, filename = 'file.pdf', mimeType = 'application/pdf') {
  return classifyDocument({ text, filename, mimeType });
}

describe('classifyDocument', () => {
  it('recognises issuing-authority boilerplate', () => {
    expect(classify('INCOME TAX DEPARTMENT — Permanent Account Number').documentType).toBe('pan');
    expect(classify('भारत निर्वाचन आयोग / Election Commission of India').documentType).toBe(
      'voter_id',
    );
  });

  it('uses the filename when the text is unhelpful', () => {
    const result = classify('scanned page', 'sunita-caste-certificate.pdf');
    expect(result.documentType).toBe('caste_certificate');
  });

  it('returns unknown rather than guessing when nothing matches', () => {
    const result = classify('A shopping list: rice, dal, oil, and two kilos of onions.');
    expect(result.documentType).toBe('unknown');
    expect(result.confidence).toBeLessThan(0.45);
  });

  it('returns unknown when two classes are neck and neck', () => {
    // 10th and 12th marksheets from the same board share most of their boilerplate; picking by
    // sort order would be a coin flip presented as a decision.
    const result = classify(
      'BOARD OF HIGH SCHOOL AND INTERMEDIATE EDUCATION\n' +
        'SECONDARY SCHOOL EXAMINATION\nSENIOR SECONDARY EXAMINATION',
    );
    expect(result.documentType).toBe('unknown');
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('never reports full confidence', () => {
    const document = DEMO_DOCUMENT_BY_CODE.get('income_certificate');
    const result = classify(document?.text ?? '');
    expect(result.confidence).toBeLessThan(1);
    expect(result.confidence).toBeGreaterThan(0.45);
  });

  it('treats the operator hint as evidence, not an instruction', () => {
    const withoutHint = classifyDocument({
      text: 'blank page',
      filename: 'scan.pdf',
      mimeType: 'application/pdf',
    });
    const withHint = classifyDocument({
      text: 'blank page',
      filename: 'scan.pdf',
      mimeType: 'application/pdf',
      hintedType: 'income_certificate',
    });

    expect(withoutHint.documentType).toBe('unknown');
    // The hint alone lifts it above the floor, but strong page evidence would still outrank it.
    expect(withHint.documentType).toBe('income_certificate');

    const contradicted = classifyDocument({
      text: 'INCOME TAX DEPARTMENT\nPermanent Account Number\nस्थायी लेखा संख्या',
      filename: 'scan.pdf',
      mimeType: 'application/pdf',
      hintedType: 'caste_certificate',
    });
    expect(contradicted.documentType).toBe('pan');
  });

  it('classifies a text-free image as a photo or signature by filename', () => {
    expect(classify('', 'my-signature.png', 'image/png').documentType).toBe('signature');
    expect(classify('', 'passport-photo.jpg', 'image/jpeg').documentType).toBe('photo');
    expect(classify('', 'IMG_4821.jpg', 'image/jpeg').documentType).toBe('photo');
  });

  it('offers runners-up so the review UI can suggest alternatives', () => {
    const result = classify('आय प्रमाण पत्र\nवार्षिक आय\nनिवास प्रमाण पत्र');
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives[0]?.confidence).toBeLessThanOrEqual(result.confidence);
  });
});
