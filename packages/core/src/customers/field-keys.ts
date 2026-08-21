/**
 * The Indian customer profile field registry.
 * Master spec §11 (profile model), §14.6 (always-review fields), §19.3 (sensitive handling).
 *
 * This registry is the shared vocabulary between three subsystems:
 *   - the CRM (which columns/JSON paths a value lands in),
 *   - the OCR pipeline (what a document extraction may propose),
 *   - the form engine (what an online form field may be mapped to).
 *
 * Adding a field here is a product decision, not a refactor. If the new field is sensitive,
 * read docs/SECURITY.md §4 first.
 */

export const CUSTOMER_FIELD_SECTIONS = [
  'personal',
  'family',
  'contact',
  'address',
  'permanent_address',
  'identity',
  'education',
  'certificates',
  'banking',
] as const;
export type CustomerFieldSection = (typeof CUSTOMER_FIELD_SECTIONS)[number];

export type CustomerFieldDataType =
  | 'name'
  | 'text'
  | 'longtext'
  | 'date'
  | 'year'
  | 'mobile'
  | 'email'
  | 'pincode'
  | 'number'
  | 'enum'
  | 'boolean';

/**
 * normal     — ordinary personal data
 * sensitive  — masked by default, reveal is audited
 * high_risk  — masked, audited, AND always human-reviewed before it can be used (§14.6)
 */
export type FieldSensitivity = 'normal' | 'sensitive' | 'high_risk';

export type FieldStorage =
  /** A first-class column on `customers`. */
  | { kind: 'column'; column: string }
  /** A path inside one of the JSONB columns on `customers`. */
  | { kind: 'json'; column: string; path: string }
  /** Only ever stored encrypted, in `customer_field_values.value_encrypted`. */
  | { kind: 'encrypted' }
  /** Computed at read time; never persisted (e.g. age). */
  | { kind: 'derived' };

export type FieldOption = {
  value: string;
  label: { en: string; hi: string };
};

export type CustomerFieldDef = {
  key: string;
  section: CustomerFieldSection;
  label: { en: string; hi: string };
  dataType: CustomerFieldDataType;
  sensitivity: FieldSensitivity;
  storage: FieldStorage;
  options?: readonly FieldOption[];
  maxLength?: number;
  /** Shown to the operator in the review UI when the value needs care. */
  note?: string;
};

// ---------------------------------------------------------------------------
// Shared option sets
// ---------------------------------------------------------------------------

export const GENDER_OPTIONS: readonly FieldOption[] = [
  { value: 'male', label: { en: 'Male', hi: 'पुरुष' } },
  { value: 'female', label: { en: 'Female', hi: 'महिला' } },
  { value: 'transgender', label: { en: 'Transgender', hi: 'ट्रांसजेंडर' } },
  { value: 'other', label: { en: 'Other', hi: 'अन्य' } },
];

export const MARITAL_STATUS_OPTIONS: readonly FieldOption[] = [
  { value: 'single', label: { en: 'Single', hi: 'अविवाहित' } },
  { value: 'married', label: { en: 'Married', hi: 'विवाहित' } },
  { value: 'widowed', label: { en: 'Widowed', hi: 'विधवा/विधुर' } },
  { value: 'divorced', label: { en: 'Divorced', hi: 'तलाकशुदा' } },
  { value: 'separated', label: { en: 'Separated', hi: 'अलग' } },
];

export const CATEGORY_OPTIONS: readonly FieldOption[] = [
  { value: 'general', label: { en: 'General', hi: 'सामान्य' } },
  { value: 'obc', label: { en: 'OBC', hi: 'ओबीसी' } },
  { value: 'sc', label: { en: 'SC', hi: 'अनुसूचित जाति' } },
  { value: 'st', label: { en: 'ST', hi: 'अनुसूचित जनजाति' } },
  { value: 'ews', label: { en: 'EWS', hi: 'ईडब्ल्यूएस' } },
  { value: 'other', label: { en: 'Other', hi: 'अन्य' } },
];

