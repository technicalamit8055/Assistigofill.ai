import { describe, expect, it } from 'vitest';
import { buildFillInstructions, proposeMappings, type MappingInput } from './mapper';
import type { DetectedField, DetectionPayload } from './types';
import type { PortalAdapter } from './adapters';

let order = 0;

function field(overrides: Partial<DetectedField> & { signature: string }): DetectedField {
  return {
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
    order: order++,
    ...overrides,
  };
}

function detection(fields: DetectedField[]): DetectionPayload {
  return {
    page: {
      origin: 'https://demo.assistigo.test',
      path: '/scholarship/apply',
      title: 'Scholarship application',
      blockedFrames: 0,
    },
    fields,
  };
}

const CUSTOMER = {
  'customer.full_name': 'Amit Kumar',
  'customer.father_name': 'Ram Kumar',
  'customer.mobile': '9900012345',
  'customer.date_of_birth': '1990-04-03',
  'customer.gender': 'male',
  'customer.category': 'obc',
  'customer.address.pincode': '110001',
  'customer.pan': 'ZZZPD1234Q',
  'customer.email': 'demo@example.com',
};

function propose(fields: DetectedField[], extra: Partial<MappingInput> = {}) {
  return proposeMappings({
    detection: detection(fields),
    customerValues: CUSTOMER,
    ...extra,
  });
}

describe('mapper — dictionary mapping', () => {
  it('maps common Indian form labels', () => {
    const { mappings } = propose([
      field({ signature: 'a', labelText: "Applicant's Name", name: 'applicant_name' }),
      field({ signature: 'b', labelText: "Father's Name", name: 'father_name' }),
      field({ signature: 'c', labelText: 'Mobile Number', name: 'mobile', inputType: 'tel' }),
    ]);

    expect(mappings[0]?.customerField).toBe('customer.full_name');
    expect(mappings[1]?.customerField).toBe('customer.father_name');
    expect(mappings[2]?.customerField).toBe('customer.mobile');
  });

  it('maps Hindi labels', () => {
    const { mappings } = propose([
      field({ signature: 'a', labelText: 'आवेदक का नाम' }),
      field({ signature: 'b', labelText: 'पिता का नाम' }),
      field({ signature: 'c', labelText: 'जन्म तिथि', inputType: 'date' }),
    ]);

    expect(mappings[0]?.customerField).toBe('customer.full_name');
    expect(mappings[1]?.customerField).toBe('customer.father_name');
    expect(mappings[2]?.customerField).toBe('customer.date_of_birth');
  });

  it("never maps a father's name field to the applicant's own name", () => {
    const { mappings } = propose([
      field({ signature: 'a', labelText: "Father's Name", name: 'fatherName' }),
    ]);
    expect(mappings[0]?.customerField).toBe('customer.father_name');
    expect(mappings[0]?.customerField).not.toBe('customer.full_name');
  });

  it('does not map "Name of School" to a person', () => {
    const { mappings } = propose([field({ signature: 'a', labelText: 'Name of School' })]);
    expect(mappings[0]?.customerField).not.toBe('customer.full_name');
  });

  it('applies the transform declared in the dictionary', () => {
    const { mappings } = propose([
      field({ signature: 'a', labelText: 'Date of Birth', inputType: 'text' }),
    ]);
    expect(mappings[0]?.transform).toBe('date.ddmmyyyy');
  });
});

