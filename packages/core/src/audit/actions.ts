/**
 * Audit action catalogue.
 * Master spec §19.5 (minimum audit events), §18.2 (audit_logs).
 *
 * Audit rows are insert-only. There is no update or delete policy for any role.
 */

export const AUDIT_SENSITIVITY = ['normal', 'sensitive', 'critical'] as const;
export type AuditSensitivity = (typeof AUDIT_SENSITIVITY)[number];

export const AUDIT_ACTOR_TYPES = ['user', 'extension', 'system', 'support', 'webhook'] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export type AuditActionDef = {
  action: string;
  entityType: string;
  sensitivity: AuditSensitivity;
  description: string;
};

const define = <T extends readonly AuditActionDef[]>(actions: T) => actions;

export const AUDIT_ACTIONS = define([
  // --- auth / membership ---------------------------------------------------
  {
    action: 'auth.login_failed',
    entityType: 'user',
    sensitivity: 'sensitive',
    description: 'Failed sign-in attempt',
  },
  {
    action: 'auth.session_revoked',
    entityType: 'user',
    sensitivity: 'sensitive',
    description: 'Session revoked',
  },
  {
    // Recorded when the operator authorises the browser extension from the dashboard, which is
    // the moment they grant it their session (docs/EXTENSION.md §3).
    action: 'extension.paired',
    entityType: 'user',
    sensitivity: 'sensitive',
    description: 'Browser extension paired with this account',
  },
  {
    action: 'member.invited',
    entityType: 'organization_member',
    sensitivity: 'sensitive',
    description: 'Member invited',
  },
  {
    action: 'member.accepted',
    entityType: 'organization_member',
    sensitivity: 'normal',
    description: 'Invitation accepted',
  },
  {
    action: 'member.removed',
    entityType: 'organization_member',
    sensitivity: 'sensitive',
    description: 'Member removed',
  },
  {
    action: 'member.role_changed',
    entityType: 'organization_member',
    sensitivity: 'critical',
    description: 'Member role changed',
  },

  // --- organization --------------------------------------------------------
  {
    action: 'organization.created',
    entityType: 'organization',
    sensitivity: 'normal',
    description: 'Organization created',
  },
  {
    action: 'organization.updated',
    entityType: 'organization',
    sensitivity: 'normal',
    description: 'Organization settings updated',
  },
  {
    action: 'organization.security_updated',
    entityType: 'organization',
    sensitivity: 'critical',
    description: 'Security settings changed',
  },
  {
    action: 'organization.deleted',
    entityType: 'organization',
    sensitivity: 'critical',
    description: 'Organization deleted',
  },

  // --- customers -----------------------------------------------------------
  {
    action: 'customer.created',
    entityType: 'customer',
    sensitivity: 'normal',
    description: 'Customer created',
  },
  {
    action: 'customer.updated',
    entityType: 'customer',
    sensitivity: 'normal',
    description: 'Customer updated',
  },
  {
    action: 'customer.deleted',
    entityType: 'customer',
    sensitivity: 'critical',
    description: 'Customer deleted',
  },
  {
    action: 'customer.sensitive_revealed',
    entityType: 'customer',
    sensitivity: 'critical',
    description: 'Sensitive field revealed',
  },
  {
    action: 'customer.exported',
    entityType: 'customer',
    sensitivity: 'critical',
    description: 'Customer data exported',
  },

  // --- documents -----------------------------------------------------------
  {
    action: 'document.uploaded',
    entityType: 'document',
    sensitivity: 'sensitive',
    description: 'Document uploaded',
  },
  {
    action: 'document.downloaded',
    entityType: 'document',
    sensitivity: 'sensitive',
    description: 'Signed URL issued for a document',
  },
  {
    action: 'document.deleted',
    entityType: 'document',
    sensitivity: 'critical',
    description: 'Document deleted',
  },
  {
    action: 'extraction.completed',
    entityType: 'document_extraction',
    sensitivity: 'normal',
    description: 'OCR extraction completed',
  },
  {
    action: 'extraction.accepted',
    entityType: 'document_extraction',
    sensitivity: 'sensitive',
    description: 'Extracted fields accepted into the profile',
  },
  {
    action: 'extraction.rejected',
    entityType: 'document_extraction',
    sensitivity: 'normal',
    description: 'Extracted fields rejected',
  },
  {
    action: 'derivative.created',
    entityType: 'document_derivative',
    sensitivity: 'normal',
    description: 'Prepared file generated',
  },

  // --- form filling --------------------------------------------------------
  {
    action: 'fill_session.started',
    entityType: 'fill_session',
    sensitivity: 'sensitive',
    description: 'Form detection started',
  },
  {
    action: 'fill_session.completed',
    entityType: 'fill_session',
    sensitivity: 'sensitive',
    description: 'Fields filled on a form',
  },
  {
    action: 'form_report.created',
    entityType: 'form_report',
    sensitivity: 'normal',
    description: 'Unsupported form reported',
  },
  {
    action: 'adapter.updated',
    entityType: 'portal_adapter',
    sensitivity: 'normal',
    description: 'Portal adapter changed',
  },

  // --- applications --------------------------------------------------------
  {
    action: 'application.created',
    entityType: 'application',
    sensitivity: 'normal',
    description: 'Application created',
  },
  {
    action: 'application.updated',
    entityType: 'application',
    sensitivity: 'normal',
    description: 'Application updated',
  },
  {
    action: 'application.status_changed',
    entityType: 'application',
    sensitivity: 'normal',
    description: 'Application status changed',
  },
  {
    action: 'application.deleted',
    entityType: 'application',
    sensitivity: 'sensitive',
    description: 'Application deleted',
  },

  // --- billing -------------------------------------------------------------
  {
    action: 'billing.plan_changed',
    entityType: 'subscription',
    sensitivity: 'sensitive',
    description: 'Plan changed',
  },
  {
    action: 'billing.webhook_processed',
    entityType: 'subscription',
    sensitivity: 'normal',
    description: 'Billing webhook processed',
  },

  // --- privacy -------------------------------------------------------------
  {
    action: 'consent.granted',
    entityType: 'consent_record',
    sensitivity: 'sensitive',
    description: 'Consent recorded',
  },
  {
    action: 'consent.withdrawn',
    entityType: 'consent_record',
    sensitivity: 'sensitive',
    description: 'Consent withdrawn',
  },
  {
    action: 'data.export_requested',
    entityType: 'data_request',
    sensitivity: 'critical',
    description: 'Data export requested',
  },
  {
    action: 'data.delete_requested',
    entityType: 'data_request',
    sensitivity: 'critical',
    description: 'Data deletion requested',
  },
  {
    action: 'data.deleted',
    entityType: 'data_request',
    sensitivity: 'critical',
    description: 'Data deleted',
  },

  // --- support -------------------------------------------------------------
  {
    action: 'support.access_granted',
    entityType: 'support_access_grant',
    sensitivity: 'critical',
    description: 'Support access granted',
  },
  {
    action: 'support.access_used',
    entityType: 'support_access_grant',
    sensitivity: 'critical',
    description: 'Support access used',
  },
  {
    action: 'support.access_revoked',
    entityType: 'support_access_grant',
    sensitivity: 'critical',
    description: 'Support access revoked',
  },
] as const);

export type AuditAction = (typeof AUDIT_ACTIONS)[number]['action'];

export const AUDIT_ACTION_BY_NAME: ReadonlyMap<string, AuditActionDef> = new Map(
  AUDIT_ACTIONS.map((definition) => [definition.action, definition]),
);

export function auditSensitivityFor(action: AuditAction): AuditSensitivity {
  return AUDIT_ACTION_BY_NAME.get(action)?.sensitivity ?? 'sensitive';
}

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === 'string' && AUDIT_ACTION_BY_NAME.has(value);
}

/**
 * Shape of an audit entry. `metadata` must already be redacted — build it with
 * `redact()` from ../privacy/redact.js.
 */
export type AuditEntry = {
  organizationId: string | null;
  actorUserId: string | null;
  actorType: AuditActorType;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  sensitivity: AuditSensitivity;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};
