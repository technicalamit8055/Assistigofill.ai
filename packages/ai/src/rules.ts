/**
 * The extraction dictionary: which printed labels mean which customer field.
 * Master spec §12.4, §14.4 (the same synonym problem the form engine solves for web forms).
 *
 * Two things make this list work on Indian documents:
 *
 *   1. English, Hindi and Hinglish sit side by side, because a single certificate routinely
 *      prints both scripts and portals mix them freely (§8.4).
 *   2. Every rule that could be confused with a relative's name carries negative keywords, so
 *      "पिता का नाम" can never resolve to the applicant's own name (§14.4). This is the single
 *      most damaging extraction error in practice — it silently files the wrong person.
 */

import type { DocumentType } from '@assistigo/core';

export type FieldDataKind =
  | 'name'
  | 'date'
  | 'mobile'
  | 'pincode'
  | 'pan'
  | 'aadhaar'
  | 'number'
  | 'year'
  | 'gender'
  | 'category'
  | 'text'
  | 'longtext';

export type LabelRule = {
  /** A `customer.*` key from the registry in packages/core/src/customers/field-keys.ts. */
  key: string;
  kind: FieldDataKind;
  /** Printed labels, lower-cased. Longest match wins, so order does not matter. */
  labels: readonly string[];
  /** If any of these appears in the label, this rule is disqualified for that line. */
  negatives?: readonly string[];
};

/**
 * Negatives shared by every rule that reads a bare "Name" label. A document that prints
 * "Name" and "Father's Name" must not resolve both to the applicant.
 */
const RELATIVE_NEGATIVES = [
  'father',
  'mother',
  'spouse',
  'husband',
  'wife',
  'guardian',
  'पिता',
  'माता',
  'पति',
  'पत्नी',
  'अभिभावक',
  'संरक्षक',
] as const;

const INSTITUTION_NEGATIVES = [
  'bank',
  'school',
  'college',
  'university',
  'board',
  'authority',
  'office',
  'department',
  'बैंक',
  'विद्यालय',
  'महाविद्यालय',
  'विश्वविद्यालय',
  'बोर्ड',
  'कार्यालय',
  'विभाग',
] as const;

/**
 * Class 10 and class 12 fields carry the same printed labels — "Board", "Roll No", "Year of
 * Passing" — and are told apart only by which certificate they appear on. That is enough when
 * the input is one classified marksheet, because `FIELDS_BY_DOCUMENT_TYPE` puts only one class
 * in scope. It is not enough for pasted text (./text.ts), where both classes are in scope at
 * once and a bare "Board" would otherwise resolve by sort order.
 *
 * These negatives make a label that names its class resolve to that class outright. A label that
 * names neither stays genuinely ambiguous and is demoted into review, which is the honest answer.
 */
const CLASS_10_NEGATIVES = [
  'class 12',
  'class xii',
  '12th',
  'intermediate',
  'senior secondary',
  '+2',
  'कक्षा 12',
  'इंटरमीडिएट',
  'उच्चतर माध्यमिक',
] as const;

const CLASS_12_NEGATIVES = [
  'class 10',
  'class x',
  '10th',
  'matric',
  'high school',
  'secondary school',
  'कक्षा 10',
  'हाई स्कूल',
  'माध्यमिक',
] as const;