describe('mapper — safety classes are skipped, never filled', () => {
  it('skips CAPTCHA, OTP and payment fields and counts them separately', () => {
    const { mappings, summary } = propose([
      field({ signature: 'cap', labelText: 'Enter captcha', name: 'captcha' }),
      field({ signature: 'otp', labelText: 'Enter OTP', name: 'otp' }),
      field({ signature: 'pay', labelText: 'Card number', name: 'cardNumber' }),
      field({ signature: 'ok', labelText: "Applicant's Name", name: 'applicant_name' }),
    ]);

    expect(mappings[0]).toMatchObject({ safetyClass: 'captcha', skipReason: 'captcha_field' });
    expect(mappings[1]).toMatchObject({ safetyClass: 'otp', skipReason: 'otp_field' });
    expect(mappings[2]).toMatchObject({ safetyClass: 'payment', skipReason: 'payment_field' });

    expect(summary.captcha).toBe(1);
    expect(summary.otp).toBe(1);
    expect(summary.payment).toBe(1);

    // None of them carry a customer field, so no value can ever be resolved for them.
    for (const mapping of mappings.slice(0, 3)) {
      expect(mapping.customerField).toBeNull();
    }
  });

  it('skips password and file inputs', () => {
    const { mappings } = propose([
      field({ signature: 'p', inputType: 'password', labelText: 'Password' }),
      field({ signature: 'f', inputType: 'file', labelText: 'Upload photo' }),
    ]);
    expect(mappings[0]?.skipReason).toBe('unsupported_type');
    expect(mappings[1]?.skipReason).toBe('unsupported_type');
  });
});

describe('mapper — field state', () => {
  it('leaves fields the portal already filled alone by default', () => {
    const { mappings } = propose([
      field({ signature: 'a', labelText: "Applicant's Name", hasValue: true }),
    ]);
    expect(mappings[0]?.skipReason).toBe('already_filled');
  });

  it('overwrites pre-filled fields only when the operator asked for it', () => {
    const { mappings } = propose(
      [field({ signature: 'a', labelText: "Applicant's Name", hasValue: true })],
      { overwriteFilled: true },
    );
    expect(mappings[0]?.skipReason).toBeUndefined();
    expect(mappings[0]?.customerField).toBe('customer.full_name');
  });

  it('skips hidden, disabled and read-only fields', () => {
    const { mappings } = propose([
      field({ signature: 'a', labelText: 'Name', visible: false }),
      field({ signature: 'b', labelText: 'Name', disabled: true }),
      field({ signature: 'c', labelText: 'Name', readOnly: true }),
    ]);
    expect(mappings.map((m) => m.skipReason)).toEqual(['not_visible', 'disabled', 'readonly']);
  });

  it('reports no_value rather than inventing one', () => {
    const { mappings } = proposeMappings({
      detection: detection([field({ signature: 'a', labelText: 'IFSC Code', name: 'ifsc' })]),
      customerValues: CUSTOMER,
    });
    expect(mappings[0]?.customerField).toBe('customer.bank.ifsc');
    expect(mappings[0]?.skipReason).toBe('no_value');
  });
});

describe('mapper — mandatory review (§14.6)', () => {
  it('always reviews high-risk fields even at full confidence', () => {
    const { mappings } = propose([
      field({ signature: 'a', labelText: 'PAN Number', name: 'pan' }),
      field({
        signature: 'b',
        labelText: 'Category',
        name: 'category',
        tagName: 'select',
        inputType: 'select-one',
      }),
      field({ signature: 'c', labelText: 'Date of Birth', name: 'dob', inputType: 'date' }),
    ]);

    for (const mapping of mappings) {
      expect(mapping.reviewRequired, `${mapping.customerField}`).toBe(true);
    }
  });

  it('reviews a value that a human has not verified yet', () => {
    const { mappings } = propose(
      [field({ signature: 'a', labelText: "Applicant's Name", name: 'applicant_name' })],
      { unverifiedFields: new Set(['customer.full_name']) },
    );
    expect(mappings[0]?.reviewRequired).toBe(true);
  });

  it('does not demand review for a confident, verified, low-risk field', () => {
    const adapter: PortalAdapter = {
      id: 'adp-1',
      slug: 'demo-scholarship',
      portalName: 'Demo Scholarship Portal',
      formName: 'Application',
      urlPatterns: ['https://demo.assistigo.test/scholarship/*'],
      version: '1.0.0',
      status: 'active',
      fields: [
        {
          key: 'applicant_name',
          customerField: 'customer.full_name',
          inputType: 'text',
        },
      ],
      documentRequirements: [],
    };

    const { mappings } = propose(
      [field({ signature: 'a', labelText: "Applicant's Name", name: 'applicant_name' })],
      { adapter },
    );

    expect(mappings[0]?.source).toBe('adapter');
    expect(mappings[0]?.reviewRequired).toBe(false);
  });
});

