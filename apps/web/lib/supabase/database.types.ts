/**
 * Row shapes for the tables the app reads.
 *
 * These are hand-written and used to annotate query results explicitly:
 *
 *   const rows = (data ?? []) as CustomerRow[];
 *
 * The Supabase clients are intentionally NOT parameterised with a `Database` generic yet.
 * A hand-maintained one would have to describe every table, column and foreign-key
 * relationship to satisfy supabase-js's query inference, and any drift from the real schema
 * would produce confidently wrong types — worse than none.
 *
 * Once a local Supabase can be started, generate the real thing:
 *
 *   npm run db:types      # supabase gen types typescript --local > database.generated.ts
 *
 * and then pass it to `createClient<Database>` in server.ts / browser.ts. Tracked in
 * docs/ROADMAP.md under Phase 1.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type OrganizationRow = Timestamps & {
  id: string;
  name: string;
  business_type: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  preferred_locale: 'en' | 'hi';
  monthly_forms_estimate: string | null;
  settings: Json;
  plan_code: string;
  customer_counter: number;
  created_by: string | null;
  deleted_at: string | null;
};

export type OrgRoleValue = 'owner' | 'manager' | 'operator' | 'viewer' | 'billing_admin';

export type OrganizationMemberRow = Timestamps & {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRoleValue;
  status: 'active' | 'invited' | 'suspended';
  invited_by: string | null;
};

export type MembershipWithOrganization = OrganizationMemberRow & {
  organizations: OrganizationRow | null;
};

export type OrganizationInvitationRow = Timestamps & {
  id: string;
  organization_id: string;
  email: string;
  role: Exclude<OrgRoleValue, 'owner'>;
  token_hash: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
};

export type CustomerRow = Timestamps & {
  id: string;
  organization_id: string;
  customer_code: string;
  full_name: string;
  full_name_hi: string | null;
  mobile: string | null;
  mobile_alt: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  marital_status: string | null;
  category: string | null;
  father_name: string | null;
  mother_name: string | null;
  spouse_name: string | null;
  guardian_name: string | null;
  address_json: Json;
  identity_summary_json: Json;
  education_json: Json;
  certificates_json: Json;
  notes: string | null;
  verification_status: string;
  assigned_to: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  mobile_normalized: string | null;
};

export type CustomerFieldValueRow = Timestamps & {
  id: string;
  organization_id: string;
  customer_id: string;
  field_key: string;
  value_text: string | null;
  value_encrypted: string | null;
  value_json: Json;
  display_value: string | null;
  source_document_id: string | null;
  confidence: number | null;
  status: 'extracted' | 'operator_verified' | 'customer_confirmed' | 'rejected' | 'expired';
  created_by: string | null;
  updated_by: string | null;
};

export type AuditLogRow = {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  actor_type: 'user' | 'extension' | 'system' | 'support' | 'webhook';
  action: string;
  entity_type: string;
  entity_id: string | null;
  sensitivity: 'normal' | 'sensitive' | 'critical';
  ip_address: string | null;
  user_agent: string | null;
  metadata: Json;
  created_at: string;
};

export type PlanRow = Timestamps & {
  id: string;
  code: string;
  name: string;
  name_hi: string | null;
  price_monthly_inr: number;
  included_fills: number | null;
  included_ai_extractions: number | null;
  included_seats: number;
  max_customers: number | null;
  storage_mb: number;
  features: Json;
  active: boolean;
  sort_order: number;
};

export type SubscriptionRow = Timestamps & {
  id: string;
  organization_id: string;
  plan_id: string;
  provider: 'mock' | 'razorpay' | 'stripe';
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type UsageEventRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  event_type: 'fill' | 'ai_extraction' | 'document_tool' | 'storage' | 'seat';
  quantity: number;
  billable: boolean;
  metadata: Json;
  created_at: string;
};

/** Row shape returned by public.search_customers(). */
export type CustomerSearchRow = {
  id: string;
  customer_code: string;
  full_name: string;
  full_name_hi: string | null;
  mobile: string | null;
  district: string | null;
  state: string | null;
  date_of_birth: string | null;
  verification_status: string;
  created_at: string;
  rank: number;
};

/** Shape returned by public.dashboard_summary(). */
export type DashboardSummary = {
  fillsToday: number;
  customersServedToday: number;
  customersTotal: number;
  documentsProcessedToday: number;
  applicationsOpen: number;
  reviewsPending: number;
  fieldsFilledThisMonth: number;
};