export const LABEL_RULES: readonly LabelRule[] = [
  // --- personal ------------------------------------------------------------
  {
    key: 'customer.full_name',
    kind: 'name',
    labels: [
      'name',
      'full name',
      'applicant name',
      'name of applicant',
      'candidate name',
      'holder name',
      'name of the holder',
      'नाम',
      'पूरा नाम',
      'आवेदक का नाम',
      'अभ्यर्थी का नाम',
      'धारक का नाम',
    ],
    negatives: [...RELATIVE_NEGATIVES, ...INSTITUTION_NEGATIVES],
  },
  {
    key: 'customer.father_name',
    kind: 'name',
    labels: [
      'father name',
      "father's name",
      'fathers name',
      'name of father',
      'father / husband name',
      's/o',
      'son of',
      'पिता का नाम',
      'पिता',
      'पिता जी का नाम',
    ],
  },
  {
    key: 'customer.mother_name',
    kind: 'name',
    labels: [
      "mother's name",
      'mother name',
      'mothers name',
      'name of mother',
      'माता का नाम',
      'माता',
    ],
  },
  {
    key: 'customer.spouse_name',
    kind: 'name',
    labels: [
      'spouse name',
      "spouse's name",
      'husband name',
      'wife name',
      'w/o',
      'wife of',
      'पति का नाम',
      'पत्नी का नाम',
    ],
  },
  {
    key: 'customer.guardian_name',
    kind: 'name',
    labels: ['guardian name', "guardian's name", 'अभिभावक का नाम', 'संरक्षक का नाम'],
  },
  {
    key: 'customer.date_of_birth',
    kind: 'date',
    labels: ['date of birth', 'dob', 'd.o.b', 'birth date', 'जन्म तिथि', 'जन्मतिथि', 'जन्म दिनांक'],
  },
  {
    key: 'customer.gender',
    kind: 'gender',
    labels: ['gender', 'sex', 'लिंग'],
  },
  {
    key: 'customer.category',
    kind: 'category',
    labels: ['category', 'caste category', 'वर्ग', 'श्रेणी', 'जाति वर्ग'],
  },

  // --- contact -------------------------------------------------------------
  {
    key: 'customer.mobile',
    kind: 'mobile',
    labels: [
      'mobile',
      'mobile number',
      'mobile no',
      'phone',
      'phone number',
      'contact number',
      'मोबाइल',
      'मोबाइल नंबर',
      'दूरभाष',
      'संपर्क नंबर',
    ],
  },

  // --- address -------------------------------------------------------------
  {
    key: 'customer.address.printed',
    kind: 'longtext',
    labels: [
      'address',
      'residential address',
      'permanent address',
      'पता',
      'आवासीय पता',
      'स्थायी पता',
    ],
  },
  {
    key: 'customer.address.village_town_city',
    kind: 'text',
    labels: ['village', 'town', 'city', 'village/town', 'गाँव', 'ग्राम', 'शहर', 'कस्बा'],
  },
  {
    key: 'customer.address.post_office',
    kind: 'text',
    labels: ['post office', 'p.o.', 'post', 'डाकघर', 'पोस्ट ऑफिस'],
  },
  {
    key: 'customer.address.police_station',
    kind: 'text',
    labels: ['police station', 'p.s.', 'थाना'],
  },
  {
    key: 'customer.address.block',
    kind: 'text',
    labels: ['block', 'ब्लॉक', 'विकास खंड', 'प्रखंड'],
  },
  {
    key: 'customer.address.panchayat',
    kind: 'text',
    labels: ['panchayat', 'gram panchayat', 'पंचायत', 'ग्राम पंचायत'],
  },
  {
    key: 'customer.address.district',
    kind: 'text',
    labels: ['district', 'जिला', 'जनपद'],
  },
  {
    key: 'customer.address.state',
    kind: 'text',
    labels: ['state', 'राज्य'],
  },
  {
    key: 'customer.address.pincode',
    kind: 'pincode',
    labels: ['pin code', 'pincode', 'pin', 'postal code', 'पिन कोड', 'पिन'],
  },

  // --- identity ------------------------------------------------------------
  {
    key: 'customer.pan',
    kind: 'pan',
    labels: ['permanent account number', 'pan', 'pan number', 'स्थायी लेखा संख्या'],
  },
  {
    key: 'customer.aadhaar_last4',
    kind: 'aadhaar',
    labels: ['aadhaar', 'aadhar', 'aadhaar number', 'आधार', 'आधार संख्या', 'vid'],
  },
  {
    key: 'customer.voter_id',
    kind: 'text',
    labels: ['epic no', 'epic number', 'elector', 'identity card number', 'मतदाता पहचान संख्या'],
  },

  // --- certificates --------------------------------------------------------
  {
    key: 'customer.annual_income',
    kind: 'number',
    labels: [
      'annual income',
      'total annual income',
      'family income',
      'annual family income',
      'वार्षिक आय',
      'कुल वार्षिक आय',
      'पारिवारिक आय',
    ],
  },
  {
    key: 'customer.certificate.income.number',
    kind: 'text',
    labels: ['certificate number', 'certificate no', 'प्रमाण पत्र संख्या', 'प्रमाणपत्र संख्या'],
  },
  {
    key: 'customer.certificate.income.issue_date',
    kind: 'date',
    labels: ['issue date', 'date of issue', 'issued on', 'जारी तिथि', 'निर्गत तिथि'],
  },
  {
    key: 'customer.certificate.income.issuing_authority',
    kind: 'text',
    labels: ['issuing authority', 'issued by', 'जारीकर्ता', 'जारीकर्ता प्राधिकरण'],
  },
  {
    key: 'customer.certificate.caste.number',
    kind: 'text',
    labels: ['certificate number', 'certificate no', 'प्रमाण पत्र संख्या', 'प्रमाणपत्र संख्या'],
  },
  {
    key: 'customer.certificate.caste.issue_date',
    kind: 'date',
    labels: ['issue date', 'date of issue', 'issued on', 'जारी तिथि', 'निर्गत तिथि'],
  },
  {
    key: 'customer.certificate.caste.issuing_authority',
    kind: 'text',
    labels: ['issuing authority', 'issued by', 'जारीकर्ता', 'जारीकर्ता प्राधिकरण'],
  },
  {
    key: 'customer.certificate.residence.number',
    kind: 'text',
    labels: ['certificate number', 'certificate no', 'प्रमाण पत्र संख्या', 'प्रमाणपत्र संख्या'],
  },
  {
    key: 'customer.certificate.residence.issue_date',
    kind: 'date',
    labels: ['issue date', 'date of issue', 'issued on', 'जारी तिथि', 'निर्गत तिथि'],
  },

  // --- education -----------------------------------------------------------
  {
    key: 'customer.education.class10.roll_number',
    kind: 'text',
    labels: [
      'roll number',
      'roll no',
      'class 10 roll no',
      'class 10 roll number',
      '10th roll no',
      'रोल नंबर',
      'अनुक्रमांक',
    ],
    negatives: CLASS_10_NEGATIVES,
  },
  {
    key: 'customer.education.class10.board',
    kind: 'text',
    labels: ['board', 'board name', 'class 10 board', '10th board', 'high school board', 'बोर्ड'],
    negatives: CLASS_10_NEGATIVES,
  },
  {
    key: 'customer.education.class10.school',
    kind: 'text',
    labels: [
      'school',
      'school name',
      'institution',
      'class 10 school',
      '10th school',
      'विद्यालय',
      'संस्थान',
    ],
    negatives: CLASS_10_NEGATIVES,
  },
  {
    key: 'customer.education.class10.passing_year',
    kind: 'year',
    labels: [
      'year of passing',
      'passing year',
      'year',
      'class 10 passing year',
      'class 10 year',
      '10th passing year',
      'उत्तीर्ण वर्ष',
      'वर्ष',
    ],
    negatives: CLASS_10_NEGATIVES,
  },
  {
    key: 'customer.education.class10.marks_percentage',
    kind: 'text',
    labels: [
      'percentage',
      'percent',
      '%',
      'marks obtained',
      'total marks',
      'class 10 %',
      'class 10 percentage',
      '10th percentage',
      'प्रतिशत',
      'प्राप्तांक',
    ],
    negatives: CLASS_10_NEGATIVES,
  },
  {
    key: 'customer.education.class12.roll_number',
    kind: 'text',
    labels: [
      'roll number',
      'roll no',
      'class 12 roll no',
      'class 12 roll number',
      '12th roll no',
      'रोल नंबर',
      'अनुक्रमांक',
    ],
    negatives: CLASS_12_NEGATIVES,
  },
  {
    key: 'customer.education.class12.board',
    kind: 'text',
    labels: ['board', 'board name', 'class 12 board', '12th board', 'intermediate board', 'बोर्ड'],
    negatives: CLASS_12_NEGATIVES,
  },
  {
    key: 'customer.education.class12.school',
    kind: 'text',
    labels: [
      'school',
      'school name',
      'college',
      'institution',
      'class 12 school',
      '12th school',
      'विद्यालय',
      'महाविद्यालय',
    ],
    negatives: CLASS_12_NEGATIVES,
  },
  {
    key: 'customer.education.class12.passing_year',
    kind: 'year',
    labels: [
      'year of passing',
      'passing year',
      'year',
      'class 12 passing year',
      'class 12 year',
      '12th passing year',
      'उत्तीर्ण वर्ष',
      'वर्ष',
    ],
    negatives: CLASS_12_NEGATIVES,
  },
  {
    key: 'customer.education.class12.marks_percentage',
    kind: 'text',
    labels: [
      'percentage',
      'percent',
      '%',
      'marks obtained',
      'total marks',
      'class 12 %',
      'class 12 percentage',
      '12th percentage',
      'प्रतिशत',
      'प्राप्तांक',
    ],
    negatives: CLASS_12_NEGATIVES,
  },
];

