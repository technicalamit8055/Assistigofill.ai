/**
 * Zod schemas for the customer API surface.
 * Master spec §9.2 (add customer), §11 (profile model), §17.3 (validate every external input).
 */

import { z } from 'zod';
import { CATEGORY_OPTIONS, GENDER_OPTIONS, MARITAL_STATUS_OPTIONS } from './field-keys';
import { normalizeMobile, normalizePincode } from './normalize';

const optionValues = <T extends { value: string }>(options: readonly T[]) =>
  options.map((option) => option.value) as [string, ...string[]];

export const genderSchema = z.enum(optionValues(GENDER_OPTIONS));
export const maritalStatusSchema = z.enum(optionValues(MARITAL_STATUS_OPTIONS));
export const categorySchema = z.enum(optionValues(CATEGORY_OPTIONS));

const trimmedString = (max: number) => z.string().trim().max(max);

/** Accepts any of the mobile formats an operator might type; stores the bare 10 digits. */
export const mobileSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const { value: normalized } = normalizeMobile(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.mobile_invalid' });
      return z.NEVER;
    }
    return normalized;
  });

export const pincodeSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const { value: normalized } = normalizePincode(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.pincode_invalid' });
      return z.NEVER;
    }
    return normalized;
  });

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date_invalid')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'validation.date_invalid');

export const addressBlockSchema = z
  .object({
    house_number: trimmedString(80).optional(),
    street: trimmedString(160).optional(),
    village_town_city: trimmedString(120).optional(),
    ward: trimmedString(80).optional(),
    post_office: trimmedString(120).optional(),
    panchayat: trimmedString(120).optional(),
    block: trimmedString(120).optional(),
    police_station: trimmedString(120).optional(),
    district: trimmedString(120).optional(),
    state: trimmedString(120).optional(),
    pincode: pincodeSchema.optional(),
    country: trimmedString(80).optional(),
    /** The address exactly as printed on the source document (§12.5). */
    printed: trimmedString(600).optional(),
  })
  .partial();

export const addressJsonSchema = z.object({
  current: addressBlockSchema.optional(),
  permanent: addressBlockSchema.optional(),
  permanent_same_as_current: z.boolean().optional(),
});

/**
 * Only masked / derived identity data lives here. There is deliberately no field for a full
 * Aadhaar number; PAN and account numbers go to `customer_field_values.value_encrypted`.
 */
export const identitySummarySchema = z.object({
  aadhaar_last4: z
    .string()
    .regex(/^\d{4}$/, 'validation.last4_invalid')
    .optional(),
  pan_masked: trimmedString(20).optional(),
  voter_id_last4: z
    .string()
    .regex(/^[A-Za-z0-9]{4}$/)
    .optional(),
  religion: trimmedString(60).optional(),
  nationality: trimmedString(60).optional(),
  guardian_relation: trimmedString(40).optional(),
  whatsapp_available: z.boolean().optional(),
  bank: z
    .object({
      name: trimmedString(120).optional(),
      account_holder_name: trimmedString(160).optional(),
      account_masked: trimmedString(40).optional(),
      ifsc: trimmedString(20).optional(),
      branch: trimmedString(120).optional(),
    })
    .optional(),
});

const educationLevelSchema = z
  .object({
    board: trimmedString(160).optional(),
    school: trimmedString(200).optional(),
    university: trimmedString(200).optional(),
    college: trimmedString(200).optional(),
    course: trimmedString(160).optional(),
    registration_number: trimmedString(60).optional(),
    roll_number: trimmedString(60).optional(),
    passing_year: z
      .string()
      .regex(/^\d{4}$/, 'validation.year_invalid')
      .optional(),
    marks_percentage: trimmedString(20).optional(),
  })
  .partial();

export const educationJsonSchema = z.object({
  class10: educationLevelSchema.optional(),
  class12: educationLevelSchema.optional(),
  graduation: educationLevelSchema.optional(),
  other: z.array(educationLevelSchema.extend({ title: trimmedString(160) })).optional(),
});

const certificateSchema = z
  .object({
    number: trimmedString(80).optional(),
    issue_date: isoDateSchema.optional(),
    issuing_authority: trimmedString(200).optional(),
    expiry_date: isoDateSchema.optional(),
  })
  .partial();

export const certificatesJsonSchema = z.object({
  caste: certificateSchema.optional(),
  income: certificateSchema
    .extend({ annual_amount: z.number().int().nonnegative().optional() })
    .optional(),
  residence: certificateSchema.optional(),
  ews: certificateSchema.optional(),
  disability: certificateSchema
    .extend({ percentage: z.number().int().min(0).max(100).optional() })
    .optional(),
  birth: certificateSchema.optional(),
  death: certificateSchema.optional(),
});

/**
 * The minimum needed to start serving a walk-in customer.
 * Spec §9.2: a minimal customer must be creatable in under 30 seconds, so only name is required.
 */
export const createCustomerSchema = z.object({
  fullName: z.string().trim().min(2, 'validation.name_required').max(160),
  fullNameHi: trimmedString(160).optional(),
  mobile: mobileSchema.optional(),
  mobileAlt: mobileSchema.optional(),
  email: z.string().trim().email('validation.email_invalid').optional().or(z.literal('')),
  dateOfBirth: isoDateSchema.optional(),
  gender: genderSchema.optional(),
  maritalStatus: maritalStatusSchema.optional(),
  category: categorySchema.optional(),
  fatherName: trimmedString(160).optional(),
  motherName: trimmedString(160).optional(),
  spouseName: trimmedString(160).optional(),
  guardianName: trimmedString(160).optional(),
  address: addressJsonSchema.optional(),
  identitySummary: identitySummarySchema.optional(),
  education: educationJsonSchema.optional(),
  certificates: certificatesJsonSchema.optional(),
  notes: trimmedString(2000).optional(),
  /** Set when the profile was created from a reviewed document extraction. */
  sourceDocumentId: z.string().uuid().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  fullName: z.string().trim().min(2, 'validation.name_required').max(160).optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  district: trimmedString(120).optional(),
  state: trimmedString(120).optional(),
  assignedTo: z.string().uuid().optional(),
  missingDocuments: z.coerce.boolean().optional(),
  createdFrom: isoDateSchema.optional(),
  createdTo: isoDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;

export const CUSTOMER_VERIFICATION_STATUSES = [
  'unverified',
  'extracted',
  'operator_verified',
  'customer_confirmed',
  'expired',
  'rejected',
] as const;
export type CustomerVerificationStatus = (typeof CUSTOMER_VERIFICATION_STATUSES)[number];

export const customerFieldValueSchema = z.object({
  fieldKey: z.string().min(1).max(120),
  value: z.string().max(2000).nullable(),
  status: z.enum(CUSTOMER_VERIFICATION_STATUSES),
  confidence: z.number().min(0).max(1).nullable().optional(),
  sourceDocumentId: z.string().uuid().nullable().optional(),
});

export type CustomerFieldValueInput = z.infer<typeof customerFieldValueSchema>;