describe('mapper — resolution order (§14.3)', () => {
  const adapter: PortalAdapter = {
    id: 'adp-1',
    slug: 'demo',
    portalName: 'Demo',
    formName: 'Application',
    urlPatterns: ['https://demo.assistigo.test/**'],
    version: '1.0.0',
    status: 'active',
    fields: [{ key: 'name_field', customerField: 'customer.father_name', inputType: 'text' }],
    documentRequirements: [],
  };

  it('lets an adapter beat the dictionary', () => {
    // The label says "Applicant's Name", but the adapter — a human statement about this exact
    // form — says the field is really the father's name. The adapter wins.
    const { mappings } = propose(
      [field({ signature: 'a', name: 'name_field', labelText: "Applicant's Name" })],
      { adapter },
    );
    expect(mappings[0]).toMatchObject({ source: 'adapter', customerField: 'customer.father_name' });
  });

  it('lets an organization override beat history and the dictionary', () => {
    const { mappings } = propose([field({ signature: 'sig-1', labelText: 'Name' })], {
      orgMappings: [
        {
          pageOrigin: 'https://demo.assistigo.test',
          fieldSignature: 'sig-1',
          customerField: 'customer.guardian_name',
        },
      ],
    });
    expect(mappings[0]).toMatchObject({
      source: 'org_custom',
      customerField: 'customer.guardian_name',
    });
  });

  it('trusts repeated history more than a single confirmation, but never as much as an adapter', () => {
    const once = propose([field({ signature: 's', labelText: 'Zzz unknown label' })], {
      history: [{ fieldSignature: 's', customerField: 'customer.full_name', confirmations: 1 }],
    });
    const many = propose([field({ signature: 's', labelText: 'Zzz unknown label' })], {
      history: [{ fieldSignature: 's', customerField: 'customer.full_name', confirmations: 5 }],
    });

    expect(many.mappings[0]!.confidence).toBeGreaterThan(once.mappings[0]!.confidence);
    expect(many.mappings[0]!.confidence).toBeLessThan(0.99);
  });
});

describe('mapper — address defaults', () => {
  it('reads a bare "District" as the current address, and a qualified one as permanent', () => {
    const { mappings } = propose([
      field({ signature: 'a', labelText: 'District', tagName: 'select', inputType: 'select-one' }),
      field({
        signature: 'b',
        labelText: 'Permanent District',
        tagName: 'select',
        inputType: 'select-one',
      }),
    ]);

    expect(mappings[0]?.customerField).toBe('customer.address.district');
    expect(mappings[1]?.customerField).toBe('customer.permanent_address.district');
  });
});

describe('buildFillInstructions', () => {
  const fields = [
    field({ signature: 'name', labelText: "Applicant's Name", name: 'applicant_name' }),
    field({ signature: 'dob', labelText: 'Date of Birth', name: 'dob' }),
    field({ signature: 'cap', labelText: 'Enter captcha', name: 'captcha' }),
  ];

  it('emits values only for approved, safe fields', () => {
    const { mappings } = propose(fields);
    const instructions = buildFillInstructions(
      mappings,
      CUSTOMER,
      new Set(['name', 'dob', 'cap']),
      fields,
    );

    expect(instructions.map((i) => i.signature)).toEqual(['name', 'dob']);
    expect(instructions.find((i) => i.signature === 'dob')?.value).toBe('03/04/1990');
  });

  it('drops anything the operator did not approve', () => {
    const { mappings } = propose(fields);
    const instructions = buildFillInstructions(mappings, CUSTOMER, new Set(['name']), fields);
    expect(instructions).toHaveLength(1);
  });

  it('refuses a CAPTCHA field even if it somehow appears in the approved set', () => {
    const { mappings } = propose(fields);
    const tampered = mappings.map((mapping) =>
      mapping.signature === 'cap'
        ? { ...mapping, customerField: 'customer.full_name', skipReason: undefined }
        : mapping,
    );

    const instructions = buildFillInstructions(tampered, CUSTOMER, new Set(['cap']), fields);
    expect(instructions).toHaveLength(0);
  });
});
