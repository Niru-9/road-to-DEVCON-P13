// Postage batch lifetime handling (P1-6). Status is computed from
// node-reported fields only; thresholds are configurable constants.

import type { BatchStatus } from '../types.js';

export interface BatchLifetimeReadings {
  /** Node-reported duration (estimated time until expiry). Null when unknown. */
  durationMs: number | null;
  /** Whether the node reports the batch as usable for new uploads. */
  usable: boolean;
}

export interface BatchLifetimeThresholds {
  /** Within this window the batch is reported as EXPIRING rather than PAID. */
  expiringWhenUnderMs: number;
  /** When duration is at or below this the batch is considered EXPIRED. */
  expiredWhenAtMostMs: number;
}

export const defaultThresholds: BatchLifetimeThresholds = {
  expiringWhenUnderMs: 7 * 24 * 60 * 60 * 1000,
  expiredWhenAtMostMs: 0,
};

export function batchStatus(readings: BatchLifetimeReadings, thresholds: BatchLifetimeThresholds = defaultThresholds): BatchStatus {
  const { durationMs, usable } = readings;
  if (!usable && (durationMs === null || durationMs <= thresholds.expiredWhenAtMostMs)) {
    return { status: 'EXPIRED', durationMs };
  }
  if (!usable) {
    return { status: 'EXPIRED', durationMs };
  }
  if (durationMs !== null && durationMs <= thresholds.expiredWhenAtMostMs) {
    return { status: 'EXPIRED', durationMs };
  }
  if (durationMs !== null && durationMs < thresholds.expiringWhenUnderMs) {
    return { status: 'EXPIRING', durationMs };
  }
  return { status: 'PAID', durationMs };
}

export function formatRemainingLifetime(durationMs: number | null): string {
  if (durationMs === null) {
    return 'unknown';
  }
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}