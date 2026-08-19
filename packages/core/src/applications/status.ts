/**
 * Application status model and transition rules.
 * Master spec §21.3, §18.2 (applications, application_status_events).
 *
 * Note on honesty (§21.4): these statuses describe *the service centre's* workflow. They are
 * not an official government application status and must never be presented as one unless a
 * real portal integration is backing them.
 */

export const APPLICATION_STATUSES = [
  'draft',
  'pending_documents',
  'ready_to_fill',
  'filled',
  'submitted',
  'pending_followup',
  'approved',
  'rejected',
  'cancelled',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, { en: string; hi: string }> = {
  draft: { en: 'Draft', hi: 'ड्राफ्ट' },
  pending_documents: { en: 'Pending documents', hi: 'दस्तावेज़ बाकी' },
  ready_to_fill: { en: 'Ready to fill', hi: 'भरने के लिए तैयार' },
  filled: { en: 'Filled', hi: 'भरा गया' },
  submitted: { en: 'Submitted', hi: 'जमा किया गया' },
  pending_followup: { en: 'Pending follow-up', hi: 'फॉलो-अप बाकी' },
  approved: { en: 'Approved', hi: 'स्वीकृत' },
  rejected: { en: 'Rejected', hi: 'अस्वीकृत' },
  cancelled: { en: 'Cancelled', hi: 'रद्द' },
};

/** Drives badge colour in the dashboard. */
export const APPLICATION_STATUS_TONE: Record<
  ApplicationStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  draft: 'neutral',
  pending_documents: 'warning',
  ready_to_fill: 'info',
  filled: 'info',
  submitted: 'info',
  pending_followup: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  draft: ['pending_documents', 'ready_to_fill', 'cancelled'],
  pending_documents: ['draft', 'ready_to_fill', 'cancelled'],
  ready_to_fill: ['pending_documents', 'filled', 'cancelled'],
  // Going back from `filled` is allowed: portals time out and the operator refills.
  filled: ['ready_to_fill', 'submitted', 'cancelled'],
  submitted: ['pending_followup', 'approved', 'rejected', 'cancelled'],
  pending_followup: ['submitted', 'approved', 'rejected', 'cancelled'],
  // Approved is effectively terminal, but a correction round can reopen follow-up.
  approved: ['pending_followup'],
  // A rejection usually leads to a fresh attempt with corrected documents.
  rejected: ['draft', 'pending_documents', 'pending_followup', 'cancelled'],
  cancelled: ['draft'],
};

export const TERMINAL_STATUSES: readonly ApplicationStatus[] = ['approved', 'cancelled'];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function allowedTransitions(from: ApplicationStatus): readonly ApplicationStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return allowedTransitions(from).includes(to);
}

export class InvalidStatusTransitionError extends Error {
  readonly code = 'INVALID_STATUS_TRANSITION';
  readonly status = 422;
  constructor(
    readonly from: ApplicationStatus,
    readonly to: ApplicationStatus,
  ) {
    super(`Cannot move an application from "${from}" to "${to}".`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export function assertTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (from === to) return;
  if (!canTransition(from, to)) throw new InvalidStatusTransitionError(from, to);
}

/** Statuses shown as "open work" on the dashboard's pending count. */
export const OPEN_STATUSES: readonly ApplicationStatus[] = [
  'draft',
  'pending_documents',
  'ready_to_fill',
  'filled',
  'submitted',
  'pending_followup',
];

export function isOpen(status: ApplicationStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export const APPLICATION_DOCUMENT_STATUSES = [
  'required',
  'attached',
  'missing',
  'rejected',
] as const;
export type ApplicationDocumentStatus = (typeof APPLICATION_DOCUMENT_STATUSES)[number];
