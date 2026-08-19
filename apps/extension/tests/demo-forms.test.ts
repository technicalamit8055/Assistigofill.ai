/**
 * End-to-end pipeline test against the real demo forms.
 *
 * Loads the actual HTML an operator would open, runs detection → mapping → fill, and asserts
 * the whole chain. This is the closest thing to the Phase 4 acceptance criteria (§15.5) that
 * can run without a browser, and it catches regressions a unit test on either half would miss.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildFillInstructions, proposeMappings } from '@assistigo/form-engine';
import { collectPageContext, detectFields } from '../src/content/detector';
import { applyFill } from '../src/content/filler';

const DEMO_DIR = path.resolve(__dirname, '../../web/public/demo-forms');

function loadForm(file: string): Document {
  const html = readFileSync(path.join(DEMO_DIR, file), 'utf8');
  const body = html.slice(html.indexOf('<body'), html.indexOf('</body>'));
  document.body.innerHTML = body.slice(body.indexOf('>') + 1);
  return document;
}

/** A demo customer. Fake by construction — see docs/DATABASE.md §7. */
const CUSTOMER = {
  'customer.full_name': 'Amit Kumar',
  'customer.father_name': 'Ram Kumar',
  'customer.mother_name': 'Sunita Devi',
  'customer.date_of_birth': '1998-07-14',
  'customer.gender': 'male',
  'customer.category': 'obc',
  'customer.mobile': '9900012345',
  'customer.email': 'demo@example.com',
  'customer.address.house_number': '12',
  'customer.address.village_town_city': 'Rampur',
  'customer.address.post_office': 'Rampur',
  'customer.address.police_station': 'Danapur',
  'customer.address.district': 'Patna',
  'customer.address.state': 'Bihar',
  'customer.address.pincode': '801503',
  'customer.address.printed': '12, Rampur, Danapur, Patna, Bihar 801503',
  'customer.education.class10.board': 'BSEB',
  'customer.education.class10.roll_number': '10023451',
  'customer.education.class10.passing_year': '2014',
  'customer.annual_income': '120000',
  'customer.pan': 'ZZZPD1234Q',
};

