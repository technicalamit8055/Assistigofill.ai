import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Pairing is the one place a dashboard session is handed to another program, so these tests are
 * about the properties that keep that safe rather than about happy-path plumbing:
 *
 *   - the code is never recoverable from what is stored,
 *   - a sealed session only opens with the code it was sealed against,
 *   - and an extension id nobody vouched for is refused.
 *
 * No real user data appears here (docs/DEVELOPMENT_RULES.md).
 */

const KEY = Buffer.alloc(32, 7).toString('base64');

/** Re-imports the module with a fresh env, because publicEnv/serverEnv cache on first read. */
async function loadPairing(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import('./pairing');
}

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-for-tests',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key-for-tests',
  FIELD_ENCRYPTION_KEY: KEY,
};

const SESSION = {
  accessToken: 'access-token-placeholder',
  refreshToken: 'refresh-token-placeholder',
  expiresAt: 1_800_000_000_000,
};

/** A well-formed Chrome extension id: 32 characters drawn from a–p. */
const EXT_A = 'abcdefghijklmnopabcdefghijklmnop';
const EXT_B = 'ponmlkjihgfedcbaponmlkjihgfedcba';

beforeEach(() => {
  vi.resetModules();
});

describe('pairing codes', () => {
  it('mints codes that are long, URL-safe and never repeat', async () => {
    const { newPairingCode } = await loadPairing(BASE_ENV);

    const codes = new Set(Array.from({ length: 200 }, () => newPairingCode()));

    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    }
  });

  it('stores only a hash, so what is persisted cannot be replayed', async () => {
    const { hashPairingCode, newPairingCode } = await loadPairing(BASE_ENV);

    const code = newPairingCode();
    const hash = hashPairingCode(code);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(code);
    expect(hashPairingCode(code)).toBe(hash);
    expect(hashPairingCode(newPairingCode())).not.toBe(hash);
  });
});

describe('session sealing', () => {
  it('round-trips a session through the code it was sealed against', async () => {
    const { hashPairingCode, newPairingCode, openSession, sealSession } =
      await loadPairing(BASE_ENV);

    const hash = hashPairingCode(newPairingCode());
    const sealed = await sealSession(SESSION, hash);

    expect(sealed).not.toContain(SESSION.accessToken);
    expect(sealed).not.toContain(SESSION.refreshToken);
    await expect(openSession(sealed, hash)).resolves.toEqual(SESSION);
  });

  it('refuses to open a payload under a different code', async () => {
    const { hashPairingCode, newPairingCode, openSession, sealSession } =
      await loadPairing(BASE_ENV);

    const sealed = await sealSession(SESSION, hashPairingCode(newPairingCode()));
    const otherHash = hashPairingCode(newPairingCode());

    // The AAD binding is what stops a stolen row being redeemed with an attacker-chosen code.
    await expect(openSession(sealed, otherHash)).resolves.toBeNull();
  });

  it('refuses a tampered payload rather than throwing', async () => {
    const { hashPairingCode, newPairingCode, openSession, sealSession } =
      await loadPairing(BASE_ENV);

    const hash = hashPairingCode(newPairingCode());
    const sealed = await sealSession(SESSION, hash);
    const tampered = `${sealed.slice(0, -4)}AAAA`;

    await expect(openSession(tampered, hash)).resolves.toBeNull();
    await expect(openSession('not-even-ciphertext', hash)).resolves.toBeNull();
  });
});

describe('resolveExtensionId', () => {
  it('accepts only ids on the allowlist when one is configured', async () => {
    const { resolveExtensionId } = await loadPairing({
      ...BASE_ENV,
      NEXT_PUBLIC_APP_ENV: 'production',
      EXTENSION_ALLOWED_IDS: ` ${EXT_A} `,
    });

    expect(resolveExtensionId(EXT_A)).toBe(EXT_A);
    expect(resolveExtensionId(EXT_B)).toBeNull();
  });

  it('refuses everything in production when the allowlist is empty', async () => {
    const { resolveExtensionId } = await loadPairing({
      ...BASE_ENV,
      NEXT_PUBLIC_APP_ENV: 'production',
      EXTENSION_ALLOWED_IDS: '',
    });

    // An unset allowlist must fail closed: this is the gate that stops a crafted
    // /extension/connect?ext=… link pairing someone else's extension.
    expect(resolveExtensionId(EXT_A)).toBeNull();
  });

  it('allows any well-formed id in local development', async () => {
    const { resolveExtensionId } = await loadPairing({
      ...BASE_ENV,
      NEXT_PUBLIC_APP_ENV: 'local',
      EXTENSION_ALLOWED_IDS: '',
    });

    expect(resolveExtensionId(EXT_A)).toBe(EXT_A);
    expect(resolveExtensionId(EXT_B)).toBe(EXT_B);
  });

  it('rejects anything that is not a Chrome extension id', async () => {
    const { resolveExtensionId } = await loadPairing({
      ...BASE_ENV,
      NEXT_PUBLIC_APP_ENV: 'local',
      EXTENSION_ALLOWED_IDS: '',
    });

    for (const value of [
      null,
      undefined,
      '',
      'short',
      `${EXT_A}z`, // 33 characters
      EXT_A.slice(1), // 31 characters
      EXT_A.replace('a', 'z'), // 'z' is outside a–p
      `${EXT_A.slice(0, 31)}.`,
      '../../etc/passwd',
    ]) {
      expect(resolveExtensionId(value)).toBeNull();
    }
  });
});