/**
 * Which fields a given document class can legitimately yield.
 *
 * Scoping matters: an income certificate that happens to print the word "board" should not
 * produce a Class 10 board, and a PAN card has no address on it at all. Extracting a field the
 * document cannot contain is how wrong data gets into a profile.
 */
const COMMON_IDENTITY_FIELDS = [
  'customer.full_name',
  'customer.father_name',
  'customer.date_of_birth',
  'customer.gender',
] as const;

const ADDRESS_FIELDS = [
  'customer.address.printed',
  'customer.address.village_town_city',
  'customer.address.post_office',
  'customer.address.police_station',
  'customer.address.block',
  'customer.address.panchayat',
  'customer.address.district',
  'customer.address.state',
  'customer.address.pincode',
] as const;

export const FIELDS_BY_DOCUMENT_TYPE: Record<DocumentType, readonly string[]> = {
  aadhaar_like: [...COMMON_IDENTITY_FIELDS, ...ADDRESS_FIELDS, 'customer.aadhaar_last4'],
  pan: ['customer.full_name', 'customer.father_name', 'customer.date_of_birth', 'customer.pan'],
  voter_id: [
    ...COMMON_IDENTITY_FIELDS,
    'customer.voter_id',
    'customer.address.printed',
    'customer.address.district',
    'customer.address.state',
  ],
  marksheet_10: [
    'customer.full_name',
    'customer.father_name',
    'customer.mother_name',
    'customer.date_of_birth',
    'customer.education.class10.roll_number',
    'customer.education.class10.board',
    'customer.education.class10.school',
    'customer.education.class10.passing_year',
    'customer.education.class10.marks_percentage',
  ],
  marksheet_12: [
    'customer.full_name',
    'customer.father_name',
    'customer.mother_name',
    'customer.date_of_birth',
    'customer.education.class12.roll_number',
    'customer.education.class12.board',
    'customer.education.class12.school',
    'customer.education.class12.passing_year',
    'customer.education.class12.marks_percentage',
  ],
  caste_certificate: [
    'customer.full_name',
    'customer.father_name',
    'customer.category',
    ...ADDRESS_FIELDS,
    'customer.certificate.caste.number',
    'customer.certificate.caste.issue_date',
    'customer.certificate.caste.issuing_authority',
  ],
  income_certificate: [
    'customer.full_name',
    'customer.father_name',
    ...ADDRESS_FIELDS,
    'customer.annual_income',
    'customer.certificate.income.number',
    'customer.certificate.income.issue_date',
    'customer.certificate.income.issuing_authority',
  ],
  residence_certificate: [
    'customer.full_name',
    'customer.father_name',
    ...ADDRESS_FIELDS,
    'customer.certificate.residence.number',
    'customer.certificate.residence.issue_date',
  ],
  // A photo or a signature carries no fields — it *is* the value.
  photo: [],
  signature: [],
  receipt: [],
  application_pdf: [],
  // An unclassified document still gets the safe, universal fields. Better a name and a mobile
  // than nothing, and every one of them still goes through review.
  generic: ['customer.full_name', 'customer.father_name', 'customer.mobile', ...ADDRESS_FIELDS],
  unknown: ['customer.full_name', 'customer.father_name', 'customer.mobile', ...ADDRESS_FIELDS],
};

/**
 * Every `customer.*` key the dictionary above can produce.
 *
 * `FIELDS_BY_DOCUMENT_TYPE` narrows extraction to what a given document class can legitimately
 * contain, which is right when the input is a scan of one document. Text an operator pastes is
 * not one document — it is whatever they had to hand — so the pasted-text path (./text.ts) opens
 * the whole dictionary instead. Every field still passes the safety gate and still reaches the
 * operator for review.
 */
export const ALL_EXTRACTABLE_FIELD_KEYS: readonly string[] = [
  ...new Set(LABEL_RULES.map((rule) => rule.key)),
];
