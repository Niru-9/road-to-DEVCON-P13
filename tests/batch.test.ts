import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createBeeBatchReader,
  describeBatchLifetime,
  formatBatchLifetimeLine,
  type BatchLifetimeReader,
} from '../src/swarm/batch.js';
import { dispatch } from '../src/cli/main.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_ID = 'a1'.repeat(32);

function captureStdout(): { write: ReturnType<typeof vi.spyOn> } {
  const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  return { write };
}

function fakeReader(snapshot: { remainingMs: number | null; usable: boolean }): BatchLifetimeReader {
  return { read: async () => snapshot };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bee batch-lifetime adapter (P1-6)', () => {
  it('maps stamp.duration.toSeconds() onto a remaining-ms snapshot', async () => {
    const reader = createBeeBatchReader({
      stamp: {
        get: async () => ({ usable: true, duration: { toSeconds: () => 3600 } }),
      },
    });
    const snap = await reader.read(BATCH_ID);
    expect(snap.remainingMs).toBe(3_600_000);
    expect(snap.usable).toBe(true);
  });

  it('classifies + formats a live snapshot through batchStatus/formatRemainingLifetime', async () => {
    const line = await describeBatchLifetime(fakeReader({ remainingMs: 15 * DAY_MS, usable: true }), BATCH_ID);
    const text = formatBatchLifetimeLine(line);
    expect(text).toContain(`batch ${BATCH_ID}`);
    expect(text).toContain('lifetime-remaining 15d');
    expect(text).toContain('status PAID');
    expect(text).toContain('usable true');
  });

  it('flags an expiring and an expired/usable=false batch', async () => {
    const expiring = await describeBatchLifetime(fakeReader({ remainingMs: 2 * DAY_MS, usable: true }), BATCH_ID);
    expect(expiring.status).toBe('EXPIRING');
    const expired = await describeBatchLifetime(fakeReader({ remainingMs: 2 * DAY_MS, usable: false }), BATCH_ID);
    expect(expired.status).toBe('EXPIRED');
    expect(formatBatchLifetimeLine(expired)).toContain('status EXPIRED');
  });
});

describe('CLI surfaces the live batch lifetime (P1-6)', () => {
  it('status command prints the real remaining lifetime through the application output', async () => {
    const { write } = captureStdout();
    const code = await dispatch(['status', '--bee', 'http://localhost:9', '--batch-id', BATCH_ID], {
      batchLifetimeReader: fakeReader({ remainingMs: 15 * DAY_MS, usable: true }),
    });
    expect(code).toBe(0);
    const output = write.mock.calls.map((c: unknown[]) => String(c[0] ?? '')).join('');
    expect(output).toContain('status:');
    expect(output).toContain('lifetime-remaining 15d');
    expect(output).toContain('status PAID');
    expect(output).toContain(BATCH_ID);
  });

  it('publish command also surfaces the batch lifetime before the feed write', async () => {
    const { write } = captureStdout();
    const code = await dispatch(['publish', '--bee', 'http://localhost:9', '--batch-id', BATCH_ID], {
      batchLifetimeReader: fakeReader({ remainingMs: 15 * DAY_MS, usable: true }),
    });
    expect(code).toBe(0);
    const output = write.mock.calls.map((c: unknown[]) => String(c[0] ?? '')).join('');
    expect(output).toContain('publish:');
    expect(output).toContain('lifetime-remaining 15d');
    expect(output).not.toMatch(/PRIVATE_KEY|private[ -]?key|mnemonic|seed phrase/i);
  });

  it('rejects a publish/status call without a configured batch id', async () => {
    captureStdout();
    const code = await dispatch(['status', '--bee', 'http://localhost:9'], {
      batchLifetimeReader: fakeReader({ remainingMs: DAY_MS, usable: true }),
    });
    expect(code).toBe(2);
  });
});