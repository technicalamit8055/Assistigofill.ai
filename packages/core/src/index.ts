/**
 * @assistigo/core — pure domain logic shared by the dashboard, the API and the extension.
 *
 * No React, no Supabase client, no node-only APIs in this barrel. Field encryption lives at
 * `@assistigo/core/privacy/crypto` and is deliberately NOT re-exported here so it can never be
 * pulled into a browser or extension bundle.
 */

export * from './errors';

export * from './auth/roles';
export * from './auth/permissions';

export * from './privacy/mask';
export * from './privacy/redact';

export * from './customers/field-keys';
export * from './customers/normalize';
export * from './customers/schema';
export * from './customers/duplicates';

export * from './documents/types';

export * from './applications/status';

export * from './billing/plans';
export * from './billing/entitlements';

export * from './audit/actions';
