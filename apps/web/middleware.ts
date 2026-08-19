import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Refreshes the Supabase session cookie on every request and keeps signed-out users out of the
 * dashboard.
 *
 * This is a redirect, not an authorization decision. Real authorization happens in the route
 * handlers and again in RLS (docs/ARCHITECTURE.md §5) — middleware runs on the edge and must
 * never be the only thing standing between a user and someone else's data.
 */

const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/demo',
  '/legal',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/demo-forms',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * A Chrome extension calls the API from `chrome-extension://<id>`, which is cross-origin, so
 * every one of those requests is preflighted and dropped unless the response allows the origin.
 *
 * The id is matched against EXTENSION_ALLOWED_IDS — the same gate as pairing — and in local dev
 * any well-formed id is accepted, mirroring `resolveExtensionId`. That function is not reused
 * directly because it is `server-only` and this file runs on the edge.
 *
 * Credentials are never allowed: the extension authenticates with a bearer token, so the
 * dashboard's cookies must not ride along on these requests.
 */
const EXTENSION_ORIGIN = /^chrome-extension:\/\/([a-p]{32})$/;

function allowedExtensionOrigin(origin: string | null): string | null {
  if (!origin) return null;

  const id = EXTENSION_ORIGIN.exec(origin)?.[1];
  if (!id) return null;

  const allowed = (process.env.EXTENSION_ALLOWED_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowed.length > 0) return allowed.includes(id) ? origin : null;

  return process.env.NEXT_PUBLIC_APP_ENV === 'local' ? origin : null;
}

function withCors(response: NextResponse, origin: string): NextResponse {
  response.headers.set('access-control-allow-origin', origin);
  response.headers.set('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  response.headers.set(
    'access-control-allow-headers',
    'authorization, content-type, x-assistigo-org',
  );
  response.headers.set('access-control-max-age', '600');
  // The allowed origin varies per caller, so a shared cache must not reuse one extension's
  // headers for another.
  response.headers.append('vary', 'Origin');
  return response;
}

export async function middleware(request: NextRequest) {
  // API routes: no session redirect, but the extension needs CORS. Handled before anything else
  // so a preflight — which carries no cookies — never reaches the auth logic below.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = allowedExtensionOrigin(request.headers.get('origin'));
    if (!origin) return NextResponse.next({ request });

    if (request.method === 'OPTIONS') {
      return withCors(new NextResponse(null, { status: 204 }), origin);
    }
    return withCors(NextResponse.next({ request }), origin);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured there is no session to refresh; let the page render its own
  // configuration error rather than redirect-looping.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = '/sign-in';
    signIn.search = '';
    // Only same-origin paths are echoed back, so this cannot be used as an open redirect.
    signIn.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  if (user && (pathname === '/sign-in' || pathname === '/sign-up')) {
    const home = request.nextUrl.clone();
    home.pathname = '/dashboard';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets.
     *
     * API routes are included only so extension requests get CORS headers; they still do their
     * own authentication and return 401 JSON rather than a redirect, and the handler above
     * returns early for them without touching the session.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
