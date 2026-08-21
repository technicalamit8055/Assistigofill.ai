/**
 * Rules-based field mapping dictionary.
 * Master spec §14.4, §8.4 — Indian portal forms label the same field in English, Hindi,
 * Hinglish, abbreviations and portal-specific jargon.
 *
 * This is priority 4 in the resolution order (docs/FORM_ENGINE.md §3): it runs when no adapter,
 * organization override or confirmed history matches. It is deliberately conservative — a
 * confident wrong mapping is worse than no mapping, because the operator may not notice.
 *
 * `negative` is what makes that work. "Name" alone is ambiguous on an Indian form; "Father's
 * Name", "Mother's Name" and "Name of School" are all near-matches for `customer.full_name`
 * unless the entry explicitly rejects them.
 */

export type DictionaryEntry = {
  customerField: string;
  /** Phrases that appear in a visible label, placeholder or aria-label. */
  synonyms: readonly string[];
  /** Tokens that appear in `name`/`id` attributes. Matched as whole words after normalisation. */
  attributes?: readonly string[];
  /** If any of these appear anywhere in the field's text, this candidate is rejected outright. */
  negative?: readonly string[];
  /** Input types this field is compatible with. A mismatch halves the score. */
  inputTypes?: readonly string[];
  /**
   * Match only on the field's own naming — never on nearby text or the section heading.
   *
   * For entries whose synonyms are container words. "Address" as a section heading sits above
   * ten other fields, so without this every dropdown inside a "Present Address" fieldset gets
   * proposed as the printed-address blob, and the operator's review list fills with noise that
   * hides the mappings that are actually wrong.
   */
  ownTextOnly?: boolean;
  /** Named transform applied to the customer value before filling. */
  transform?: string;
};

/** Words that turn a bare "name" into somebody else's name. */
const OTHER_PERSON = [
  'father',
  'mother',
  'spouse',
  'husband',
  'wife',
  'guardian',
  'nominee',
  'applicant father',
  'pita',
  'mata',
  'पिता',
  'माता',
  'पति',
  'पत्नी',
  'अभिभावक',
] as const;

/** Words that mean "the name of an institution or place", not a person. */
const NOT_A_PERSON = [
  'school',
  'college',
  'university',
  'board',
  'institute',
  'bank',
  'branch',
  'company',
  'employer',
  'village',
  'city',
  'town',
  'district',
  'state',
  'country',
  'course',
  'exam',
  'scheme',
  'user',
  'username',
  'login',
  'file',
  'document',
] as const;

