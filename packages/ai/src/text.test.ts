/**
 * Golden tests for the pasted-text extractor.
 *
 * Every value here comes from the reserved fake ranges in docs/DATABASE.md §7: mobiles start
 * `99000`, PANs carry the `ZZZ` issuer block, and the Aadhaar-shaped number is the same
 * checksum-invalid one the document fixtures use (docs/AI_PIPELINE.md §8). It is Aadhaar-shaped
 * enough to exercise the masking path and cannot collide with a real allocated number. Do not
 * replace these with more realistic-looking values.
 *
 * The safety expectations in this file are a product rule, not an implementation detail
 * (docs/DEVELOPMENT_RULES.md §1 rule 5). Do not weaken them.
 */

import { describe, expect, it } from 'vitest';
import { extractFromText, splitPastedText, MAX_PASTED_TEXT_LENGTH } from './text';
import type { ExtractedField } from './types';

function byKey(fields: readonly ExtractedField[], key: string): ExtractedField | undefined {
  return fields.find((field) => field.key === key);
}

function valueOf(fields: readonly ExtractedField[], key: string): string | undefined {
  return byKey(fields, key)?.value;
}

describe('splitPastedText', () => {
  it('keeps one labelled pair per line', () => {
    expect(splitPastedText('Name: Amit Kumar\nMobile: 9900012345')).toEqual([
      'Name: Amit Kumar',
      'Mobile: 9900012345',
    ]);
  });

  it('splits a run-on line at separators that start a new label', () => {
    expect(splitPastedText('Name: Amit Kumar, Father Name: Ram Kumar; DOB: 01/01/1990')).toEqual([
      'Name: Amit Kumar',
      'Father Name: Ram Kumar',
      'DOB: 01/01/1990',
    ]);
  });

  it('does not split commas inside a value', () => {
    // The address is the reason the splitter needs a lookahead rather than a bare comma split.
    expect(splitPastedText('Address: H.No 12, Rampur, Ghazipur')).toEqual([
      'Address: H.No 12, Rampur, Ghazipur',
    ]);
  });

  it('pairs a bare label with the value on the next line', () => {
    // What text copied out of a two-column table looks like once the column boundary is gone.
    expect(splitPastedText("Father's Name\nRam Kumar\nDistrict\nGhazipur")).toEqual([
      "Father's Name: Ram Kumar",
      'District: Ghazipur',
    ]);
  });

  it('never pairs two consecutive labels', () => {
    // Pairing these would file "Mobile" as the father's name.
    expect(splitPastedText("Father's Name\nMobile\n9900012345")).toEqual([
      "Father's Name",
      'Mobile: 9900012345',
    ]);
  });

  it('drops blank lines and zero-width characters', () => {
    expect(splitPastedText('​Name:​ Amit Kumar\n\n   \n')).toEqual(['Name: Amit Kumar']);
  });
});

