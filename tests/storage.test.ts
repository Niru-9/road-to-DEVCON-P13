import { describe, it, expect } from 'vitest';
import { batchStatus, formatRemainingLifetime, defaultThresholds } from '../src/swarm/storage.js';

describe('batchStatus (P1-6)', () => {
  it('reports PAID while usable and far from expiry', () => {
    const status = batchStatus({ durationMs: 30 * 24 * 60 * 60 * 1000, usable: true });
    expect(status).toEqual({ status: 'PAID', durationMs: 30 * 24 * 60 * 60 * 1000 });
  });

  it('reports EXPIRING inside the threshold window', () => {
    const near = 2 * 24 * 60 * 60 * 1000;
    expect(batchStatus({ durationMs: near, usable: true })).toEqual({ status: 'EXPIRING', durationMs: near });
  });

  it('reports EXPIRED for an unusable batch', () => {
    expect(batchStatus({ durationMs: 0, usable: false })).toEqual({ status: 'EXPIRED', durationMs: 0 });
  });

  it('treats an unusable batch as EXPIRED even with a long duration', () => {
    const status = batchStatus({ durationMs: 90 * 24 * 60 * 60 * 1000, usable: false });
    expect(status.status).toBe('EXPIRED');
  });

  it('uses configurable thresholds, never hardcoded lifetime', () => {
    const custom = { expiringWhenUnderMs: 1, expiredWhenAtMostMs: 0 };
    const oneMs = batchStatus({ durationMs: 5, usable: true }, custom);
    expect(oneMs.status).toBe('PAID');
    expect(defaultThresholds.expiringWhenUnderMs).toBeGreaterThan(0);
  });
});

describe('formatRemainingLifetime', () => {
  it('formats days/hours', () => {
    expect(formatRemainingLifetime(6 * 24 * 60 * 60 * 1000 + 14 * 3600 * 1000)).toBe('6d 14h');
  });
  it('formats hours/minutes', () => {
    expect(formatRemainingLifetime(2 * 3600 * 1000 + 3 * 60000)).toBe('2h 3m');
  });
  it('formats minutes', () => {
    expect(formatRemainingLifetime(45 * 60000)).toBe('45m');
  });
  it('handles null', () => {
    expect(formatRemainingLifetime(null)).toBe('unknown');
  });
});