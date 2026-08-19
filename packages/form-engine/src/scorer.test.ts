import { describe, expect, it } from 'vitest';
import { bestMatch, scoreField } from './scorer';
import { normalizeLabel, type DictionaryEntry } from './dictionary';
import { CONFIDENCE, type DetectedField } from './types';

function field(overrides: Partial<DetectedField>): DetectedField {
  return {
    signature: 'sig',
    tagName: 'input',
    inputType: 'text',
    name: null,
    id: null,
    placeholder: null,
    labelText: null,
    ariaLabel: null,
    nearbyText: null,
    sectionHeading: null,
    options: null,
    required: false,
    maxLength: null,
    pattern: null,
    hasValue: false,
    visible: true,
    disabled: false,
    readOnly: false,
    frame: 0,
    order: 0,
    ...overrides,
  };
}

describe('normalizeLabel', () => {
  it('folds the separator styles portals actually use', () => {
    expect(normalizeLabel('applicant_name')).toBe('applicant name');
    expect(normalizeLabel('applicantName')).toBe('applicant name');
    expect(normalizeLabel('Applicant-Name')).toBe('applicant name');
    expect(normalizeLabel("Father's Name *")).toBe('fathers name');
  });

  it('leaves Devanagari untouched', () => {
    expect(normalizeLabel('पिता का नाम')).toBe('पिता का नाम');
  });
});

describe('scoreField — signal strength', () => {
  it('scores an exact label match highest', () => {
    const match = bestMatch(field({ labelText: 'Full Name' }));
    expect(match?.customerField).toBe('customer.full_name');
    expect(match?.signal).toBe('label_exact');
    expect(match?.score).toBeGreaterThanOrEqual(CONFIDENCE.high);
  });

  it('scores an attribute match below an exact label but still in the fill band', () => {
    const match = bestMatch(field({ name: 'applicant_name' }));
    expect(match?.customerField).toBe('customer.full_name');
    expect(match?.score).toBeGreaterThanOrEqual(CONFIDENCE.high);
  });

  it('scores nearby text well below a label, landing it in review', () => {
    const match = bestMatch(field({ nearbyText: 'Please enter the annual income below' }));
    expect(match?.customerField).toBe('customer.annual_income');
    expect(match?.score).toBeLessThan(CONFIDENCE.high);
  });

  it('penalises an incompatible input type', () => {
    const asDate = bestMatch(field({ labelText: 'Date of Birth', inputType: 'date' }));
    const asCheckbox = bestMatch(field({ labelText: 'Date of Birth', inputType: 'checkbox' }));
    expect(asCheckbox!.score).toBeLessThan(asDate!.score);
  });

  it('returns nothing when the field resembles no known customer field', () => {
    expect(bestMatch(field({ labelText: 'Preferred exam centre code' }))).toBeNull();
  });
});

describe('scoreField — negative keywords', () => {
  it('rejects candidates whose vetoes appear in the field naming', () => {
    const candidates = scoreField(field({ labelText: "Mother's Name" })).map(
      (candidate) => candidate.customerField,
    );
    expect(candidates).toContain('customer.mother_name');
    expect(candidates).not.toContain('customer.full_name');
    expect(candidates).not.toContain('customer.father_name');
  });

  it('does not let a section heading veto a correct mapping', () => {
    // On a form where "Father's Details" is the heading above a plain "Name" field, the heading
    // must not reject `customer.full_name` outright — the operator sees a review prompt instead.
    const candidates = scoreField(
      field({ labelText: 'Name', sectionHeading: "Father's Details" }),
    ).map((candidate) => candidate.customerField);
    expect(candidates).toContain('customer.full_name');
  });

  it('does not confuse "Panchayat" with PAN', () => {
    const match = bestMatch(field({ labelText: 'Gram Panchayat', name: 'panchayat' }));
    expect(match?.customerField).toBe('customer.address.panchayat');
  });

  it('does not confuse "Status" with State', () => {
    const candidates = scoreField(field({ labelText: 'Marital Status', name: 'marital_status' }));
    expect(candidates[0]?.customerField).toBe('customer.marital_status');
    expect(candidates.map((c) => c.customerField)).not.toContain('customer.address.state');
  });
});

describe('scoreField — ambiguity', () => {
  /** Two entries that are indistinguishable for a field labelled exactly "Reference". */
  const TIED_DICTIONARY: DictionaryEntry[] = [
    { customerField: 'customer.certificate.caste.number', synonyms: ['reference'] },
    { customerField: 'customer.certificate.income.number', synonyms: ['reference'] },
  ];

  it('demotes a tied winner into the review band rather than guessing', () => {
    const candidates = scoreField(field({ labelText: 'Reference' }), TIED_DICTIONARY);
    expect(candidates).toHaveLength(2);
    // Both matched with identical strength, so the top score must not claim high confidence.
    expect(candidates[0]!.score).toBeLessThan(CONFIDENCE.medium);
  });

  it('leaves an unambiguous winner at full strength', () => {
    const candidates = scoreField(field({ labelText: 'Full Name' }));
    expect(candidates[0]!.score).toBeGreaterThanOrEqual(CONFIDENCE.high);
  });
});
