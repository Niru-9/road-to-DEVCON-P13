// Feed operations. The publisher derives the next index from the NETWORK state
// immediately before each update (P1-3, P1-7) — never from a local counter.

import type { FeedState } from '../types.js';
import { EMPTY_FEED_INDEX_NEXT } from '../types.js';

export interface FeedAccess {
  /** Read current feed state from the network. Throws FeedEmptyError on first run. */
  readState(): Promise<FeedState>;
  /** Write a reference to the feed at the network-resolved next index. */
  writeReference(reference: string, batchId: string, signer: object): Promise<void>;
}

/**
 * Resolve the index the next update should use, purely from network state.
 * An empty/never-written feed (no state) starts at index 0 (P1-7).
 * There is deliberately no local index persistence anywhere in this module.
 */
export function nextIndexFromNetwork(state: FeedState | null): string {
  if (state === null) {
    return EMPTY_FEED_INDEX_NEXT;
  }
  if (state.feedIndexNext !== null) {
    return state.feedIndexNext;
  }
  // Fall back to the last written index + 1 when the node reports only feedIndex.
  if (state.feedIndex !== null) {
    return String(BigInt(state.feedIndex) + 1n);
  }
  return EMPTY_FEED_INDEX_NEXT;
}

/**
 * Healthy publish flow: read current state from the network immediately before
 * writing, resolve the network-derived next index, then write. If the feed is
 * empty (FeedEmptyError), proceed from a first-run state as index 0.
 */
export async function healthyPublishFlow(
  access: FeedAccess,
  reference: string,
  batchId: string,
  signer: object,
): Promise<{ index: string; startedEmpty: boolean }> {
  let state: FeedState | null = null;
  let startedEmpty = false;
  try {
    state = await access.readState();
  } catch (err) {
    if (err instanceof Error && /never been updated/i.test(err.message)) {
      startedEmpty = true;
    } else {
      throw err;
    }
  }
  const index = nextIndexFromNetwork(state);
  await access.writeReference(reference, batchId, signer);
  return { index, startedEmpty };
}