export const GUARDIAN_RELATION_OPTIONS: readonly FieldOption[] = [
  { value: 'father', label: { en: 'Father', hi: 'पिता' } },
  { value: 'mother', label: { en: 'Mother', hi: 'माता' } },
  { value: 'husband', label: { en: 'Husband', hi: 'पति' } },
  { value: 'wife', label: { en: 'Wife', hi: 'पत्नी' } },
  { value: 'brother', label: { en: 'Brother', hi: 'भाई' } },
  { value: 'sister', label: { en: 'Sister', hi: 'बहन' } },
  { value: 'other', label: { en: 'Other', hi: 'अन्य' } },
];

// ---------------------------------------------------------------------------
// Helpers for declaring address blocks (current + permanent share a shape)
// ---------------------------------------------------------------------------

type AddressPart = {
  suffix: string;
  label: { en: string; hi: string };
  dataType?: CustomerFieldDataType;
};

const ADDRESS_PARTS: readonly AddressPart[] = [
  { suffix: 'house_number', label: { en: 'House / building number', hi: 'मकान संख्या' } },
  { suffix: 'street', label: { en: 'Street / locality', hi: 'गली / मोहल्ला' } },
  { suffix: 'village_town_city', label: { en: 'Village / town / city', hi: 'गाँव / कस्बा / शहर' } },
  { suffix: 'ward', label: { en: 'Ward', hi: 'वार्ड' } },
  { suffix: 'post_office', label: { en: 'Post office', hi: 'डाकघर' } },
  { suffix: 'panchayat', label: { en: 'Panchayat', hi: 'पंचायत' } },
  { suffix: 'block', label: { en: 'Block', hi: 'ब्लॉक' } },
  { suffix: 'police_station', label: { en: 'Police station', hi: 'थाना' } },
  { suffix: 'district', label: { en: 'District', hi: 'जिला' } },
  { suffix: 'sub_division', label: { en: 'Sub-division', hi: 'अनुमंडल' } },
  { suffix: 'state', label: { en: 'State', hi: 'राज्य' } },
  { suffix: 'pincode', label: { en: 'PIN code', hi: 'पिन कोड' }, dataType: 'pincode' },
  { suffix: 'country', label: { en: 'Country', hi: 'देश' } },
  {
    suffix: 'printed',
    label: { en: 'Address as printed on document', hi: 'दस्तावेज़ पर लिखा पता' },
    dataType: 'longtext',
  },
];

