import { describe, it, expect } from 'vitest';
import { nextIndexFromNetwork, healthyPublishFlow, confirmFeedIndexAtLeast } from '../src/swarm/feed.js';
import { FeedWriteUnconfirmedError } from '../src/errors.js';
import type { FeedState } from '../src/types.js';
import { FeedEmptyError } from '../src/errors.js';

const REF = 'c'.repeat(64);

describe('nextIndexFromNetwork (P1-3, P1-7)', () => {
  it('uses feedIndexNext from the network when present', () => {
    const state: FeedState = { reference: REF, feedIndex: '2', feedIndexNext: '3' };
    expect(nextIndexFromNetwork(state)).toBe('3');
  });

  it('falls back to last index + 1 when the node reports only feedIndex', () => {
    const state: FeedState = { reference: REF, feedIndex: '2', feedIndexNext: null };
    expect(nextIndexFromNetwork(state)).toBe('3');
  });

  it('starts at 0 for an empty (never-written) feed', () => {
    expect(nextIndexFromNetwork(null)).toBe('0');
  });

  it('never takes an index from a local counter — the function only reads network state', () => {
    // There is no argument for a "persisted index" anywhere in the signature.
    const signature = nextIndexFromNetwork.toString();
    expect(signature).not.toMatch(/local|persist|counter|json|db/i);
  });
});

describe('healthyPublishFlow (P1-3, P1-7)', () => {
  it('reads the network immediately before writing, then confirms the write is network-visible', async () => {
    const calls: string[] = [];
    let reads = 0;
    const access = {
      readState: async () => {
        calls.push('read');
        reads += 1;
        // The write lands at index 5; the network converges on the next poll.
        return { reference: REF, feedIndex: reads === 1 ? '4' : '5', feedIndexNext: '5' } satisfies FeedState;
      },
      writeReference: async (reference: string) => {
        calls.push('write:' + reference);
      },
    };
    const result = await healthyPublishFlow(access, REF, 'batch-1', {});
    expect(calls.filter((c) => c === 'write:' + REF).length).toBe(1);
    expect(calls[0]).toBe('read');
    expect(calls.includes('write:' + REF)).toBe(true);
    expect(result.index).toBe('5');
    expect(result.startedEmpty).toBe(false);
  });

  it('handles a throwing empty feed (first run) gracefully and confirms index 0 afterwards', async () => {
    const reads: string[] = [];
    const access = {
      readState: async () => {
        const before = reads.length === 0;
        reads.push('read');
        if (before) throw new FeedEmptyError('Feed has never been updated.');
        return { reference: REF, feedIndex: '0', feedIndexNext: '1' } satisfies FeedState;
      },
      writeReference: async () => {},
    };
    const result = await healthyPublishFlow(access, REF, 'batch-1', {});
    expect(result.index).toBe('0');
    expect(result.startedEmpty).toBe(true);
  });

  it('propagates non-empty-feed failures', async () => {
    const access = {
      readState: async () => {
        throw new Error('boom');
      },
      writeReference: async () => {},
    };
    await expect(healthyPublishFlow(access, REF, 'batch-1', {})).rejects.toThrow('boom');
  });

  it('polls the network until a lagging update (index 1) becomes visible, then converges', async () => {
    const observed: string[] = ['0', '0', '0', '1'];
    let n = 0;
    const access = {
      readState: async () => {
        const idx = observed[Math.min(n++, observed.length - 1)] ?? '0';
        return { reference: REF, feedIndex: idx, feedIndexNext: String(BigInt(idx) + 1n) } satisfies FeedState;
      },
      writeReference: async () => {},
    };
    await expect(confirmFeedIndexAtLeast(access, 1n, { confirmAttempts: 8, confirmDelayMs: 1 })).resolves.toBeUndefined();
  });

  it('throws FeedWriteUnconfirmedError when the network never observes the write (honest failure)', async () => {
    const access = {
      readState: async () => ({ reference: REF, feedIndex: '0', feedIndexNext: '1' }) satisfies FeedState,
      writeReference: async () => {},
    };
    await expect(
      confirmFeedIndexAtLeast(access, 1n, { confirmAttempts: 3, confirmDelayMs: 1 }),
    ).rejects.toBeInstanceOf(FeedWriteUnconfirmedError);
  });

  it('confirmWrite: false skips the confirmation reads', async () => {
    const calls: string[] = [];
    const access = {
      readState: async () => {
        calls.push('read');
        return { reference: REF, feedIndex: '4', feedIndexNext: '5' } satisfies FeedState;
      },
      writeReference: async () => {
        calls.push('write');
      },
    };
    const result = await healthyPublishFlow(access, REF, 'batch-1', { confirmWrite: false });
    expect(calls).toEqual(['read', 'write']);
    expect(result.index).toBe('5');
  });
});