export const MAPPING_DICTIONARY: readonly DictionaryEntry[] = [
  // --- personal ------------------------------------------------------------
  {
    customerField: 'customer.full_name',
    synonyms: [
      'full name',
      'name',
      'applicant name',
      'name of applicant',
      'candidate name',
      'name of candidate',
      'student name',
      'name of student',
      'beneficiary name',
      'your name',
      'नाम',
      'पूरा नाम',
      'आवेदक का नाम',
      'अभ्यर्थी का नाम',
      'छात्र का नाम',
    ],
    attributes: ['fullname', 'full name', 'applicant name', 'candidate name', 'name', 'aname'],
    negative: [...OTHER_PERSON, ...NOT_A_PERSON],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.full_name_hi',
    synonyms: ['name in hindi', 'नाम हिंदी में', 'हिंदी में नाम', 'applicant name in hindi'],
    attributes: ['name hindi', 'hindi name', 'namehindi'],
    negative: [...OTHER_PERSON],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.father_name',
    synonyms: [
      "father's name",
      'father name',
      'name of father',
      'fathers name',
      'father husband name',
      "father's / husband's name",
      'पिता का नाम',
      'पिता जी का नाम',
    ],
    attributes: ['fathername', 'father name', 'fname', 'father'],
    negative: ['mother', 'माता'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.mother_name',
    synonyms: ["mother's name", 'mother name', 'name of mother', 'mothers name', 'माता का नाम'],
    attributes: ['mothername', 'mother name', 'mname', 'mother'],
    negative: ['father', 'पिता'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.spouse_name',
    synonyms: [
      'spouse name',
      "spouse's name",
      'husband name',
      'wife name',
      'पति का नाम',
      'पत्नी का नाम',
      'जीवनसाथी का नाम',
    ],
    attributes: ['spousename', 'spouse name', 'husband name', 'wife name'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.guardian_name',
    synonyms: ['guardian name', "guardian's name", 'name of guardian', 'अभिभावक का नाम'],
    attributes: ['guardianname', 'guardian name', 'gname'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.date_of_birth',
    synonyms: [
      'date of birth',
      'dob',
      'birth date',
      'date of birth as per certificate',
      'जन्म तिथि',
      'जन्म दिनांक',
      'जन्म की तारीख',
    ],
    attributes: ['dob', 'dateofbirth', 'birthdate', 'date birth'],
    negative: ['issue', 'expiry', 'valid', 'admission', 'joining', 'marriage'],
    inputTypes: ['date', 'text'],
    transform: 'date.ddmmyyyy',
  },
  {
    customerField: 'customer.gender',
    synonyms: ['gender', 'sex', 'लिंग'],
    attributes: ['gender', 'sex'],
    inputTypes: ['select-one', 'radio', 'text'],
    transform: 'gender.full',
  },
  {
    customerField: 'customer.marital_status',
    synonyms: ['marital status', 'married status', 'वैवाहिक स्थिति'],
    attributes: ['maritalstatus', 'marital status'],
    inputTypes: ['select-one', 'radio'],
  },
  {
    customerField: 'customer.category',
    synonyms: [
      'category',
      'caste category',
      'social category',
      'reservation category',
      'श्रेणी',
      'जाति श्रेणी',
      'वर्ग',
    ],
    attributes: ['category', 'castecategory', 'socialcategory'],
    negative: ['sub category', 'document category', 'exam category'],
    inputTypes: ['select-one', 'radio'],
    transform: 'category.code',
  },
  {
    customerField: 'customer.religion',
    synonyms: ['religion', 'धर्म'],
    attributes: ['religion'],
    inputTypes: ['select-one', 'text'],
  },
  {
    customerField: 'customer.nationality',
    synonyms: ['nationality', 'राष्ट्रीयता'],
    attributes: ['nationality'],
    inputTypes: ['select-one', 'text'],
  },

  // --- contact -------------------------------------------------------------
  {
    customerField: 'customer.mobile',
    synonyms: [
      'mobile number',
      'mobile no',
      'mobile',
      'contact number',
      'phone number',
      'phone no',
      'cell number',
      'मोबाइल नंबर',
      'मोबाइल',
      'संपर्क नंबर',
      'मोबाइल संख्या',
    ],
    attributes: ['mobile', 'mobileno', 'mobilenumber', 'phone', 'phoneno', 'contactno'],
    negative: [
      'alternate',
      'alternative',
      'other',
      'landline',
      'std',
      'office',
      'parent',
      'guardian',
    ],
    inputTypes: ['tel', 'text', 'number'],
    transform: 'mobile.10digit',
  },
  {
    customerField: 'customer.mobile_alt',
    synonyms: [
      'alternate mobile',
      'alternate mobile number',
      'alternative mobile',
      'alternate contact number',
      'other mobile number',
      'वैकल्पिक मोबाइल',
    ],
    attributes: ['altmobile', 'alternatemobile', 'mobile2', 'altphone'],
    inputTypes: ['tel', 'text', 'number'],
    transform: 'mobile.10digit',
  },
  {
    customerField: 'customer.email',
    synonyms: ['email', 'email id', 'e mail', 'email address', 'ईमेल', 'ईमेल आईडी'],
    attributes: ['email', 'emailid', 'emailaddress', 'mail'],
    negative: ['confirm', 'retype', 're enter', 'parent', 'guardian', 'office'],
    inputTypes: ['email', 'text'],
  },

  // --- address (current) ---------------------------------------------------
  {
    customerField: 'customer.address.house_number',
    synonyms: [
      'house number',
      'house no',
      'building number',
      'flat number',
      'plot no',
      'मकान संख्या',
    ],
    attributes: ['houseno', 'housenumber', 'flatno', 'buildingno'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.address.street',
    synonyms: [
      'street',
      'locality',
      'street locality',
      'road',
      'colony',
      'mohalla',
      'गली',
      'मोहल्ला',
    ],
    attributes: ['street', 'locality', 'colony', 'mohalla'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.address.village_town_city',
    synonyms: [
      'village',
      'town',
      'city',
      'village town city',
      'village or town',
      'city village',
      'गाँव',
      'शहर',
      'कस्बा',
      /*
       * RTPS Bihar labels one field "ग्राम (Village) / मोहल्ला (Town)". The compound only —
       * bare "ग्राम" is a substring of "ग्राम पंचायत", and since a `<select>`'s nearby text
       * includes its own option labels, a lone "ग्राम" claimed the local-body-type dropdown
       * off the back of a "ग्राम पंचायत" option.
       */
      'ग्राम मोहल्ला',
    ],
    attributes: ['village', 'town', 'city', 'villagetown'],
    negative: [
      'birth',
      'exam',
      'centre',
      'center',
      'permanent',
      'panchayat',
      'पंचायत',
      'local body',
      'निकाय',
    ],
    inputTypes: ['text', 'select-one'],
  },
  {
    customerField: 'customer.address.post_office',
    synonyms: ['post office', 'post', 'po', 'डाकघर', 'डाक घर'],
    attributes: ['postoffice', 'post office', 'po'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.address.panchayat',
    synonyms: ['panchayat', 'gram panchayat', 'पंचायत', 'ग्राम पंचायत'],
    attributes: ['panchayat', 'grampanchayat'],
    inputTypes: ['text', 'select-one'],
  },
  {
    customerField: 'customer.address.block',
    synonyms: [
      'block',
      'tehsil',
      'taluka',
      'taluk',
      'mandal',
      'ब्लॉक',
      'तहसील',
      // Bihar's revenue unit. RTPS uses it, not "block", in the Hindi label.
      'प्रखंड',
    ],
    attributes: ['block', 'tehsil', 'taluka', 'mandal', 'prakhand'],
    negative: ['permanent'],
    inputTypes: ['text', 'select-one'],
  },
  {
    customerField: 'customer.address.police_station',
    synonyms: ['police station', 'ps', 'थाना'],
    attributes: ['policestation', 'police station', 'thana'],
    inputTypes: ['text', 'select-one'],
  },
  {
    customerField: 'customer.address.ward',
    synonyms: ['ward', 'ward number', 'वार्ड', 'वार्ड संख्या'],
    attributes: ['ward', 'wardno'],
    negative: ['local body', 'स्थानीय निकाय'],
    inputTypes: ['text', 'select-one'],
  },
  {
    customerField: 'customer.address.district',
    synonyms: ['district', 'zila', 'जिला', 'ज़िला'],
    attributes: ['district', 'dist', 'zila'],
    negative: [
      'permanent',
      'birth',
      'exam',
      'sub division',
      'subdivision',
      'sub divisional',
      'अनुमंडल',
    ],
    inputTypes: ['select-one', 'text'],
  },
  {
    customerField: 'customer.address.state',
    synonyms: ['state', 'state ut', 'राज्य'],
    attributes: ['state', 'stateid'],
    negative: ['permanent', 'birth', 'exam', 'statement', 'status', 'local body', 'स्थानीय निकाय'],
    inputTypes: ['select-one', 'text'],
  },
  {
    customerField: 'customer.address.pincode',
    synonyms: ['pin code', 'pincode', 'postal code', 'zip code', 'पिन कोड', 'पिनकोड'],
    attributes: ['pincode', 'pin', 'postalcode', 'zip'],
    negative: ['permanent'],
    inputTypes: ['text', 'number', 'tel'],
    transform: 'pin.6digit',
  },
  {
    customerField: 'customer.address.printed',
    synonyms: [
      'address',
      'full address',
      'complete address',
      'correspondence address',
      'पता',
      'पूरा पता',
    ],
    attributes: ['address', 'addressline', 'fulladdress'],
    negative: ['permanent', 'email', 'ip'],
    inputTypes: ['textarea', 'text'],
    ownTextOnly: true,
  },

  // --- address (permanent) -------------------------------------------------
  {
    customerField: 'customer.permanent_address.district',
    synonyms: ['permanent district', 'district permanent', 'स्थायी जिला'],
    attributes: ['permanentdistrict', 'perm district'],
    inputTypes: ['select-one', 'text'],
  },
  {
    customerField: 'customer.permanent_address.state',
    synonyms: ['permanent state', 'state permanent', 'स्थायी राज्य'],
    attributes: ['permanentstate', 'perm state'],
    inputTypes: ['select-one', 'text'],
  },
  {
    customerField: 'customer.permanent_address.pincode',
    synonyms: ['permanent pin code', 'permanent pincode', 'स्थायी पिन कोड'],
    attributes: ['permanentpincode', 'perm pincode'],
    inputTypes: ['text', 'number', 'tel'],
    transform: 'pin.6digit',
  },
  {
    customerField: 'customer.permanent_address.printed',
    synonyms: ['permanent address', 'स्थायी पता'],
    attributes: ['permanentaddress', 'permaddress'],
    inputTypes: ['textarea', 'text'],
    // "Permanent Address" is also a section heading, with a whole block of fields under it.
    ownTextOnly: true,
  },

  // --- identity ------------------------------------------------------------
  {
    customerField: 'customer.aadhaar',
    synonyms: [
      'aadhaar',
      'aadhaar number',
      'aadhaar no',
      'aadhaar card',
      'aadhaar card number',
      'aadhar',
      'aadhar number',
      'aadhar no',
      'aadhar card',
      'uid',
      'uidai',
      'आधार',
      'आधार संख्या',
      'आधार नंबर',
      'आधार कार्ड',
    ],
    attributes: ['aadhaar', 'aadhaarno', 'aadhaarnumber', 'aadhar', 'aadharno', 'uid'],
    negative: ['last 4', 'last four', 'upload', 'file'],
    inputTypes: ['text', 'number', 'tel'],
    transform: 'number.plain',
  },
  {
    customerField: 'customer.aadhaar_last4',
    synonyms: [
      'last 4 digits of aadhaar',
      'aadhaar last four',
      'last four digits of aadhar',
      'आधार के अंतिम 4 अंक',
    ],
    attributes: ['aadhaarlast4', 'aadharlast4'],
    inputTypes: ['text', 'number'],
  },
  {
    customerField: 'customer.pan',
    synonyms: ['pan', 'pan number', 'pan card number', 'permanent account number', 'पैन नंबर'],
    attributes: ['pan', 'panno', 'pannumber', 'pancard'],
    negative: ['panchayat', 'company', 'father', 'upload'],
    inputTypes: ['text'],
    transform: 'text.upper',
  },
  {
    customerField: 'customer.voter_id',
    synonyms: ['voter id', 'epic number', 'voter id number', 'election card', 'वोटर आईडी'],
    attributes: ['voterid', 'epic', 'epicno'],
    inputTypes: ['text'],
    transform: 'text.upper',
  },

  // --- education -----------------------------------------------------------
  {
    customerField: 'customer.education.class10.board',
    synonyms: ['10th board', 'matric board', 'board name 10th', 'secondary board', 'दसवीं बोर्ड'],
    attributes: ['board10', 'tenthboard', 'matricboard'],
    inputTypes: ['text', 'select-one'],
  },
  {
    customerField: 'customer.education.class10.roll_number',
    synonyms: ['10th roll number', 'matric roll no', 'secondary roll number', 'दसवीं रोल नंबर'],
    attributes: ['roll10', 'tenthroll', 'matricroll'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.education.class10.passing_year',
    synonyms: [
      '10th passing year',
      'year of passing 10th',
      'matric passing year',
      'दसवीं उत्तीर्ण वर्ष',
    ],
    attributes: ['year10', 'tenthyear', 'matricyear'],
    inputTypes: ['text', 'number', 'select-one'],
  },
  {
    customerField: 'customer.education.class12.board',
    synonyms: ['12th board', 'intermediate board', 'senior secondary board', 'बारहवीं बोर्ड'],
    attributes: ['board12', 'twelfthboard', 'interboard'],
    inputTypes: ['text', 'select-one'],
  },
  {
    customerField: 'customer.education.class12.roll_number',
    synonyms: ['12th roll number', 'intermediate roll no', 'बारहवीं रोल नंबर'],
    attributes: ['roll12', 'twelfthroll', 'interroll'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.education.class12.passing_year',
    synonyms: ['12th passing year', 'year of passing 12th', 'बारहवीं उत्तीर्ण वर्ष'],
    attributes: ['year12', 'twelfthyear', 'interyear'],
    inputTypes: ['text', 'number', 'select-one'],
  },

  // --- certificates --------------------------------------------------------
  {
    customerField: 'customer.certificate.caste.number',
    synonyms: ['caste certificate number', 'caste certificate no', 'जाति प्रमाण पत्र संख्या'],
    attributes: ['castecertno', 'castecertificateno'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.certificate.income.number',
    synonyms: ['income certificate number', 'income certificate no', 'आय प्रमाण पत्र संख्या'],
    attributes: ['incomecertno', 'incomecertificateno'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.certificate.residence.number',
    synonyms: [
      'residence certificate number',
      'domicile certificate number',
      'निवास प्रमाण पत्र संख्या',
    ],
    attributes: ['residencecertno', 'domicilecertno'],
    inputTypes: ['text'],
  },
  {
    customerField: 'customer.annual_income',
    synonyms: [
      'annual income',
      'family income',
      'yearly income',
      'total income',
      'वार्षिक आय',
      'पारिवारिक आय',
      // RTPS Bihar's income certificate form labels this "कुल आय (वार्षिक)".
      'कुल आय',
    ],
    attributes: ['annualincome', 'familyincome', 'totalincome', 'income'],
    negative: ['certificate no', 'certificate number', 'source', 'स्रोत'],
    inputTypes: ['text', 'number'],
    // Portals reject "1,20,000"; the profile stores it however the operator typed it.
    transform: 'number.plain',
  },

  // --- banking -------------------------------------------------------------
  {
    customerField: 'customer.bank.name',
    synonyms: ['bank name', 'name of bank', 'बैंक का नाम'],
    attributes: ['bankname', 'bank'],
    inputTypes: ['text', 'select-one'],
  },
  {
    customerField: 'customer.bank.account_number',
    synonyms: ['account number', 'bank account number', 'account no', 'खाता संख्या'],
    attributes: ['accountno', 'accountnumber', 'bankaccount', 'acno'],
    negative: ['card', 'confirm', 'retype', 're enter'],
    inputTypes: ['text', 'number'],
  },
  {
    customerField: 'customer.bank.ifsc',
    synonyms: ['ifsc', 'ifsc code', 'आईएफएससी'],
    attributes: ['ifsc', 'ifsccode'],
    inputTypes: ['text'],
    transform: 'text.upper',
  },
  {
    customerField: 'customer.bank.branch',
    synonyms: ['branch name', 'bank branch', 'शाखा'],
    attributes: ['branchname', 'branch'],
    inputTypes: ['text'],
  },
];

export const DICTIONARY_BY_FIELD: ReadonlyMap<string, DictionaryEntry> = new Map(
  MAPPING_DICTIONARY.map((entry) => [entry.customerField, entry]),
);

/**
 * Normalises a label or attribute for comparison.
 *
 * Devanagari is preserved untouched — lowercasing and punctuation stripping are Latin-script
 * operations, and Hindi labels must survive them intact.
 */
export function normalizeLabel(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/[*:?()[\]{}"”“]/g, ' ')
    .replace(/['’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
