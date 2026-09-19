import { describe, it, expect } from 'vitest';
import { nextIndexFromNetwork, healthyPublishFlow } from '../src/swarm/feed.js';
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
  it('reads the network immediately before writing and derives the index from it', async () => {
    const calls: string[] = [];
    const access = {
      readState: async () => {
        calls.push('read');
        return { reference: REF, feedIndex: '4', feedIndexNext: '5' } satisfies FeedState;
      },
      writeReference: async (reference: string) => {
        calls.push('write:' + reference);
      },
    };
    const result = await healthyPublishFlow(access, REF, 'batch-1', {});
    expect(calls).toEqual(['read', 'write:' + REF]);
    expect(result.index).toBe('5');
    expect(result.startedEmpty).toBe(false);
  });

  it('handles a throwing empty feed (first run) gracefully', async () => {
    const access = {
      readState: async () => {
        throw new FeedEmptyError('Feed has never been updated.');
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
});