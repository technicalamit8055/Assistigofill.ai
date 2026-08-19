/**
 * Extension storage.
 * Master spec §15.1.6, §19.6; docs/EXTENSION.md §7.
 *
 * The rule that governs this file: **nothing sensitive goes in `chrome.storage.local`.**
 * `local` survives a browser restart and is readable by anyone with the profile directory.
 * `session` is cleared when the browser closes and is never written to disk, so tokens, the
 * selected customer and recent customers all live there.
 */

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

export type StoredSettings = {
  locale: 'en' | 'hi';
  /** Whether to overwrite fields a portal pre-filled. Off by default (§14.5). */
  overwriteFilled: boolean;
  dashboardUrl: string;
};

/**
 * Which dashboard this build talks to.
 *
 * Baked in at build time (`VITE_DASHBOARD_URL=https://assistigo.ai npm run build:extension`) and
 * defaulting to the local dev server. It must match an origin in the manifest's
 * `externally_connectable`, or the connect page cannot hand the service worker a pairing code.
 */
const configuredDashboardUrl: unknown = import.meta.env.VITE_DASHBOARD_URL;

export const DEFAULT_SETTINGS: StoredSettings = {
  locale: 'en',
  overwriteFilled: false,
  dashboardUrl:
    typeof configuredDashboardUrl === 'string' && configuredDashboardUrl !== ''
      ? // A trailing slash would turn `${dashboardUrl}/api/…` into a double slash.
        configuredDashboardUrl.replace(/\/+$/, '')
      : 'http://localhost:3000',
};

const SESSION_KEY = 'session';
const CUSTOMER_KEY = 'selectedCustomer';
const RECENT_KEY = 'recentCustomers';
const SETTINGS_KEY = 'settings';

async function getSession<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.session.get(key);
  return (result[key] as T | undefined) ?? null;
}

async function setSession(key: string, value: unknown): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}

export const sessionStore = {
  get: () => getSession<StoredSession>(SESSION_KEY),
  set: (session: StoredSession) => setSession(SESSION_KEY, session),
  clear: () => chrome.storage.session.remove(SESSION_KEY),
};

export const selectedCustomerStore = {
  get: <T>() => getSession<T>(CUSTOMER_KEY),
  set: (customer: unknown) => setSession(CUSTOMER_KEY, customer),
  clear: () => chrome.storage.session.remove(CUSTOMER_KEY),
};

const MAX_RECENT = 10;

export const recentCustomersStore = {
  async get<T>(): Promise<T[]> {
    return (await getSession<T[]>(RECENT_KEY)) ?? [];
  },
  async push<T extends { id: string }>(customer: T): Promise<void> {
    const existing = await recentCustomersStore.get<T>();
    const next = [customer, ...existing.filter((item) => item.id !== customer.id)].slice(
      0,
      MAX_RECENT,
    );
    await setSession(RECENT_KEY, next);
  },
  clear: () => chrome.storage.session.remove(RECENT_KEY),
};

export const settingsStore = {
  async get(): Promise<StoredSettings> {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...((result[SETTINGS_KEY] as Partial<StoredSettings>) ?? {}) };
  },
  async set(patch: Partial<StoredSettings>): Promise<StoredSettings> {
    const next = { ...(await settingsStore.get()), ...patch };
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  },
};

/** Wipes everything that identifies a customer or authenticates a user. */
export async function clearAllSensitive(): Promise<void> {
  await Promise.all([
    sessionStore.clear(),
    selectedCustomerStore.clear(),
    recentCustomersStore.clear(),
  ]);
}
