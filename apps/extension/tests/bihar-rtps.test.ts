/**
 * RTPS Bihar (ServicePlus) — detection → mapping → fill, end to end.
 *
 * This is the acceptance test for the built-in `bihar-rtps-serviceonline` adapter. It runs the
 * real pipeline against a fixture shaped like the portal's income-certificate form, because the
 * failures that matter on this portal are not the ones a unit test on either half would catch:
 *
 *   - "नाम" is a substring of "पिता का नाम", so the applicant's name and their father's name
 *     compete for the same field,
 *   - the portal wants 14/07/1998 and the profile stores 1998-07-14,
 *   - the address block is a dependent dropdown chain,
 *   - and the Aadhaar field wants twelve digits that Assistigo does not have.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BUILT_IN_ADAPTER_BY_SLUG,
  buildFillInstructions,
  dependencyFillOrder,
  proposeMappings,
  selectAdapter,
  type DetectedField,
  type PortalAdapter,
} from '@assistigo/form-engine';
import { collectPageContext, detectFields } from '../src/content/detector';
import { applyFill } from '../src/content/filler';

const FIXTURE = path.resolve(__dirname, 'fixtures/bihar-rtps-income.html');

const ADAPTER = BUILT_IN_ADAPTER_BY_SLUG.get('bihar-rtps-serviceonline') as PortalAdapter;

/** The live portal. Origin and path only — detection never sends the ?serviceId= query. */
const PAGE = {
  origin: 'https://serviceonline.bihar.gov.in',
  path: '/directApply.do',
  title: 'Income Certificate',
  blockedFrames: 0,
};

/** A demo customer. Fake by construction — see docs/DATABASE.md §7. */
const CUSTOMER: Record<string, string> = {
  'customer.full_name': 'Amit Kumar',
  'customer.full_name_hi': 'अमित कुमार',
  'customer.father_name': 'Ram Kumar',
  'customer.mother_name': 'Sunita Devi',
  'customer.spouse_name': 'Rekha Kumari',
  'customer.gender': 'male',
  'customer.date_of_birth': '1998-07-14',
  'customer.mobile': '+91 99000 12345',
  'customer.email': 'demo@example.com',
  'customer.aadhaar': '999988887777',
  'customer.address.village_town_city': 'Rampur',
  'customer.address.post_office': 'Rampur',
  'customer.address.police_station': 'DANAPUR',
  'customer.address.state': 'BIHAR',
  'customer.address.district': 'PATNA',
  'customer.address.block': 'DANAPUR',
  'customer.address.ward': '7',
  'customer.address.pincode': '801 503',
  'customer.annual_income': '1,20,000',
};

function loadFixture(): Document {
  const html = readFileSync(FIXTURE, 'utf8');
  const body = html.slice(html.indexOf('<body'), html.indexOf('</body>'));
  document.body.innerHTML = body.slice(body.indexOf('>') + 1);
  return document;
}

function runPipeline(doc: Document) {
  const detection = { page: { ...collectPageContext(doc), ...PAGE }, fields: detectFields(doc) };
  const adapter = selectAdapter([ADAPTER], detection.page.origin, detection.page.path);
  const proposal = proposeMappings({ detection, customerValues: CUSTOMER, adapter });
  return { detection, adapter, ...proposal };
}

