import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  InvalidStatusTransitionError,
  allowedTransitions,
  assertTransition,
  canTransition,
  isOpen,
} from './status';

describe('application status machine', () => {
  it('labels every status in both languages', () => {
    for (const status of APPLICATION_STATUSES) {
      expect(APPLICATION_STATUS_LABELS[status].en).toBeTruthy();
      expect(APPLICATION_STATUS_LABELS[status].hi).toBeTruthy();
    }
  });

  it('walks the happy path', () => {
    expect(canTransition('draft', 'pending_documents')).toBe(true);
    expect(canTransition('pending_documents', 'ready_to_fill')).toBe(true);
    expect(canTransition('ready_to_fill', 'filled')).toBe(true);
    expect(canTransition('filled', 'submitted')).toBe(true);
    expect(canTransition('submitted', 'approved')).toBe(true);
  });

  it('refuses to skip the middle of the pipeline', () => {
    expect(canTransition('draft', 'submitted')).toBe(false);
    expect(canTransition('draft', 'approved')).toBe(false);
    expect(canTransition('pending_documents', 'filled')).toBe(false);
  });

  it('lets an operator step back when a portal times out', () => {
    expect(canTransition('filled', 'ready_to_fill')).toBe(true);
    expect(canTransition('ready_to_fill', 'pending_documents')).toBe(true);
  });

  it('allows a rejected application to be reworked', () => {
    expect(canTransition('rejected', 'draft')).toBe(true);
    expect(canTransition('rejected', 'pending_documents')).toBe(true);
  });

  it('keeps approved effectively terminal', () => {
    expect(allowedTransitions('approved')).toEqual(['pending_followup']);
    expect(canTransition('approved', 'draft')).toBe(false);
  });

  it('treats a no-op transition as allowed', () => {
    expect(() => assertTransition('submitted', 'submitted')).not.toThrow();
  });

  it('throws a typed error on an illegal move', () => {
    expect(() => assertTransition('draft', 'approved')).toThrow(InvalidStatusTransitionError);
    try {
      assertTransition('draft', 'approved');
    } catch (error) {
      expect((error as InvalidStatusTransitionError).status).toBe(422);
    }
  });

  it('knows which statuses count as open work', () => {
    expect(isOpen('pending_followup')).toBe(true);
    expect(isOpen('approved')).toBe(false);
    expect(isOpen('cancelled')).toBe(false);
  });

  it('never leaves a status stranded with no way out except the terminals', () => {
    for (const status of APPLICATION_STATUSES) {
      if (status === 'approved') continue;
      expect(allowedTransitions(status).length, status).toBeGreaterThan(0);
    }
  });
});
