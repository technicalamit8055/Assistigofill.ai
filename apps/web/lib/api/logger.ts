import { safeLogPayload } from '@assistigo/core';
import { isLocal } from '../env';

/**
 * Structured, redacted logging.
 * Master spec §24.2 — production logs must be structured and free of customer data.
 *
 * Everything passed as `payload` goes through `redact()` in @assistigo/core. Do not build log
 * lines with string interpolation: `logger.info('saved ' + name)` would defeat the redactor.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, event: string, payload?: Record<string, unknown>): void {
  const line = {
    level,
    time: new Date().toISOString(),
    ...safeLogPayload(event, payload ?? {}),
  };

  const serialised = JSON.stringify(line);
  if (level === 'error') console.error(serialised);
  else if (level === 'warn') console.warn(serialised);
  else console.log(serialised);
}

export const logger = {
  debug(event: string, payload?: Record<string, unknown>) {
    // Debug output exists only locally; staging and production stay quiet by design.
    if (isLocal()) emit('debug', event, payload);
  },
  info(event: string, payload?: Record<string, unknown>) {
    emit('info', event, payload);
  },
  warn(event: string, payload?: Record<string, unknown>) {
    emit('warn', event, payload);
  },
  error(event: string, payload?: Record<string, unknown>) {
    emit('error', event, payload);
  },
};
