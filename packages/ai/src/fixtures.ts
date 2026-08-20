/**
 * Fake documents for local development, CI and the demo seed.
 * Master spec §23.1 (OCR golden tests), §32.1; docs/DATABASE.md §7 (seed data rules).
 *
 * EVERY document here is invented. Per the seed rules:
 *
 *   - mobile numbers start `99000`, a range reserved for testing,
 *   - the Aadhaar-like number is deliberately **checksum-invalid** (it fails Verhoeff), so it
 *     is Aadhaar-shaped for the extractor but can never collide with a real allocated number,
 *   - PAN numbers use the `ZZZ` issuer block, which is not issued,
 *   - names are ordinary Indian names paired with invented dates and addresses, so no real
 *     identity is reconstructable from any row.
 *
 * No real document is ever committed here, in any form, including cropped or redacted
 * (docs/AI_PIPELINE.md §8).
 */

import type { AllowedUploadMimeType, DocumentType } from '@assistigo/core';

const STAMP = 'DEMO ONLY — NOT A VALID DOCUMENT';

export type DemoDocument = {
  /** Stable id, used as the mock provider's lookup key and by the seed script. */
  code: string;
  filename: string;
  mimeType: AllowedUploadMimeType;
  /** The class a correct classifier should land on. */
  documentType: DocumentType;
  text: string;
  /** Golden expectations: the field values a correct extraction must produce. */
  expected: Readonly<Record<string, string>>;
};

