/**
 * Display helpers for documents. Safe on both the server and the client — no secrets, no
 * customer values, so this file deliberately does not import `server-only`.
 */

const UNITS = ['B', 'KB', 'MB'] as const;

/** File sizes as an operator reads them: "184 KB", "2.4 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  // Whole numbers for bytes and kilobytes; one decimal for megabytes, where it matters to
  // someone checking a portal's upload limit.
  const rounded = unitIndex === UNITS.length - 1 ? value.toFixed(1) : Math.round(value).toString();
  return `${rounded} ${UNITS[unitIndex]}`;
}

/** Confidence as a percentage, for the review screen. */
export function formatConfidence(confidence: number | null): string {
  if (confidence === null) return '—';
  return `${Math.round(confidence * 100)}%`;
}