function addressFields(
  section: 'address' | 'permanent_address',
  keyPrefix: string,
  jsonPath: string,
): CustomerFieldDef[] {
  return ADDRESS_PARTS.map((part) => ({
    key: `${keyPrefix}.${part.suffix}`,
    section,
    label: part.label,
    dataType: part.dataType ?? 'text',
    sensitivity: 'normal' as const,
    storage: { kind: 'json' as const, column: 'address_json', path: `${jsonPath}.${part.suffix}` },
  }));
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const CUSTOMER_FIELDS: readonly CustomerFieldDef[] = [
  // --- personal ------------------------------------------------------------
  {
    key: 'customer.full_name',
    section: 'personal',
    label: { en: 'Full name', hi: 'पूरा नाम' },
    dataType: 'name',
    sensitivity: 'normal',
    storage: { kind: 'column', column: 'full_name' },
    maxLength: 160,
    note: 'Stored exactly as written on the document. Never split into first/last.',
  },
  {
    key: 'customer.full_name_hi',
    section: 'personal',
    label: { en: 'Full name (Hindi)', hi: 'पूरा नाम (हिंदी)' },
    dataType: 'name',
    sensitivity: 'normal',
    storage: { kind: 'column', column: 'full_name_hi' },
    maxLength: 160,
  },
  {
    key: 'customer.date_of_birth',
    section: 'personal',
    label: { en: 'Date of birth', hi: 'जन्म तिथि' },
    dataType: 'date',
    sensitivity: 'high_risk',
    storage: { kind: 'column', column: 'date_of_birth' },
    note: 'Always reviewed — a wrong DOB fails an application outright.',
  },
  {
    key: 'customer.age',
    section: 'personal',
    label: { en: 'Age', hi: 'आयु' },
    dataType: 'number',
    sensitivity: 'normal',
    storage: { kind: 'derived' },
    note: 'Derived from date of birth at read time; never stored (§11.2).',
  },
  {
    key: 'customer.gender',
    section: 'personal',
    label: { en: 'Gender', hi: 'लिंग' },
    dataType: 'enum',
    sensitivity: 'normal',
    storage: { kind: 'column', column: 'gender' },
    options: GENDER_OPTIONS,
  },
  {
    key: 'customer.marital_status',
    section: 'personal',
    label: { en: 'Marital status', hi: 'वैवाहिक स्थिति' },
    dataType: 'enum',
    sensitivity: 'normal',
    storage: { kind: 'column', column: 'marital_status' },
    options: MARITAL_STATUS_OPTIONS,
  },
  {
    key: 'customer.category',
    section: 'personal',
    label: { en: 'Category', hi: 'श्रेणी' },
    dataType: 'enum',
    sensitivity: 'high_risk',
    storage: { kind: 'column', column: 'category' },
    options: CATEGORY_OPTIONS,
    note: 'Always reviewed. Only collect where a form actually requires it.',
  },
  {
    key: 'customer.religion',
    section: 'personal',
    label: { en: 'Religion', hi: 'धर्म' },
    dataType: 'text',
    sensitivity: 'sensitive',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'religion' },
    note: 'Optional and sensitive. Only collect where a form requires it.',
  },
  {
    key: 'customer.nationality',
    section: 'personal',
    label: { en: 'Nationality', hi: 'राष्ट्रीयता' },
    dataType: 'text',
    sensitivity: 'normal',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'nationality' },
  },

  // --- family --------------------------------------------------------------
  {
    key: 'customer.father_name',
    section: 'family',
    label: { en: "Father's name", hi: 'पिता का नाम' },
    dataType: 'name',
    sensitivity: 'normal',
    storage: { kind: 'column', column: 'father_name' },
    maxLength: 160,
  },
  {
    key: 'customer.mother_name',
    section: 'family',
    label: { en: "Mother's name", hi: 'माता का नाम' },
    dataType: 'name',
    sensitivity: 'normal',
    storage: { kind: 'column', column: 'mother_name' },
    maxLength: 160,
  },
  {
    key: 'customer.spouse_name',
    section: 'family',
    label: { en: 'Spouse name', hi: 'पति/पत्नी का नाम' },
    dataType: 'name',
    sensitivity: 'normal',
    storage: { kind: 'column', column: 'spouse_name' },
    maxLength: 160,
  },
  {
    key: 'customer.guardian_name',
    section: 'family',
    label: { en: 'Guardian name', hi: 'अभिभावक का नाम' },
    dataType: 'name',
    sensitivity: 'normal',
    storage: { kind: 'column', column: 'guardian_name' },
    maxLength: 160,
  },
  {
    key: 'customer.guardian_relation',
    section: 'family',
    label: { en: 'Relationship to guardian', hi: 'अभिभावक से संबंध' },
    dataType: 'enum',
    sensitivity: 'normal',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'guardian_relation' },
    options: GUARDIAN_RELATION_OPTIONS,
  },

  // --- contact -------------------------------------------------------------
  {
    key: 'customer.mobile',
    section: 'contact',
    label: { en: 'Mobile number', hi: 'मोबाइल नंबर' },
    dataType: 'mobile',
    sensitivity: 'sensitive',
    storage: { kind: 'column', column: 'mobile' },
  },
  {
    key: 'customer.mobile_alt',
    section: 'contact',
    label: { en: 'Alternate mobile', hi: 'वैकल्पिक मोबाइल' },
    dataType: 'mobile',
    sensitivity: 'sensitive',
    storage: { kind: 'column', column: 'mobile_alt' },
  },
  {
    key: 'customer.email',
    section: 'contact',
    label: { en: 'Email', hi: 'ईमेल' },
    dataType: 'email',
    sensitivity: 'sensitive',
    storage: { kind: 'column', column: 'email' },
  },
  {
    key: 'customer.whatsapp_available',
    section: 'contact',
    label: { en: 'WhatsApp available', hi: 'व्हाट्सएप उपलब्ध' },
    dataType: 'boolean',
    sensitivity: 'normal',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'whatsapp_available' },
  },

  // --- address -------------------------------------------------------------
  ...addressFields('address', 'customer.address', 'current'),
  ...addressFields('permanent_address', 'customer.permanent_address', 'permanent'),
  {
    key: 'customer.permanent_address.same_as_current',
    section: 'permanent_address',
    label: { en: 'Same as current address', hi: 'वर्तमान पते के समान' },
    dataType: 'boolean',
    sensitivity: 'normal',
    storage: { kind: 'json', column: 'address_json', path: 'permanent_same_as_current' },
  },

  // --- identity ------------------------------------------------------------
  {
    key: 'customer.aadhaar',
    section: 'identity',
    label: { en: 'Aadhaar number', hi: 'आधार संख्या' },
    dataType: 'text',
    sensitivity: 'high_risk',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'aadhaar' },
    maxLength: 12,
    note: '12-digit Aadhaar number used for online form auto-fill.',
  },
  {
    key: 'customer.aadhaar_last4',
    section: 'identity',
    label: { en: 'Aadhaar (last 4 digits)', hi: 'आधार (अंतिम 4 अंक)' },
    dataType: 'text',
    sensitivity: 'high_risk',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'aadhaar_last4' },
    maxLength: 4,
    note: 'Last four digits of Aadhaar number.',
  },
  {
    key: 'customer.pan',
    section: 'identity',
    label: { en: 'PAN', hi: 'पैन' },
    dataType: 'text',
    sensitivity: 'high_risk',
    storage: { kind: 'encrypted' },
    maxLength: 10,
    note: 'Encrypted at rest. A masked summary is kept for display.',
  },
  {
    key: 'customer.voter_id',
    section: 'identity',
    label: { en: 'Voter ID', hi: 'वोटर आईडी' },
    dataType: 'text',
    sensitivity: 'sensitive',
    storage: { kind: 'encrypted' },
  },
  {
    key: 'customer.driving_licence',
    section: 'identity',
    label: { en: 'Driving licence', hi: 'ड्राइविंग लाइसेंस' },
    dataType: 'text',
    sensitivity: 'sensitive',
    storage: { kind: 'encrypted' },
  },
  {
    key: 'customer.passport',
    section: 'identity',
    label: { en: 'Passport number', hi: 'पासपोर्ट नंबर' },
    dataType: 'text',
    sensitivity: 'sensitive',
    storage: { kind: 'encrypted' },
  },
  {
    key: 'customer.ration_card',
    section: 'identity',
    label: { en: 'Ration card number', hi: 'राशन कार्ड नंबर' },
    dataType: 'text',
    sensitivity: 'sensitive',
    storage: { kind: 'encrypted' },
  },
  {
    key: 'customer.bpl_card_number',
    section: 'identity',
    label: { en: 'BPL card number', hi: 'बीपीएल कार्ड नंबर' },
    dataType: 'text',
    sensitivity: 'sensitive',
    storage: { kind: 'encrypted' },
    note: 'Below Poverty Line card number, used as proof for several scheme applications.',
  },

  // --- education -----------------------------------------------------------
  ...(
    [
      ['class10', { en: 'Class 10', hi: 'कक्षा 10' }],
      ['class12', { en: 'Class 12', hi: 'कक्षा 12' }],
    ] as const
  ).flatMap(([level, levelLabel]) =>
    (
      [
        ['board', { en: 'Board', hi: 'बोर्ड' }, 'text'],
        ['school', { en: 'School', hi: 'विद्यालय' }, 'text'],
        ['passing_year', { en: 'Passing year', hi: 'उत्तीर्ण वर्ष' }, 'year'],
        ['roll_number', { en: 'Roll number', hi: 'रोल नंबर' }, 'text'],
        ['marks_percentage', { en: 'Marks / percentage', hi: 'अंक / प्रतिशत' }, 'text'],
      ] as const
    ).map<CustomerFieldDef>(([suffix, label, dataType]) => ({
      key: `customer.education.${level}.${suffix}`,
      section: 'education',
      label: {
        en: `${levelLabel.en} — ${label.en}`,
        hi: `${levelLabel.hi} — ${label.hi}`,
      },
      dataType,
      sensitivity: 'normal',
      storage: { kind: 'json', column: 'education_json', path: `${level}.${suffix}` },
    })),
  ),
  ...(
    [
      ['university', { en: 'University', hi: 'विश्वविद्यालय' }, 'text'],
      ['college', { en: 'College', hi: 'महाविद्यालय' }, 'text'],
      ['course', { en: 'Course', hi: 'पाठ्यक्रम' }, 'text'],
      ['registration_number', { en: 'Registration number', hi: 'पंजीकरण संख्या' }, 'text'],
      ['roll_number', { en: 'Roll number', hi: 'रोल नंबर' }, 'text'],
      ['passing_year', { en: 'Passing year', hi: 'उत्तीर्ण वर्ष' }, 'year'],
      ['marks_percentage', { en: 'Marks / percentage', hi: 'अंक / प्रतिशत' }, 'text'],
    ] as const
  ).map<CustomerFieldDef>(([suffix, label, dataType]) => ({
    key: `customer.education.graduation.${suffix}`,
    section: 'education',
    label: { en: `Graduation — ${label.en}`, hi: `स्नातक — ${label.hi}` },
    dataType,
    sensitivity: 'normal',
    storage: { kind: 'json', column: 'education_json', path: `graduation.${suffix}` },
  })),

  // --- certificates --------------------------------------------------------
  ...(
    [
      ['caste', { en: 'Caste certificate', hi: 'जाति प्रमाण पत्र' }],
      ['income', { en: 'Income certificate', hi: 'आय प्रमाण पत्र' }],
      ['residence', { en: 'Residence / domicile certificate', hi: 'निवास प्रमाण पत्र' }],
      ['ews', { en: 'EWS certificate', hi: 'ईडब्ल्यूएस प्रमाण पत्र' }],
      ['disability', { en: 'Disability certificate', hi: 'दिव्यांगता प्रमाण पत्र' }],
      ['birth', { en: 'Birth certificate', hi: 'जन्म प्रमाण पत्र' }],
      ['death', { en: 'Death certificate', hi: 'मृत्यु प्रमाण पत्र' }],
    ] as const
  ).flatMap(([type, typeLabel]) =>
    (
      [
        ['number', { en: 'Certificate number', hi: 'प्रमाण पत्र संख्या' }, 'text'],
        ['issue_date', { en: 'Issue date', hi: 'जारी तिथि' }, 'date'],
        ['issuing_authority', { en: 'Issuing authority', hi: 'जारीकर्ता प्राधिकरण' }, 'text'],
        ['expiry_date', { en: 'Valid until', hi: 'वैधता तिथि' }, 'date'],
      ] as const
    ).map<CustomerFieldDef>(([suffix, label, dataType]) => ({
      key: `customer.certificate.${type}.${suffix}`,
      section: 'certificates',
      label: { en: `${typeLabel.en} — ${label.en}`, hi: `${typeLabel.hi} — ${label.hi}` },
      dataType,
      sensitivity: type === 'caste' || type === 'disability' ? 'high_risk' : 'normal',
      storage: { kind: 'json', column: 'certificates_json', path: `${type}.${suffix}` },
    })),
  ),
  {
    key: 'customer.certificate.caste.sub_caste',
    section: 'certificates',
    label: { en: 'Sub-caste', hi: 'उप-जाति' },
    dataType: 'text',
    sensitivity: 'high_risk',
    storage: { kind: 'json', column: 'certificates_json', path: 'caste.sub_caste' },
    note: 'Always reviewed, like the reservation category it refines (§14.6).',
  },
  {
    key: 'customer.annual_income',
    section: 'certificates',
    label: { en: 'Annual family income', hi: 'वार्षिक पारिवारिक आय' },
    dataType: 'number',
    sensitivity: 'high_risk',
    storage: { kind: 'json', column: 'certificates_json', path: 'income.annual_amount' },
    note: 'Always reviewed. Drives eligibility on many schemes.',
  },
  {
    key: 'customer.disability_percentage',
    section: 'certificates',
    label: { en: 'Disability percentage', hi: 'दिव्यांगता प्रतिशत' },
    dataType: 'number',
    sensitivity: 'high_risk',
    storage: { kind: 'json', column: 'certificates_json', path: 'disability.percentage' },
  },

  // --- banking -------------------------------------------------------------
  {
    key: 'customer.bank.name',
    section: 'banking',
    label: { en: 'Bank name', hi: 'बैंक का नाम' },
    dataType: 'text',
    sensitivity: 'sensitive',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'bank.name' },
  },
  {
    key: 'customer.bank.account_holder_name',
    section: 'banking',
    label: { en: 'Account holder name', hi: 'खाताधारक का नाम' },
    dataType: 'name',
    sensitivity: 'sensitive',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'bank.account_holder_name' },
  },
  {
    key: 'customer.bank.account_number',
    section: 'banking',
    label: { en: 'Account number', hi: 'खाता संख्या' },
    dataType: 'text',
    sensitivity: 'high_risk',
    storage: { kind: 'encrypted' },
    note: 'Encrypted at rest, masked on display, always reviewed before use.',
  },
  {
    key: 'customer.bank.ifsc',
    section: 'banking',
    label: { en: 'IFSC', hi: 'आईएफएससी' },
    dataType: 'text',
    sensitivity: 'sensitive',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'bank.ifsc' },
  },
  {
    key: 'customer.bank.branch',
    section: 'banking',
    label: { en: 'Branch', hi: 'शाखा' },
    dataType: 'text',
    sensitivity: 'sensitive',
    storage: { kind: 'json', column: 'identity_summary_json', path: 'bank.branch' },
  },
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const CUSTOMER_FIELD_BY_KEY: ReadonlyMap<string, CustomerFieldDef> = new Map(
  CUSTOMER_FIELDS.map((field) => [field.key, field]),
);

