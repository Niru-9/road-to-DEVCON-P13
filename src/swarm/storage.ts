// Deterministic storage-helpers (P1-6): batch lifetime / status and manifest
// byte round-trips. No Bee I/O here — purely computable from values the CLI
// already fetched. `formatRemainingLifetime` drives the CLI's human "remaining"
// column; `batchStatus` classifies PAID / EXPIRING / EXPIRED so the CLI can
// warn before an update lands.

export interface BatchThresholds {
  /** Below this remaining lifetime (ms) a batch is EXPIRING. */
  expiringWhenUnderMs: number;
  /** At or below this remaining lifetime (ms) a batch is EXPIRED. */
  expiredWhenAtMostMs: number;
}

export const defaultThresholds: BatchThresholds = {
  expiringWhenUnderMs: 3 * 24 * 60 * 60 * 1000,
  expiredWhenAtMostMs: 6 * 60 * 60 * 1000,
};

export type BatchStatusKind = 'PAID' | 'EXPIRING' | 'EXPIRED';

export interface BatchStatusInput {
  /** Remaining lifetime in ms as reported by Bee. */
  durationMs: number;
  /** Whether the batch is usable for uploads right now. */
  usable: boolean;
}

export function batchStatus(
  input: BatchStatusInput,
  thresholds: BatchThresholds = defaultThresholds,
): { status: BatchStatusKind; durationMs: number } {
  if (!input.usable || input.durationMs <= thresholds.expiredWhenAtMostMs) {
    return { status: 'EXPIRED', durationMs: input.durationMs };
  }
  if (input.durationMs < thresholds.expiringWhenUnderMs) {
    return { status: 'EXPIRING', durationMs: input.durationMs };
  }
  return { status: 'PAID', durationMs: input.durationMs };
}

/** Human lifetime string, e.g. "6d 14h", "2h 3m", "45m". `null` → "unknown". */
export function formatRemainingLifetime(remainingMs: number | null): string {
  if (remainingMs === null) return 'unknown';
  if (remainingMs < 1000) return '0m';
  const units: Array<{ label: string; sizeMs: number }> = [
    { label: 'd', sizeMs: 24 * 60 * 60 * 1000 },
    { label: 'h', sizeMs: 60 * 60 * 1000 },
    { label: 'm', sizeMs: 60 * 1000 },
  ];
  const parts: string[] = [];
  let rest = remainingMs;
  for (const { label, sizeMs } of units) {
    const n = Math.floor(rest / sizeMs);
    if (n > 0) {
      parts.push(`${n}${label}`);
      rest -= n * sizeMs;
      if (parts.length === 2) break;
    }
  }
  return parts.length > 0 ? parts.join(' ') : '0m';
}
