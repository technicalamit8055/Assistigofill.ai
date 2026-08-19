import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import {
  PermissionDeniedError,
  InvalidStatusTransitionError,
  isAppError,
  newTraceId,
  validationFailed,
} from '@assistigo/core';
import { logger } from './logger';

/**
 * Uniform API responses.
 *
 * Success:  { data: … }
 * Failure:  { error: { code, messageKey, traceId, details? } }
 *
 * `messageKey` is a translation key so the operator sees the message in their own language,
 * and the trace id is the only way a user-visible error connects to a server log line
 * (spec §27.3).
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    // Zod messages in this codebase are translation keys (see packages/core schemas).
    out[path] ??= issue.message;
  }
  return out;
}

export function toErrorResponse(error: unknown, event: string): NextResponse {
  const traceId = newTraceId();

  if (error instanceof ZodError) {
    const appError = validationFailed({ fields: fieldErrors(error) });
    logger.warn(event, { traceId, code: appError.code, fields: Object.keys(fieldErrors(error)) });
    return NextResponse.json(appError.toResponseBody(traceId), { status: appError.status });
  }

  if (error instanceof PermissionDeniedError) {
    logger.warn(event, { traceId, code: error.code, permission: error.permission });
    return NextResponse.json(
      {
        error: {
          code: 'PERMISSION_DENIED',
          messageKey: 'errors.permission_denied',
          traceId,
        },
      },
      { status: 403 },
    );
  }

  if (error instanceof InvalidStatusTransitionError) {
    logger.warn(event, { traceId, code: error.code, from: error.from, to: error.to });
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          messageKey: 'errors.invalid_status_transition',
          traceId,
          details: { from: error.from, to: error.to },
        },
      },
      { status: 422 },
    );
  }

  if (isAppError(error)) {
    const level = error.status >= 500 ? 'error' : 'warn';
    logger[level](event, { traceId, code: error.code });
    return NextResponse.json(error.toResponseBody(traceId), { status: error.status });
  }

  // Unknown failure. The client gets a trace id and nothing else — no message, no stack, no
  // database detail that might echo a customer value back out.
  logger.error(event, { traceId, error });
  return NextResponse.json(
    { error: { code: 'INTERNAL', messageKey: 'errors.internal', traceId } },
    { status: 500 },
  );
}

/**
 * Wraps a route handler so every failure becomes a uniform, redacted response.
 *
 *   export const POST = handler('customers.create', async (request) => { … });
 */
export function handler<Args extends unknown[]>(
  event: string,
  fn: (request: Request, ...args: Args) => Promise<NextResponse>,
) {
  return async (request: Request, ...args: Args): Promise<NextResponse> => {
    try {
      return await fn(request, ...args);
    } catch (error) {
      return toErrorResponse(error, event);
    }
  };
}

/**
 * Parse and validate a JSON body. Throws ZodError, which `handler` turns into a 400.
 *
 * Typed on `z.output` rather than a single `T`: schemas here use `.default()` and `.transform()`,
 * so the parsed result is not the same shape as the accepted input, and collapsing the two makes
 * every defaulted field look optional downstream.
 */
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw validationFailed({ fields: { _: 'errors.invalid_json' } });
  }
  return schema.parse(raw) as z.output<S>;
}

/** Parse and validate query parameters. */
export function parseQuery<S extends ZodTypeAny>(request: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return schema.parse(params) as z.output<S>;
}
