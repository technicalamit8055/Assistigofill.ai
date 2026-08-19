import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * The extension calls the dashboard from a `chrome-extension://` origin, so every request is
 * preflighted. When these headers are missing the browser drops the request before it is sent
 * and the operator sees "the extension refused the connection" — a failure that looks like an
 * extension bug and leaves no server-side trace, which is exactly why it is worth a test.
 */

const ID = 'abcdefghijklmnopabcdefghijklmnop';

async function loadCors(env: { allowed?: string; appEnv?: string }) {
  vi.resetModules();
  vi.doMock('../env', () => ({
    serverEnv: () => ({ EXTENSION_ALLOWED_IDS: env.allowed ?? '' }),
    publicEnv: () => ({ NEXT_PUBLIC_APP_ENV: env.appEnv ?? 'local' }),
  }));
  return import('./cors');
}

function request(origin: string | null): Request {
  return new Request('http://localhost:3000/api/extension/pair', {
    method: 'OPTIONS',
    headers: origin ? { origin } : {},
  });
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.doUnmock('../env'));

describe('allowedExtensionOrigin', () => {
  it('allows a well-formed extension id in local dev', async () => {
    const { allowedExtensionOrigin } = await loadCors({});
    expect(allowedExtensionOrigin(request(`chrome-extension://${ID}`))).toBe(
      `chrome-extension://${ID}`,
    );
  });

  it('allows only allowlisted ids when an allowlist is set', async () => {
    const other = 'ponmlkjihgfedcbaponmlkjihgfedcba';
    const { allowedExtensionOrigin } = await loadCors({ allowed: ID, appEnv: 'production' });

    expect(allowedExtensionOrigin(request(`chrome-extension://${ID}`))).not.toBeNull();
    expect(allowedExtensionOrigin(request(`chrome-extension://${other}`))).toBeNull();
  });

  it('fails closed outside local when the allowlist is empty', async () => {
    const { allowedExtensionOrigin } = await loadCors({ appEnv: 'production' });
    expect(allowedExtensionOrigin(request(`chrome-extension://${ID}`))).toBeNull();
  });

  it('refuses a web origin, a malformed id and a missing origin', async () => {
    const { allowedExtensionOrigin } = await loadCors({});

    for (const origin of [
      'https://evil.example',
      'chrome-extension://short',
      // 'z' is outside the a-p alphabet a real extension id uses.
      `chrome-extension://${'z'.repeat(32)}`,
      'chrome-extension://' + ID + '.evil.example',
    ]) {
      expect(allowedExtensionOrigin(request(origin)), origin).toBeNull();
    }
    expect(allowedExtensionOrigin(request(null))).toBeNull();
  });
});

describe('extensionPreflight', () => {
  it('answers an allowed extension with the headers the browser requires', async () => {
    const { extensionPreflight } = await loadCors({});
    const response = extensionPreflight(request(`chrome-extension://${ID}`));

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(`chrome-extension://${ID}`);
    expect(response.headers.get('access-control-allow-headers')).toContain('content-type');
    expect(response.headers.get('vary')).toContain('Origin');
  });

  it('never allows credentials, so the dashboard session cannot ride along', async () => {
    const { extensionPreflight } = await loadCors({});
    const response = extensionPreflight(request(`chrome-extension://${ID}`));
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('omits the headers for a disallowed origin', async () => {
    const { extensionPreflight } = await loadCors({});
    const response = extensionPreflight(request('https://evil.example'));

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
