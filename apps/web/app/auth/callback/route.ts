import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/api/logger';

/**
 * Exchanges the one-time code from a confirmation or magic link for a session cookie.
 * Supabase Auth redirects here after email confirmation and password reset.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  // Only same-origin relative paths, so the callback cannot be turned into an open redirect.
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.warn('auth.callback_failed', { reason: error.message });
    return NextResponse.redirect(`${origin}/sign-in?error=invalid_code`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
