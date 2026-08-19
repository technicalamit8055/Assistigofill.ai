/**
 * Environment access, validated once.
 *
 * Server-only secrets are read through `serverEnv()`, which throws if called from the browser.
 * That makes an accidental import into a client component a build-time crash rather than a
 * leaked service-role key.
 */

import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_ENV: z.enum(['local', 'development', 'staging', 'production']).default('local'),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  FIELD_ENCRYPTION_KEY: z.string().min(1).optional(),
  OCR_PROVIDER: z.enum(['mock', 'tesseract', 'anthropic']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
  BILLING_PROVIDER: z.enum(['mock', 'razorpay', 'stripe']).default('mock'),
  EXTENSION_ALLOWED_IDS: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

// Next inlines process.env.NEXT_PUBLIC_* at build time only for literal property access,
// so these must be written out rather than looped over.
const rawPublic = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

let cachedPublic: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = publicSchema.safeParse(rawPublic);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(
      `Missing or invalid public environment variables: ${missing}. ` +
        'Copy .env.example to .env.local and run `npm run verify:env`.',
    );
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

let cachedServer: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() was called in the browser. Server secrets must never be bundled.');
  }
  if (cachedServer) return cachedServer;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Missing or invalid server environment variables: ${missing}.`);
  }
  cachedServer = parsed.data;
  return cachedServer;
}

export function isProduction(): boolean {
  return publicEnv().NEXT_PUBLIC_APP_ENV === 'production';
}

export function isLocal(): boolean {
  return publicEnv().NEXT_PUBLIC_APP_ENV === 'local';
}
