import 'server-only';

import { NextResponse } from 'next/server';
import { resolveExtensionId } from './pairing';

/**
 * CORS for the extension API surface only.
 * docs/EXTENSION.md §3.
 *
 * The service worker calls the dashboard from a `chrome-extension://` origin, which is
 * cross-origin, so the browser preflights `/api/extension/*` and drops the request unless the
 * response allows that origin. Without this the pairing fetch never leaves the browser and the
 * operator sees "the extension refused the connection".
 *
 * Deliberately narrow. The origin is only echoed back when its id passes `resolveExtensionId`,
 * the same allowlist that gates minting, so this grants nothing that endpoint did not already
 * trust. Credentials are never allowed: these routes authenticate with a bearer token or a
 * one-time code, never with the dashboard's cookies, and `Allow-Credentials` would turn a
 * permitted extension into a session rider.
 */

const EXTENSION_ORIGIN = /^chrome-extension:\/\/([a-p]{32})$/;

/** The origin to echo back, or null when the caller is not an allowlisted extension. */
export function allowedExtensionOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  const id = EXTENSION_ORIGIN.exec(origin)?.[1];
  if (!id || !resolveExtensionId(id)) return null;

  return origin;
}

function applyCorsHeaders(response: NextResponse, origin: string): NextResponse {
  response.headers.set('access-control-allow-origin', origin);
  response.headers.set('access-control-allow-methods', 'POST, OPTIONS');
  response.headers.set('access-control-allow-headers', 'authorization, content-type');
  response.headers.set('access-control-max-age', '600');
  // The allowed origin varies per caller, so a shared cache must not reuse one extension's
  // response headers for another.
  response.headers.append('vary', 'Origin');
  return response;
}

/** Adds CORS headers when the caller is an allowlisted extension, and leaves them off otherwise. */
export function withExtensionCors(request: Request, response: NextResponse): NextResponse {
  const origin = allowedExtensionOrigin(request);
  return origin ? applyCorsHeaders(response, origin) : response;
}

/**
 * Preflight handler shared by the extension routes.
 *
 * A disallowed origin still gets a 204, but without the allow headers — the browser rejects it,
 * and the response says nothing about whether that id exists.
 */
export function extensionPreflight(request: Request): NextResponse {
  return withExtensionCors(request, new NextResponse(null, { status: 204 }));
}
