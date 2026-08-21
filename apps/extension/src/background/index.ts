/**
 * Service worker.
 * Master spec §15.1.2, §15.4.
 *
 * The only component that talks to the API, and the only one that holds a token. It has no DOM
 * access by design, so a bug here cannot read or write a page.
 *
 * Flow (docs/EXTENSION.md §4):
 *   side panel → DETECT_FIELDS → content script → metadata
 *   metadata   → POST /api/forms/map → mapping proposal → side panel
 *   operator presses Fill
 *   side panel → APPLY_FILL (values, once) → content script → per-field results
 *   results    → PATCH /api/fill-sessions/:id
 */

import { ApiError, apiFetch, pairWithCode } from '../shared/api';
import {
  fail,
  ok,
  parseMessage,
  type CustomerSummary,
  type Message,
  type SessionState,
} from '../shared/messages';
import {
  clearAllSensitive,
  recentCustomersStore,
  selectedCustomerStore,
  sessionStore,
  settingsStore,
} from '../shared/storage';
import type { DetectionPayload, FieldMapping, FillResult } from '@assistigo/form-engine';

/**
 * Per-tab working state. Held in memory only: it dies with the service worker, which is the
 * correct lifetime for a half-finished fill.
 */
type TabState = {
  detection: DetectionPayload | null;
  mappings: FieldMapping[] | null;
  fillSessionId: string | null;
};

const tabStates = new Map<number, TabState>();

function stateFor(tabId: number): TabState {
  let state = tabStates.get(tabId);
  if (!state) {
    state = { detection: null, mappings: null, fillSessionId: null };
    tabStates.set(tabId, state);
  }
  return state;
}

chrome.tabs.onRemoved.addListener((tabId) => tabStates.delete(tabId));

// Opening the side panel from the toolbar icon is the only entry point that needs no page access.
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

/**
 * Which tab a message is about.
 *
 * The sender's own tab comes first, falling back to whichever tab is active. A message from the
 * side panel or the popup carries no `sender.tab`, so the fallback is what resolves those.
 */
async function targetTabId(sender?: chrome.runtime.MessageSender): Promise<number | null> {
  return sender?.tab?.id ?? (await activeTabId());
}

/**
 * Injects the content script on demand.
 *
 * `activeTab` grants access only after a user gesture, which is why the extension asks for no
 * host permissions at install time (§15.2).
 */
async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (pong) return true;
  } catch {
    // Not injected yet.
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
    return true;
  } catch {
    return false;
  }
}