export const DEMO_DOCUMENTS: readonly DemoDocument[] = [
  {
    code: 'aadhaar_like',
    filename: 'demo-aadhaar.pdf',
    mimeType: 'application/pdf',
    documentType: 'aadhaar_like',
    text: [
      'भारतीय विशिष्ट पहचान प्राधिकरण',
      'UNIQUE IDENTIFICATION AUTHORITY OF INDIA',
      STAMP,
      '',
      'नाम / Name : Sunita Devi',
      "पिता का नाम / Father's Name : Ram Prasad",
      'जन्म तिथि / Date of Birth : 14/03/1992',
      'लिंग / Gender : Female',
      'पता / Address : House 12, Gali No 4, Rampur',
      'गाँव / Village : Rampur',
      'डाकघर / Post Office : Rampur Kalan',
      'जिला / District : Sitapur',
      'राज्य / State : Uttar Pradesh',
      'पिन कोड / PIN Code : 261001',
      'आधार संख्या / Aadhaar Number : 2000 0000 0000',
    ].join('\n'),
    expected: {
      'customer.full_name': 'Sunita Devi',
      'customer.father_name': 'Ram Prasad',
      'customer.date_of_birth': '1992-03-14',
      'customer.gender': 'female',
      'customer.address.village_town_city': 'Rampur',
      'customer.address.post_office': 'Rampur Kalan',
      'customer.address.district': 'Sitapur',
      'customer.address.state': 'Uttar Pradesh',
      'customer.address.pincode': '261001',
      // Only the last four are ever produced (§19.3).
      'customer.aadhaar_last4': '0000',
    },
  },
  {
    code: 'pan',
    filename: 'demo-pan.jpg',
    mimeType: 'image/jpeg',
    documentType: 'pan',
    text: [
      'आयकर विभाग',
      'INCOME TAX DEPARTMENT',
      'GOVT. OF INDIA',
      STAMP,
      '',
      'Permanent Account Number : ZZZPD1234Q',
      'Name : Sunita Devi',
      "Father's Name : Ram Prasad",
      'Date of Birth : 14/03/1992',
    ].join('\n'),
    expected: {
      'customer.pan': 'ZZZPD1234Q',
      'customer.full_name': 'Sunita Devi',
      'customer.father_name': 'Ram Prasad',
      'customer.date_of_birth': '1992-03-14',
    },
  },
  {
    code: 'income_certificate',
    filename: 'demo-income-certificate.pdf',
    mimeType: 'application/pdf',
    documentType: 'income_certificate',
    text: [
      'कार्यालय जिलाधिकारी, सीतापुर',
      'आय प्रमाण पत्र / INCOME CERTIFICATE',
      STAMP,
      '',
      'प्रमाण पत्र संख्या / Certificate Number : IC-2026-004512',
      'नाम / Name : Sunita Devi',
      "पिता का नाम / Father's Name : Ram Prasad",
      'ग्राम / Village : Rampur',
      'जिला / District : Sitapur',
      'राज्य / State : Uttar Pradesh',
      'पिन कोड / PIN Code : 261001',
      'वार्षिक आय / Annual Income : 96000',
      'जारी तिथि / Issue Date : 02/01/2026',
      'जारीकर्ता / Issuing Authority : Tehsildar, Sitapur',
    ].join('\n'),
    expected: {
      'customer.certificate.income.number': 'IC-2026-004512',
      'customer.full_name': 'Sunita Devi',
      'customer.father_name': 'Ram Prasad',
      'customer.address.village_town_city': 'Rampur',
      'customer.address.district': 'Sitapur',
      'customer.address.pincode': '261001',
      'customer.annual_income': '96000',
      'customer.certificate.income.issue_date': '2026-01-02',
      'customer.certificate.income.issuing_authority': 'Tehsildar, Sitapur',
    },
  },
  {
    code: 'caste_certificate',
    filename: 'demo-caste-certificate.pdf',
    mimeType: 'application/pdf',
    documentType: 'caste_certificate',
    text: [
      'कार्यालय जिलाधिकारी, सीतापुर',
      'जाति प्रमाण पत्र / CASTE CERTIFICATE',
      STAMP,
      '',
      'प्रमाण पत्र संख्या / Certificate Number : CC-2026-001188',
      'नाम / Name : Sunita Devi',
      "पिता का नाम / Father's Name : Ram Prasad",
      'श्रेणी / Category : OBC',
      'जिला / District : Sitapur',
      'जारी तिथि / Issue Date : 11/11/2025',
    ].join('\n'),
    expected: {
      'customer.certificate.caste.number': 'CC-2026-001188',
      'customer.full_name': 'Sunita Devi',
      'customer.father_name': 'Ram Prasad',
      'customer.category': 'obc',
      'customer.address.district': 'Sitapur',
      'customer.certificate.caste.issue_date': '2025-11-11',
    },
  },
  {
    code: 'marksheet_10',
    filename: 'demo-class10-marksheet.pdf',
    mimeType: 'application/pdf',
    documentType: 'marksheet_10',
    text: [
      'BOARD OF HIGH SCHOOL AND INTERMEDIATE EDUCATION',
      'SECONDARY SCHOOL EXAMINATION / माध्यमिक परीक्षा',
      STAMP,
      '',
      'Name : Sunita Devi',
      "Father's Name : Ram Prasad",
      "Mother's Name : Kamla Devi",
      'Roll Number : 1234567',
      'Board : UP Board',
      'School : Government Inter College, Rampur',
      'Year of Passing : 2008',
      'Percentage : 72.4',
    ].join('\n'),
    expected: {
      'customer.full_name': 'Sunita Devi',
      'customer.father_name': 'Ram Prasad',
      'customer.mother_name': 'Kamla Devi',
      'customer.education.class10.roll_number': '1234567',
      'customer.education.class10.board': 'UP Board',
      'customer.education.class10.school': 'Government Inter College, Rampur',
      'customer.education.class10.passing_year': '2008',
      'customer.education.class10.marks_percentage': '72.4',
    },
  },
  {
    code: 'residence_certificate',
    filename: 'demo-residence-certificate.pdf',
    mimeType: 'application/pdf',
    documentType: 'residence_certificate',
    text: [
      'कार्यालय जिलाधिकारी, सीतापुर',
      'निवास प्रमाण पत्र / RESIDENCE CERTIFICATE',
      STAMP,
      '',
      'प्रमाण पत्र संख्या / Certificate Number : RC-2026-007731',
      'नाम / Name : Sunita Devi',
      "पिता का नाम / Father's Name : Ram Prasad",
      'ग्राम / Village : Rampur',
      'डाकघर / Post Office : Rampur Kalan',
      'जिला / District : Sitapur',
      'राज्य / State : Uttar Pradesh',
      'पिन कोड / PIN Code : 261001',
      'जारी तिथि / Issue Date : 20/12/2025',
    ].join('\n'),
    expected: {
      'customer.certificate.residence.number': 'RC-2026-007731',
      'customer.full_name': 'Sunita Devi',
      'customer.father_name': 'Ram Prasad',
      'customer.address.village_town_city': 'Rampur',
      'customer.address.post_office': 'Rampur Kalan',
      'customer.address.district': 'Sitapur',
      'customer.address.state': 'Uttar Pradesh',
      'customer.address.pincode': '261001',
      'customer.certificate.residence.issue_date': '2025-12-20',
    },
  },
  {
    code: 'photo',
    filename: 'demo-passport-photo.jpg',
    mimeType: 'image/jpeg',
    documentType: 'photo',
    // A photograph carries no readable text — which is itself the classification signal.
    text: '',
    expected: {},
  },
];

export const DEMO_DOCUMENT_BY_CODE: ReadonlyMap<string, DemoDocument> = new Map(
  DEMO_DOCUMENTS.map((document) => [document.code, document]),
);

export function findDemoDocumentByFilename(filename: string): DemoDocument | undefined {
  const needle = filename.toLowerCase();
  return DEMO_DOCUMENTS.find((document) => document.filename.toLowerCase() === needle);
}