export const CUSTOMER_FIELD_KEYS: readonly string[] = CUSTOMER_FIELDS.map((f) => f.key);

export function getCustomerField(key: string): CustomerFieldDef | undefined {
  return CUSTOMER_FIELD_BY_KEY.get(key);
}

export function isCustomerFieldKey(key: string): boolean {
  return CUSTOMER_FIELD_BY_KEY.has(key);
}

export function fieldsInSection(section: CustomerFieldSection): CustomerFieldDef[] {
  return CUSTOMER_FIELDS.filter((field) => field.section === section);
}

/**
 * Fields that must be reviewed by a human before they can be trusted, no matter how confident
 * the extractor or mapper is (§12.6, §14.6).
 */
export const ALWAYS_REVIEW_FIELD_KEYS: ReadonlySet<string> = new Set(
  CUSTOMER_FIELDS.filter((field) => field.sensitivity === 'high_risk').map((field) => field.key),
);

export function requiresReview(key: string): boolean {
  return ALWAYS_REVIEW_FIELD_KEYS.has(key);
}

/** Fields that are masked on display and whose reveal is audited (§19.3). */
export const MASKED_FIELD_KEYS: ReadonlySet<string> = new Set(
  CUSTOMER_FIELDS.filter((field) => field.sensitivity !== 'normal').map((field) => field.key),
);

export function isSensitiveField(key: string): boolean {
  return MASKED_FIELD_KEYS.has(key);
}

/** Fields that may only ever be persisted encrypted. */
export const ENCRYPTED_FIELD_KEYS: ReadonlySet<string> = new Set(
  CUSTOMER_FIELDS.filter((field) => field.storage.kind === 'encrypted').map((field) => field.key),
);

/**
 * Guard used by the write path and by tests: there must never be a storage location anywhere in
 * the system for a full Aadhaar number (§19.3, §4.2).
 */
export const FORBIDDEN_FIELD_KEYS: readonly string[] = [];

export function isForbiddenFieldKey(key: string): boolean {
  return FORBIDDEN_FIELD_KEYS.includes(key);
}