async function sendToTab<T>(tabId: number, message: Message): Promise<T | null> {
  const injected = await ensureContentScript(tabId);
  if (!injected) return null;
  try {
    const response = (await chrome.tabs.sendMessage(tabId, message)) as
      { ok: true; data: T } | { ok: false; error: string } | undefined;
    return response && response.ok ? response.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

async function buildSessionState(): Promise<SessionState> {
  const settings = await settingsStore.get();
  const session = await sessionStore.get();

  if (!session) {
    return {
      connected: false,
      organizationName: null,
      organizationId: null,
      role: null,
      canFill: false,
      selectedCustomer: null,
      locale: settings.locale,
    };
  }

  try {
    const me = await apiFetch<{
      organization: { id: string; name: string; locale: 'en' | 'hi' };
      membership: { role: string };
      permissions: string[];
    }>('/api/me');

    return {
      connected: true,
      organizationName: me.organization.name,
      organizationId: me.organization.id,
      role: me.membership.role,
      canFill: me.permissions.includes('fill.run'),
      selectedCustomer: await selectedCustomerStore.get<CustomerSummary>(),
      locale: settings.locale ?? me.organization.locale,
    };
  } catch {
    return {
      connected: false,
      organizationName: null,
      organizationId: null,
      role: null,
      canFill: false,
      selectedCustomer: null,
      locale: settings.locale,
    };
  }
}

/**
 * "Connect account" opens the dashboard, which mints a pairing code for the signed-in user.
 * No password is ever typed into extension UI (docs/EXTENSION.md §3).
 *
 * The extension names itself in `?ext=`, because an unpacked build's id differs from the store
 * build's. The dashboard does not trust that parameter — it checks it against its own allowlist
 * before minting anything.
 */
async function connectAccount(): Promise<{ opened: true }> {
  const { dashboardUrl } = await settingsStore.get();
  const url = `${dashboardUrl}/extension/connect?ext=${encodeURIComponent(chrome.runtime.id)}`;
  await chrome.tabs.create({ url });
  return { opened: true };
}

/** The configured dashboard's origin, for an exact comparison against a message sender. */
function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** The connect page posts the code back through an externally-connectable message. */
chrome.runtime.onMessageExternal.addListener((raw, sender, sendResponse) => {
  void (async () => {
    const { dashboardUrl } = await settingsStore.get();
    // Only the configured dashboard origin may pair this extension. Compared as whole origins:
    // a prefix test would let http://localhost:300 pass for http://localhost:3000.
    const expected = originOf(dashboardUrl);
    if (!sender.origin || !expected || sender.origin !== expected) {
      sendResponse(fail('untrusted_origin'));
      return;
    }

    const code = (raw as { code?: unknown })?.code;
    if (typeof code !== 'string' || code.length < 10) {
      sendResponse(fail('invalid_code'));
      return;
    }

    try {
      await sessionStore.set(await pairWithCode(code));
      sendResponse(ok({ connected: true }));
    } catch {
      sendResponse(fail('pairing_failed'));
    }
  })();
  return true;
});

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------

async function route(message: Message, sender?: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'PING':
      return ok({ alive: true });

    case 'GET_SESSION':
      return ok(await buildSessionState());

    case 'CONNECT_ACCOUNT':
      return ok(await connectAccount());

    case 'DISCONNECT':
      await clearAllSensitive();
      return ok({ connected: false });

    case 'OPEN_DASHBOARD': {
      const { dashboardUrl } = await settingsStore.get();
      await chrome.tabs.create({ url: `${dashboardUrl}${message.path ?? '/dashboard'}` });
      return ok({ opened: true });
    }

    case 'SEARCH_CUSTOMERS': {
      const results = await apiFetch<{ customers: CustomerSummary[] }>(
        `/api/customers/search?q=${encodeURIComponent(message.query)}&limit=10`,
      );
      return ok(results);
    }

    case 'SELECT_CUSTOMER': {
      await selectedCustomerStore.set(message.customer);
      await recentCustomersStore.push(message.customer);
      return ok({ selected: message.customer });
    }

    case 'DETECT_FIELDS': {
      const tabId = await targetTabId(sender);
      if (tabId === null) return fail('no_active_tab');

      const injected = await ensureContentScript(tabId);
      if (!injected) return fail('detection_failed');

      let detection = await sendToTab<DetectionPayload>(tabId, { type: 'DETECT_FIELDS' });

      // Aggregate fields from all subframes if available
      try {
        if (chrome.webNavigation?.getAllFrames) {
          const frames = await chrome.webNavigation.getAllFrames({ tabId });
          if (frames && frames.length > 1) {
            const allFields: DetectionPayload['fields'] = detection?.fields ? [...detection.fields] : [];
            let mainPageContext = detection?.page;

            for (const frame of frames) {
              if (frame.frameId === 0) continue;
              try {
                const response = (await chrome.tabs.sendMessage(
                  tabId,
                  { type: 'DETECT_FIELDS' },
                  { frameId: frame.frameId },
                )) as { ok: true; data: DetectionPayload } | undefined;
                if (response?.ok && response.data) {
                  if (!mainPageContext || (!mainPageContext.title && response.data.page.title)) {
                    mainPageContext = response.data.page;
                  }
                  const subFields = response.data.fields.map((f, idx) => ({
                    ...f,
                    frame: frame.frameId,
                    order: allFields.length + idx,
                  }));
                  allFields.push(...subFields);
                }
              } catch {
                // Subframe unreadable or script not loaded
              }
            }

            if (allFields.length > 0 || mainPageContext) {
              detection = {
                page: mainPageContext ?? { origin: '', path: '', title: null, blockedFrames: 0 },
                fields: allFields,
              };
            }
          }
        }
      } catch {
        // Fallback to top frame detection
      }

      if (!detection) return fail('detection_failed');

      stateFor(tabId).detection = detection;
      return ok(detection);
    }

    case 'REQUEST_MAPPING': {
      const tabId = await targetTabId(sender);
      if (tabId === null) return fail('no_active_tab');

      const state = stateFor(tabId);
      const customer = await selectedCustomerStore.get<CustomerSummary>();
      if (!state.detection) return fail('no_detection');
      if (!customer) return fail('no_customer_selected');

      const proposal = await apiFetch<{
        fillSessionId: string;
        mappings: FieldMapping[];
        /** Signatures in dependency order; the side panel fills in this order. */
        fillOrder: string[];
        summary: Record<string, number>;
        values: Record<string, string>;
      }>('/api/forms/map', {
        method: 'POST',
        body: JSON.stringify({ customerId: customer.id, detection: state.detection }),
      });

      state.mappings = proposal.mappings;
      state.fillSessionId = proposal.fillSessionId;
      return ok(proposal);
    }

    case 'APPLY_FILL': {
      const tabId = await targetTabId(sender);
      if (tabId === null) return fail('no_active_tab');

      const state = stateFor(tabId);
      const response = await sendToTab<{ results: FillResult[] }>(tabId, message);

      // If elements were in subframes and top-frame missed them, attempt fill across subframes
      if (response && response.results) {
        const missingSignatures = response.results
          .filter((r) => r.action === 'failed' && r.error === 'element_not_found')
          .map((r) => r.signature);

        if (missingSignatures.length > 0 && chrome.webNavigation?.getAllFrames) {
          try {
            const frames = await chrome.webNavigation.getAllFrames({ tabId });
            if (frames) {
              for (const frame of frames) {
                if (frame.frameId === 0) continue;
                const subResponse = (await chrome.tabs
                  .sendMessage(tabId, message, { frameId: frame.frameId })
                  .catch(() => null)) as { ok: true; data: { results: FillResult[] } } | null;
                if (subResponse?.ok && subResponse.data.results) {
                  for (const subRes of subResponse.data.results) {
                    if (subRes.action === 'filled' || subRes.error !== 'element_not_found') {
                      const idx = response.results.findIndex((r) => r.signature === subRes.signature);
                      if (idx >= 0) response.results[idx] = subRes;
                    }
                  }
                }
              }
            }
          } catch {
            // Ignore subframe execution errors
          }
        }
      }

      if (!response) return fail('fill_failed');

      // Record the session. A logging failure must not lose the operator's work, so it is
      // reported but does not fail the fill.
      if (state.fillSessionId) {
        try {
          await apiFetch(`/api/fill-sessions/${state.fillSessionId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'filled', results: response.results }),
          });
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
        }
      }

      return ok(response);
    }

    case 'REPORT_FORM': {
      const tabId = await targetTabId(sender);
      const state = tabId === null ? null : stateFor(tabId);
      if (!state?.detection) return fail('no_detection');

      await apiFetch('/api/form-reports', {
        method: 'POST',
        body: JSON.stringify({
          page: state.detection.page,
          // Metadata only. No customer values leave the extension in a report (§9.6).
          fields: state.detection.fields.map((field) => ({
            signature: field.signature,
            tagName: field.tagName,
            inputType: field.inputType,
            name: field.name,
            id: field.id,
            labelText: field.labelText,
            required: field.required,
          })),
          note: message.note,
          fillSessionId: state.fillSessionId,
          screenshotConsent: message.includeScreenshot,
        }),
      });

      return ok({ reported: true });
    }

    case 'CREATE_APPLICATION': {
      const tabId = await targetTabId(sender);
      const state = tabId === null ? null : stateFor(tabId);
      const customer = await selectedCustomerStore.get<CustomerSummary>();
      if (!customer) return fail('no_customer_selected');

      const application = await apiFetch<{ id: string }>('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          customerId: customer.id,
          title: message.title,
          status: 'filled',
          portalUrl: state?.detection
            ? `${state.detection.page.origin}${state.detection.page.path}`
            : null,
          fillSessionId: state?.fillSessionId ?? null,
        }),
      });

      return ok(application);
    }

    default:
      return fail('unsupported_message');
  }
}

chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
  const message = parseMessage(raw, sender);
  if (!message) {
    sendResponse(fail('invalid_message'));
    return undefined;
  }

  route(message, sender)
    .then(sendResponse)
    .catch((error: unknown) => {
      const messageKey = error instanceof ApiError ? error.messageKey : 'errors.internal';
      // The error itself is never forwarded: it could carry a response body from the page.
      sendResponse(fail('request_failed', messageKey));
    });

  return true;
});
