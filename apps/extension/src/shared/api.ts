/**
 * API client.
 * Master spec §15.1.7 — HTTPS to the Assistigo backend, and no service secrets in the extension.
 *
 * Only the service worker uses this. Content scripts and UI surfaces go through messages, so a
 * compromised page can never reach the API directly with the operator's token.
 */

import { sessionStore, settingsStore, type StoredSession } from './storage';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messageKey: string,
    readonly traceId?: string,
  ) {
    super(`${status} ${messageKey}`);
    this.name = 'ApiError';
  }
}

/** Refresh a minute early so a request never starts with a token that expires mid-flight. */
const REFRESH_MARGIN_MS = 60_000;

async function currentSession(): Promise<StoredSession | null> {
  const session = await sessionStore.get();
  if (!session) return null;
  if (session.expiresAt - REFRESH_MARGIN_MS > Date.now()) return session;

  const refreshed = await refreshSession(session.refreshToken);
  if (!refreshed) {
    await sessionStore.clear();
    return null;
  }
  await sessionStore.set(refreshed);
  return refreshed;
}

async function refreshSession(refreshToken: string): Promise<StoredSession | null> {
  const { dashboardUrl } = await settingsStore.get();
  try {
    const response = await fetch(`${dashboardUrl}/api/extension/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: StoredSession };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { organizationId?: string } = {},
): Promise<T> {
  const session = await currentSession();
  if (!session) throw new ApiError(401, 'errors.unauthenticated');

  const { dashboardUrl } = await settingsStore.get();

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${session.accessToken}`);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  if (init.organizationId) headers.set('x-assistigo-org', init.organizationId);

  const response = await fetch(`${dashboardUrl}${path}`, { ...init, headers });

  if (!response.ok) {
    let messageKey = 'errors.internal';
    let traceId: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: { messageKey?: string; traceId?: string };
      };
      messageKey = body.error?.messageKey ?? messageKey;
      traceId = body.error?.traceId;
    } catch {
      // A non-JSON error body tells us nothing useful and may contain page content.
    }
    throw new ApiError(response.status, messageKey, traceId);
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json()) as { data: T };
  return body.data;
}

/** Exchanges a short-lived pairing code minted by the signed-in dashboard (docs/EXTENSION.md §3). */
export async function pairWithCode(code: string): Promise<StoredSession> {
  const { dashboardUrl } = await settingsStore.get();
  const response = await fetch(`${dashboardUrl}/api/extension/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) throw new ApiError(response.status, 'extension.pairing_failed');

  const body = (await response.json()) as { data: StoredSession };
  return body.data;
}
