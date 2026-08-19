import 'server-only';

import { auditSensitivityFor, redact, type AuditAction } from '@assistigo/core';
import type { Json } from '../supabase/database.types';
import type { RequestContext } from './context';
import { logger } from './logger';

/**
 * Writes an audit entry.
 * Master spec §19.5. The action catalogue lives in packages/core/src/audit/actions.ts.
 *
 * Metadata is redacted here rather than at the call site, so a careless caller cannot leak a
 * customer value into the audit trail.
 *
 * Auditing is best-effort at the transport level: if the insert fails we log loudly but do not
 * fail the user's request, because losing the audit line is better than losing the customer's
 * work. A persistent failure shows up as an error-rate alert.
 */
export async function writeAuditLog(
  context: RequestContext,
  input: {
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const entry = {
    organization_id: context.organization.id,
    actor_user_id: context.userId,
    actor_type: context.actorType,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    sensitivity: auditSensitivityFor(input.action),
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    metadata: (redact(input.metadata ?? {}) ?? {}) as Json,
  };

  const { error } = await context.supabase.from('audit_logs').insert(entry);

  if (error) {
    logger.error('audit.write_failed', {
      action: input.action,
      entityType: input.entityType,
      dbError: error.message,
    });
  }
}
