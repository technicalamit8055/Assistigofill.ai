/**
 * The runtime message contract.
 * Master spec §15.3, §15.4; docs/EXTENSION.md §4.
 *
 * Every message is Zod-parsed on receipt and the sender is verified. A content script runs
 * inside a page Assistigo does not control, so anything arriving from it is treated as hostile
 * until it has been through `parseMessage`.
 */

import { z } from 'zod';
// Subpath import: the content script needs these schemas to validate messages, and pulling the
// package barrel would drag the dictionary, scorer and mapper into a page bundle that never
// uses them.
import {
  detectionPayloadSchema,
  fillInstructionSchema,
  fillResultSchema,
} from '@assistigo/form-engine/types';

/** The selected customer, as the extension holds it: identity plus just enough to confirm it. */
export const customerSummarySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().max(160),
  customerCode: z.string().max(20).nullable(),
  /** Last four digits only — enough to confirm the right person, useless if leaked (§8.2). */
  mobileLast4: z.string().length(4).nullable(),
});

export type CustomerSummary = z.infer<typeof customerSummarySchema>;

export const sessionStateSchema = z.object({
  connected: z.boolean(),
  organizationName: z.string().max(160).nullable(),
  organizationId: z.string().uuid().nullable(),
  role: z.string().max(30).nullable(),
  canFill: z.boolean(),
  selectedCustomer: customerSummarySchema.nullable(),
  locale: z.enum(['en', 'hi']).default('en'),
});

export type SessionState = z.infer<typeof sessionStateSchema>;

export const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PING') }),
  z.object({ type: z.literal('GET_SESSION') }),
  z.object({ type: z.literal('CONNECT_ACCOUNT') }),
  z.object({ type: z.literal('DISCONNECT') }),
  z.object({ type: z.literal('SEARCH_CUSTOMERS'), query: z.string().max(120) }),
  z.object({ type: z.literal('SELECT_CUSTOMER'), customer: customerSummarySchema }),
  z.object({ type: z.literal('OPEN_DASHBOARD'), path: z.string().max(200).optional() }),

  /** side panel → background → content */
  z.object({ type: z.literal('DETECT_FIELDS') }),
  /** content → background */
  z.object({ type: z.literal('DETECTION_RESULT'), payload: detectionPayloadSchema }),

  /** side panel → background → server */
  z.object({ type: z.literal('REQUEST_MAPPING') }),

  /**
   * side panel → background → content. The only message that ever carries customer values,
   * and it travels once, after the operator has pressed Fill.
   */
  z.object({
    type: z.literal('APPLY_FILL'),
    instructions: z.array(fillInstructionSchema).max(500),
  }),

  /** content → background → side panel */
  z.object({ type: z.literal('FILL_RESULT'), results: z.array(fillResultSchema).max(500) }),

  z.object({
    type: z.literal('REPORT_FORM'),
    note: z.string().max(1000),
    includeScreenshot: z.boolean().default(false),
  }),

  z.object({ type: z.literal('CREATE_APPLICATION'), title: z.string().max(160) }),
]);

export type Message = z.infer<typeof messageSchema>;
export type MessageType = Message['type'];

export type MessageResponse<T = unknown> =
  { ok: true; data: T } | { ok: false; error: string; messageKey?: string };

/**
 * Parses an inbound message and verifies the sender is this extension.
 *
 * A page can call `chrome.runtime.sendMessage(extensionId, …)` if it knows the id, so checking
 * `sender.id` is not optional.
 */
export function parseMessage(raw: unknown, sender?: chrome.runtime.MessageSender): Message | null {
  if (sender && sender.id !== chrome.runtime.id) return null;
  const parsed = messageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function ok<T>(data: T): MessageResponse<T> {
  return { ok: true, data };
}

export function fail(error: string, messageKey?: string): MessageResponse<never> {
  return messageKey ? { ok: false, error, messageKey } : { ok: false, error };
}