function runPipeline(doc: Document) {
  const detection = { page: collectPageContext(doc), fields: detectFields(doc) };
  const proposal = proposeMappings({ detection, customerValues: CUSTOMER });
  return { detection, ...proposal };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('demo form — certificate application', () => {
  it('maps the core applicant fields', () => {
    const { mappings } = runPipeline(loadForm('certificate.html'));
    const byField = new Map(
      mappings.filter((m) => m.customerField).map((m) => [m.customerField, m]),
    );

    for (const key of [
      'customer.full_name',
      'customer.father_name',
      'customer.mother_name',
      'customer.date_of_birth',
      'customer.mobile',
      'customer.email',
      'customer.address.pincode',
    ]) {
      expect(byField.has(key), `expected ${key} to be mapped`).toBe(true);
    }
  });

  it('reads labels out of the table layout', () => {
    const { mappings } = runPipeline(loadForm('certificate.html'));
    const fields = mappings.map((m) => m.customerField);
    // "District" and "State" only have labels in the previous table cell.
    expect(fields).toContain('customer.address.district');
    expect(fields).toContain('customer.address.state');
  });

  it('actually fills the form when the operator approves everything', async () => {
    const doc = loadForm('certificate.html');
    const { detection, mappings } = runPipeline(doc);

    const approved = new Set(
      mappings.filter((m) => m.customerField && !m.skipReason).map((m) => m.signature),
    );
    const instructions = buildFillInstructions(mappings, CUSTOMER, approved, detection.fields);
    const results = await applyFill(doc, instructions);

    expect(results.length).toBeGreaterThan(6);
    expect(results.every((result) => result.action === 'filled')).toBe(true);

    expect((doc.getElementById('applicantName') as HTMLInputElement).value).toBe('Amit Kumar');
    expect((doc.getElementById('fatherName') as HTMLInputElement).value).toBe('Ram Kumar');
    // Transformed to the Indian display format the portal asks for.
    expect((doc.getElementById('dob') as HTMLInputElement).value).toBe('14/07/1998');
    expect((doc.getElementById('mobile') as HTMLInputElement).value).toBe('9900012345');
    expect((doc.getElementById('pincode') as HTMLInputElement).value).toBe('801503');
  });

  it('does not submit the form', async () => {
    const doc = loadForm('certificate.html');
    const { detection, mappings } = runPipeline(doc);

    let submitted = false;
    doc.getElementById('certificate-form')?.addEventListener('submit', () => {
      submitted = true;
    });

    const approved = new Set(mappings.map((m) => m.signature));
    await applyFill(doc, buildFillInstructions(mappings, CUSTOMER, approved, detection.fields));

    expect(submitted).toBe(false);
  });
});

describe('demo form — scholarship application (Hindi/English)', () => {
  it('maps Hindi labels to the right customer fields', () => {
    const { mappings } = runPipeline(loadForm('scholarship.html'));
    const fields = mappings.map((m) => m.customerField);

    expect(fields).toContain('customer.full_name'); // आवेदक का नाम
    expect(fields).toContain('customer.father_name'); // पिता का नाम
    expect(fields).toContain('customer.mother_name'); // माता का नाम
    expect(fields).toContain('customer.date_of_birth'); // जन्म तिथि
    expect(fields).toContain('customer.mobile'); // मोबाइल नंबर
  });

  it('refuses the CAPTCHA and OTP boxes', () => {
    const { mappings, summary } = runPipeline(loadForm('scholarship.html'));

    expect(summary.captcha).toBeGreaterThanOrEqual(1);
    expect(summary.otp).toBeGreaterThanOrEqual(1);

    const blocked = mappings.filter((m) => m.safetyClass !== 'normal');
    for (const mapping of blocked) {
      expect(mapping.customerField).toBeNull();
    }
  });

  it('leaves the CAPTCHA and OTP inputs empty after a fill', async () => {
    const doc = loadForm('scholarship.html');
    const { detection, mappings } = runPipeline(doc);

    // Approve everything, including the fields that must be refused.
    const approved = new Set(detection.fields.map((field) => field.signature));
    await applyFill(doc, buildFillInstructions(mappings, CUSTOMER, approved, detection.fields));

    expect((doc.getElementById('captchaInput') as HTMLInputElement).value).toBe('');
    expect((doc.getElementById('otpInput') as HTMLInputElement).value).toBe('');
  });

  it('always sends the category field to review, even though it maps confidently', () => {
    const { mappings } = runPipeline(loadForm('scholarship.html'));
    const category = mappings.find((m) => m.customerField === 'customer.category');
    expect(category?.reviewRequired).toBe(true);
  });
});

describe('demo form — recruitment application', () => {
  it('does not attempt to set file inputs', () => {
    const { mappings, detection } = runPipeline(loadForm('recruitment.html'));
    const fileFields = detection.fields.filter((field) => field.inputType === 'file');
    expect(fileFields.length).toBe(2);

    for (const field of fileFields) {
      const mapping = mappings.find((m) => m.signature === field.signature);
      expect(mapping?.skipReason).toBe('unsupported_type');
    }
  });

  it('sends PAN to review because it is high risk', () => {
    const { mappings } = runPipeline(loadForm('recruitment.html'));
    const pan = mappings.find((m) => m.customerField === 'customer.pan');
    expect(pan?.reviewRequired).toBe(true);
  });

  it('reports the district dropdown as not ready rather than forcing it', async () => {
    const doc = loadForm('recruitment.html');
    const { detection, mappings } = runPipeline(doc);

    const districtField = detection.fields.find((field) => field.name === 'district');
    expect(districtField).toBeDefined();

    const results = await applyFill(doc, [
      { signature: districtField!.signature, value: 'Patna', inputType: 'select-one' },
    ]);

    // The demo form only populates districts after the state changes, and nothing has changed
    // it here — so the fill must decline rather than invent a value.
    expect(results[0]).toMatchObject({ action: 'skipped', skipReason: 'dependent_not_ready' });
    expect(mappings.length).toBeGreaterThan(0);
  }, 10_000);
});

describe('demo form — unsupported form', () => {
  it('does not break on a form it has no adapter for', () => {
    const { summary } = runPipeline(loadForm('unsupported.html'));
    expect(summary.detected).toBeGreaterThan(0);
  });

  it('leaves the opaque fields unmapped rather than guessing at them', () => {
    const { detection, mappings } = runPipeline(loadForm('unsupported.html'));

    // f1–f5 are labelled "Particulars of the applicant", "Parentage", "Ref. No.", and so on:
    // recognisable to a clerk, meaningless to a dictionary.
    const opaque = detection.fields.filter((field) => /^f[1-5]$/.test(field.name ?? ''));
    expect(opaque.length).toBe(5);

    for (const field of opaque) {
      const mapping = mappings.find((m) => m.signature === field.signature);
      const guessedBlindly =
        mapping?.customerField !== null &&
        mapping?.reviewRequired === false &&
        mapping?.skipReason === undefined;
      expect(guessedBlindly, `${field.name} was filled without confirmation`).toBe(false);
    }
  });

  it('still maps the two fields that are named plainly (§9.6 — guided fill is offered)', () => {
    const { mappings } = runPipeline(loadForm('unsupported.html'));
    const fields = mappings.map((m) => m.customerField);
    expect(fields).toContain('customer.address.printed'); // "Correspondence Address"
    expect(fields).toContain('customer.mobile'); // "Contact Number"
  });
});