/** Maps `customerField` → the label of the page field it was proposed for. */
function labelByCustomerField(
  mappings: { signature: string; customerField: string | null }[],
  fields: DetectedField[],
): Map<string, string> {
  const labels = new Map(fields.map((field) => [field.signature, field.labelText ?? '']));
  const result = new Map<string, string>();
  for (const mapping of mappings) {
    if (mapping.customerField)
      result.set(mapping.customerField, labels.get(mapping.signature) ?? '');
  }
  return result;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('bihar rtps — adapter selection', () => {
  it('claims the portal by origin, without needing the serviceId query string', () => {
    // All three certificate services live behind ?serviceId=463/464/465 on the same path, and
    // §14.2 forbids transmitting the query string. One adapter has to cover all of them.
    for (const pagePath of [
      '/directApply.do',
      '/citizenServiceHome.do',
      '/renderApplicationForm.do',
    ]) {
      expect(selectAdapter([ADAPTER], PAGE.origin, pagePath)).not.toBeNull();
    }
  });

  it('does not claim an unrelated portal', () => {
    expect(selectAdapter([ADAPTER], 'https://serviceonline.gov.in', '/directApply.do')).toBeNull();
    expect(selectAdapter([ADAPTER], 'https://evil.example', '/directApply.do')).toBeNull();
  });
});

describe('bihar rtps — mapping', () => {
  it('tells the four Hindi name fields apart', () => {
    const { mappings, detection } = runPipeline(loadFixture());
    const byField = labelByCustomerField(mappings, detection.fields);

    // The whole point: "नाम" appears in all four labels, and each must land on its own field.
    expect(byField.get('customer.full_name')).toContain('आवेदक का नाम');
    expect(byField.get('customer.full_name')).not.toContain('पिता');
    expect(byField.get('customer.father_name')).toContain('पिता का नाम');
    expect(byField.get('customer.mother_name')).toContain('माता का नाम');
    expect(byField.get('customer.spouse_name')).toContain('पति का नाम');
  });

  it('separates the applicant name from the Hindi-script version of it', () => {
    const { mappings, detection } = runPipeline(loadFixture());
    const byField = labelByCustomerField(mappings, detection.fields);

    expect(byField.get('customer.full_name_hi')).toContain('हिंदी');
    expect(byField.get('customer.full_name')).not.toContain('हिंदी');
  });

  it('maps the address block, including the Bihar-specific terms', () => {
    const { mappings, detection } = runPipeline(loadFixture());
    const byField = labelByCustomerField(mappings, detection.fields);

    expect(byField.get('customer.address.village_town_city')).toContain('ग्राम');
    expect(byField.get('customer.address.post_office')).toContain('डाक घर');
    expect(byField.get('customer.address.block')).toContain('प्रखंड');
    expect(byField.get('customer.address.police_station')).toContain('थाना');
    expect(byField.get('customer.address.ward')).toContain('वार्ड');
    expect(byField.get('customer.address.pincode')).toContain('पिन कोड');
    expect(byField.get('customer.address.district')).toContain('जिला');
    expect(byField.get('customer.address.state')).toContain('राज्य');
  });

  it('never puts the district into the sub-division dropdown', () => {
    // अनुमंडल sits between district and block in Bihar's hierarchy and has no equivalent in the
    // customer registry. A district name in it is a rejected application, not a cosmetic slip.
    const { mappings, detection } = runPipeline(loadFixture());
    const subDivision = detection.fields.find((field) => field.labelText?.includes('अनुमंडल'));
    expect(subDivision).toBeDefined();

    const mapping = mappings.find((entry) => entry.signature === subDivision?.signature);
    expect(mapping?.customerField).toBeNull();
  });

  it('never puts a state into the local-body-type dropdown', () => {
    const { mappings, detection } = runPipeline(loadFixture());
    const localBody = detection.fields.find((field) => field.labelText?.includes('स्थानीय निकाय'));
    const mapping = mappings.find((entry) => entry.signature === localBody?.signature);
    expect(mapping?.customerField).toBeNull();
  });

  it('maps the annual income and forces a review of it', () => {
    const { mappings, detection } = runPipeline(loadFixture());
    const income = detection.fields.find((field) => field.labelText?.includes('कुल आय'));
    const mapping = mappings.find((entry) => entry.signature === income?.signature);

    expect(mapping?.customerField).toBe('customer.annual_income');
    // High-risk field: it decides eligibility on most schemes (§14.6).
    expect(mapping?.reviewRequired).toBe(true);
  });

  it('maps the Aadhaar field when provided in profile', () => {
    const { mappings, detection } = runPipeline(loadFixture());
    const aadhaar = detection.fields.find((field) => field.labelText?.includes('आधार संख्या'));
    expect(aadhaar).toBeDefined();

    const mapping = mappings.find((entry) => entry.signature === aadhaar?.signature);
    expect(mapping?.customerField).toBe('customer.aadhaar');
  });

  it('classifies the CAPTCHA and OTP fields and refuses them', () => {
    const { mappings, summary } = runPipeline(loadFixture());

    expect(summary.captcha).toBe(1);
    expect(summary.otp).toBe(1);
    for (const mapping of mappings.filter((entry) => entry.safetyClass !== 'normal')) {
      expect(mapping.customerField).toBeNull();
    }
  });
});

/** Every mapping the operator would have been offered, ticked. */
function fillAll(doc: Document) {
  const { mappings, detection, adapter } = runPipeline(doc);
  const approved = new Set(
    mappings
      .filter((mapping) => mapping.customerField && mapping.skipReason === undefined)
      .map((mapping) => mapping.signature),
  );
  const instructions = buildFillInstructions(mappings, CUSTOMER, approved, detection.fields, {
    adapter,
  });
  return { instructions, detection, mappings };
}

describe('bihar rtps — fill', () => {

  it('applies the named transforms the portal needs', async () => {
    const doc = loadFixture();
    const { instructions } = fillAll(doc);
    await applyFill(doc, instructions);

    const valueOf = (id: string) => doc.querySelector<HTMLInputElement>(`#${id}`)?.value;

    expect(valueOf('attr_1003')).toBe('Amit Kumar');
    expect(valueOf('attr_1005')).toBe('Ram Kumar');
    // date.ddmmyyyy — the portal's placeholder says dd/mm/yyyy.
    expect(valueOf('attr_1009')).toBe('14/07/1998');
    // mobile.10digit — "+91 99000 12345" would not fit a maxlength=10 field.
    expect(valueOf('attr_1011')).toBe('9900012345');
    // pin.6digit — the space in "801 503" is the operator's, not the portal's.
    expect(valueOf('attr_2010')).toBe('801503');
    // number.plain — "1,20,000" is rejected by a numeric portal field.
    expect(valueOf('attr_3001')).toBe('120000');
  });

  it('selects dropdown options by their label, across the bilingual text', async () => {
    const doc = loadFixture();
    const { instructions } = fillAll(doc);
    await applyFill(doc, instructions);

    const valueOf = (id: string) => doc.querySelector<HTMLSelectElement>(`#${id}`)?.value;

    expect(valueOf('attr_2003')).toBe('10'); // राज्य → बिहार / BIHAR
    expect(valueOf('attr_2004')).toBe('1006'); // जिला → पटना / PATNA
    expect(valueOf('attr_2006')).toBe('100601'); // प्रखंड → दानापुर / DANAPUR
    expect(valueOf('attr_1008')).toBe('1'); // लिंग → पुरुष / Male, via gender.full
  });

  it('reports the unpopulated sub-division as waiting, never forces a value into it', async () => {
    const doc = loadFixture();
    const { instructions, detection } = fillAll(doc);
    const results = await applyFill(doc, instructions);

    const subDivision = detection.fields.find((field) => field.labelText?.includes('अनुमंडल'));
    expect(doc.querySelector<HTMLSelectElement>('#attr_2005')?.value).toBe('');
    // It was never even instructed, because nothing maps to it.
    expect(results.some((result) => result.signature === subDivision?.signature)).toBe(false);
  });

  it('writes nothing to the CAPTCHA or OTP field even when told to', async () => {
    const doc = loadFixture();
    const { detection } = fillAll(doc);

    const captcha = detection.fields.find((field) => field.id === 'captchaCode');
    const otp = detection.fields.find((field) => field.id === 'otpValue');

    // Bypassing the mapper entirely: this is the executor's own independent refusal (§14.5).
    const results = await applyFill(doc, [
      { signature: captcha?.signature ?? '', value: 'ABC123', inputType: 'text' },
      { signature: otp?.signature ?? '', value: '999999', inputType: 'text' },
    ]);

    expect(doc.querySelector<HTMLInputElement>('#captchaCode')?.value).toBe('');
    expect(doc.querySelector<HTMLInputElement>('#otpValue')?.value).toBe('');
    expect(results.map((result) => result.skipReason)).toEqual(['captcha_field', 'otp_field']);
  });

  it('does not submit the form', async () => {
    const doc = loadFixture();
    let submitted = false;
    doc.querySelector('form')?.addEventListener('submit', () => {
      submitted = true;
    });

    const { instructions } = fillAll(doc);
    await applyFill(doc, instructions);

    expect(submitted).toBe(false);
  });
});

describe('bihar rtps — dependent dropdown order', () => {
  it('writes state before district before block, whatever order the page renders them in', () => {
    const { mappings, detection, adapter } = runPipeline(loadFixture());

    const signatureOf = (label: string) =>
      detection.fields.find((field) => field.labelText?.includes(label))?.signature;

    /*
     * Shuffled on purpose. This fixture happens to render the chain top-down, which would make
     * a DOM-order fill look correct by luck; the guarantee under test is that the adapter's
     * `dependsOn` decides, so the input order has to be wrong for the assertion to mean anything.
     */
    const shuffled = [...mappings].reverse();
    const order = dependencyFillOrder(shuffled, detection.fields, adapter);
    const rank = (label: string) => order.indexOf(signatureOf(label) ?? '');

    expect(rank('राज्य')).toBeLessThan(rank('जिला'));
    expect(rank('जिला')).toBeLessThan(rank('प्रखंड'));
  });

  it('keeps detection order when there is no adapter to ask', () => {
    const { mappings, detection } = runPipeline(loadFixture());
    const order = dependencyFillOrder(mappings, detection.fields, null);
    expect(order).toEqual(mappings.map((mapping) => mapping.signature));
  });
});