describe('extractFromText', () => {
  it('extracts a plain pasted profile', () => {
    const { fields } = extractFromText({
      text: [
        'Name: Amit Kumar',
        "Father's Name: Ram Kumar",
        'Date of Birth: 14/08/1996',
        'Gender: Male',
        'Mobile: 9900012345',
        'District: Ghazipur',
        'State: Uttar Pradesh',
        'PIN Code: 233001',
      ].join('\n'),
    });

    expect(valueOf(fields, 'customer.full_name')).toBe('Amit Kumar');
    expect(valueOf(fields, 'customer.father_name')).toBe('Ram Kumar');
    // Dates are stored ISO and displayed dd/mm/yyyy (docs/AI_PIPELINE.md §5).
    expect(valueOf(fields, 'customer.date_of_birth')).toBe('1996-08-14');
    expect(valueOf(fields, 'customer.gender')).toBe('male');
    expect(valueOf(fields, 'customer.mobile')).toBe('9900012345');
    expect(valueOf(fields, 'customer.address.district')).toBe('Ghazipur');
    expect(valueOf(fields, 'customer.address.pincode')).toBe('233001');
  });

  it('reads a run-on single-line paste', () => {
    const { fields } = extractFromText({
      text: 'Name: Sunita Devi, Mobile: 9900054321, DOB: 02/03/1988',
    });

    expect(valueOf(fields, 'customer.full_name')).toBe('Sunita Devi');
    expect(valueOf(fields, 'customer.mobile')).toBe('9900054321');
    expect(valueOf(fields, 'customer.date_of_birth')).toBe('1988-03-02');
  });

  it('reads Hindi and Hinglish labels', () => {
    const { fields } = extractFromText({
      text: ['नाम: सुनीता देवी', 'पिता का नाम: राम कुमार', 'मोबाइल: 9900054321'].join('\n'),
    });

    expect(valueOf(fields, 'customer.full_name')).toBe('सुनीता देवी');
    expect(valueOf(fields, 'customer.father_name')).toBe('राम कुमार');
    expect(valueOf(fields, 'customer.mobile')).toBe('9900054321');
  });

  it('accepts an equals separator', () => {
    const { fields } = extractFromText({ text: 'Name = Amit Kumar\nMobile = 9900012345' });

    expect(valueOf(fields, 'customer.full_name')).toBe('Amit Kumar');
    expect(valueOf(fields, 'customer.mobile')).toBe('9900012345');
  });

  it("never resolves a relative's name to the applicant", () => {
    // The single most damaging extraction error there is: it silently files the wrong person.
    const { fields } = extractFromText({
      text: ["Father's Name: Ram Kumar", "Mother's Name: Sita Devi"].join('\n'),
    });

    expect(valueOf(fields, 'customer.full_name')).toBeUndefined();
    expect(valueOf(fields, 'customer.father_name')).toBe('Ram Kumar');
    expect(valueOf(fields, 'customer.mother_name')).toBe('Sita Devi');
  });

  it('opens the whole dictionary, not one document class', () => {
    // A document classified `generic` would yield only name/father/mobile/address. Pasted text
    // is not one document, so an education field must survive alongside a personal one.
    const { fields } = extractFromText({
      text: ['Name: Amit Kumar', 'Class 10 Roll No: 1234567', 'Class 10 Board: CBSE'].join('\n'),
    });

    expect(valueOf(fields, 'customer.education.class10.roll_number')).toBe('1234567');
    expect(valueOf(fields, 'customer.education.class10.board')).toBe('CBSE');
  });

  it('tells class 10 and class 12 apart when both are in scope', () => {
    // The two classes share every printed label ("Board", "Roll No", "Year of Passing"). A
    // document puts only one class in scope so they never collide there; pasted text puts both
    // in scope, so the label has to decide — filing a class 12 board under class 10 would be
    // wrong in a way the operator is unlikely to notice.
    const { fields } = extractFromText({
      text: [
        'Class 10 Board: UP Board',
        'Class 10 Passing Year: 2004',
        'Class 12 Board: CBSE',
        'Class 12 Passing Year: 2006',
      ].join('\n'),
    });

    expect(valueOf(fields, 'customer.education.class10.board')).toBe('UP Board');
    expect(valueOf(fields, 'customer.education.class10.passing_year')).toBe('2004');
    expect(valueOf(fields, 'customer.education.class12.board')).toBe('CBSE');
    expect(valueOf(fields, 'customer.education.class12.passing_year')).toBe('2006');

    for (const field of fields) {
      expect(field.reviewReason).not.toBe('ambiguous_match');
    }
  });

  it('demotes a bare education label into review rather than guessing a class', () => {
    // "Board: CBSE" genuinely does not say which certificate it came from. Review is the honest
    // answer; picking class 10 by sort order is not.
    const field = extractFromText({ text: 'Board: CBSE' }).fields[0];

    expect(field?.status).toBe('needs_review');
    expect(field?.reviewReason).toBe('ambiguous_match');
  });

  it('honours an allowedKeys restriction', () => {
    const { fields } = extractFromText({
      text: 'Name: Amit Kumar\nMobile: 9900012345',
      allowedKeys: ['customer.full_name'],
    });

    expect(fields.map((field) => field.key)).toEqual(['customer.full_name']);
  });

  it('cannot be made to extract a key outside the dictionary', () => {
    const { fields } = extractFromText({
      text: 'Aadhaar Number: 2000 0000 0000',
      allowedKeys: ['customer.aadhaar', 'customer.full_name'],
    });

    expect(fields).toHaveLength(0);
  });

  describe('safety — the Aadhaar rule (§19.3)', () => {
    it('keeps only the last four digits of an Aadhaar-like number', () => {
      const { fields, warnings } = extractFromText({
        text: 'Name: Amit Kumar\nAadhaar Number: 2000 0000 0000',
      });

      expect(valueOf(fields, 'customer.aadhaar_last4')).toBe('0000');
      expect(warnings.map((warning) => warning.code)).toContain('AADHAAR_REMOVED');
    });

    it('never lets a full Aadhaar survive in a value or a source snippet', () => {
      const { fields } = extractFromText({
        text: [
          'Name: Amit Kumar',
          'Aadhaar Number: 2000 0000 0000',
          'Notes: UID is 2000-0000-0000',
          'Address: Near 200000000000 post office',
        ].join('\n'),
      });

      for (const field of fields) {
        expect(field.value).not.toMatch(/\d{4}[\s-]?\d{4}[\s-]?\d{4}/);
        expect(field.sourceText).not.toMatch(/\d{4}[\s-]?\d{4}[\s-]?\d{4}/);
        expect(field.key).not.toBe('customer.aadhaar');
      }
    });

    it('warns about an Aadhaar-like number even when no field matched', () => {
      const { fields, warnings } = extractFromText({ text: '2000 0000 0000' });

      expect(fields).toHaveLength(0);
      expect(warnings.map((warning) => warning.code)).toContain('AADHAAR_REMOVED');
    });
  });

  // --- review gating (§12.6) -----------------------------------------------

  it('always sends a high-risk field to review, however clean the paste', () => {
    const { fields } = extractFromText({
      text: ['PAN: ZZZPD1234Q', 'Date of Birth: 14/08/1996', 'Category: OBC'].join('\n'),
    });

    for (const key of ['customer.pan', 'customer.date_of_birth', 'customer.category']) {
      const field = byKey(fields, key);
      expect(field?.status).toBe('needs_review');
      expect(field?.reviewReason).toBe('high_risk_field');
    }
  });

  it('does not discount confidence for scan quality, because there was no scan', () => {
    const field = byKey(extractFromText({ text: 'Name: Amit Kumar' }).fields, 'customer.full_name');

    // Label quality alone: an exact label match scores 0.95 and is not multiplied down.
    expect(field?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(field?.status).toBe('ok');
  });

  it('reports a value it could not understand rather than storing a guess', () => {
    const { fields, warnings } = extractFromText({ text: 'Mobile: not provided' });

    expect(valueOf(fields, 'customer.mobile')).toBeUndefined();
    expect(warnings.map((warning) => warning.code)).toContain('VALUE_NOT_UNDERSTOOD');
  });

  // --- degenerate input ----------------------------------------------------

  it('returns nothing for empty text', () => {
    const result = extractFromText({ text: '   \n\n  ' });

    expect(result.fields).toEqual([]);
    expect(result.confidence).toBeNull();
    expect(result.warnings.map((warning) => warning.code)).toContain('NO_TEXT');
  });

  it('returns nothing for prose that carries no labels', () => {
    const { fields, warnings } = extractFromText({
      text: 'Please find attached the documents for the scholarship application.',
    });

    expect(fields).toEqual([]);
    expect(warnings.map((warning) => warning.code)).toContain('NO_FIELDS_FOUND');
  });

  it('truncates an oversized paste instead of rejecting it', () => {
    const { fields, warnings } = extractFromText({
      text: `Name: Amit Kumar\n${'x'.repeat(MAX_PASTED_TEXT_LENGTH)}`,
    });

    expect(valueOf(fields, 'customer.full_name')).toBe('Amit Kumar');
    expect(warnings.map((warning) => warning.code)).toContain('TEXT_TRUNCATED');
  });

  it('describes results in paste language, not document language', () => {
    const { warnings } = extractFromText({ text: 'Mobile: 9900012345' });

    for (const warning of warnings) {
      expect(warning.messageKey).not.toContain('documents.warnings.noFieldsFound');
      expect(warning.messageKey).not.toContain('documents.warnings.noNameFound');
    }
  });
});
