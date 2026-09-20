// Swarm feed orchestration (P1-1, P1-3, P1-4, P1-5, P1-6, P1-7): index is
// derived ONLY from the feed the network reports immediately before the write
// (P1-4). Never a local counter (P1-1, P1-4). Recovery is public owner+topic —
// never a key (P1-5).

import type { FeedState } from '../types.js';
import { FeedEmptyError, FeedWriteUnconfirmedError } from '../errors.js';

export function nextIndexFromNetwork(state: FeedState | null): string {
  if (state === null) return '0';
  if (state.feedIndexNext && state.feedIndexNext !== '') return state.feedIndexNext;
  if (state.feedIndex && state.feedIndex !== '') {
    return String(BigInt(state.feedIndex) + 1n);
  }
  return '0';
}

function indexAsBigInt(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = BigInt(value);
  return parsed < 0n ? null : parsed;
}

export interface FeedAccessPort {
  readState(): Promise<FeedState | null>;
  writeReference(reference: string, batchId?: string): Promise<void>;
}

export interface PublishFlowResult {
  index: string;
  startedEmpty: boolean;
}

export interface PublishFlowOptions {
  /**
   * After writing, poll the network until the just-written index is visible
   * (the last published update must be observed by the feed lookup). Bounded
   * and honest: if the network never converges, a FeedWriteUnconfirmedError is
   * thrown. Set `confirmWrite: false` to skip the confirmation reads.
   */
  confirmWrite?: boolean;
  /** How many confirmation reads are attempted before giving up. */
  confirmAttempts?: number;
  /** Delay between confirmation reads (ms). */
  confirmDelayMs?: number;
}

export const DEFAULT_CONFIRM_ATTEMPTS = 12;
export const DEFAULT_CONFIRM_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll the network (via the same FeedAccessPort readState) until the latest
 * observed feed index is at least `atLeastIndex`. Throws FeedWriteUnconfirmedError
 * rather than reporting success on a write the network has not surfaced yet.
 */
export async function confirmFeedIndexAtLeast(
  access: FeedAccessPort,
  atLeastIndex: bigint,
  options: NonNullable<PublishFlowOptions>,
): Promise<void> {
  const attempts = options.confirmAttempts ?? DEFAULT_CONFIRM_ATTEMPTS;
  const delayMs = options.confirmDelayMs ?? DEFAULT_CONFIRM_DELAY_MS;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const state = await access.readState();
      const latest = indexAsBigInt(state?.feedIndex ?? null);
      if (latest !== null && latest >= atLeastIndex) return;
    } catch (err) {
      if (err instanceof FeedEmptyError) {
        // Feed still reads empty after our write; keep polling inside the window.
      } else {
        throw err;
      }
    }
    await sleep(delayMs);
  }
  throw new FeedWriteUnconfirmedError(
    `The feed update at index ${atLeastIndex} was not observed by the network within ${attempts} confirmation reads.`,
  );
}

export async function healthyPublishFlow(
  access: FeedAccessPort,
  reference: string,
  batchId: string,
  options: PublishFlowOptions = {},
): Promise<PublishFlowResult> {
  let state: FeedState | null;
  let startedEmpty = false;
  try {
    state = await access.readState();
  } catch (err) {
    if (err instanceof FeedEmptyError) {
      startedEmpty = true;
      state = null;
    } else {
      throw err;
    }
  }
  const index = nextIndexFromNetwork(state);
  await access.writeReference(reference, batchId);
  if (options.confirmWrite !== false) {
    await confirmFeedIndexAtLeast(access, BigInt(index), options);
  }
  return { index, startedEmpty };
}
