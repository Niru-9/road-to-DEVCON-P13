// Batch lifetime surfacing (P1-6). A thin port over bee-js stamp.get() so the
// CLI/application can read the REAL postage batch state from the node and
// surface the remaining lifetime through the public output. No hardcoded
// lifetime, no fabricated TTL — everything here derives from what the node
// reports (duration has toSeconds()) and what the deterministic storage
// helpers (batchStatus / formatRemainingLifetime) compute.

import { batchStatus, formatRemainingLifetime } from './storage.js';
import type { BatchStatusKind } from './storage.js';

export interface BatchSnapshot {
  /** Remaining lifetime in ms as reported by Bee. `null` when the node did not report a duration. */
  remainingMs: number | null;
  /** Whether the batch is usable for uploads right now. */
  usable: boolean;
}

/** Port the CLI/application uses to read batch lifetime from a real Bee node. */
export interface BatchLifetimeReader {
  read(batchId: string): Promise<BatchSnapshot>;
}

export interface DurationLike {
  toSeconds(): number;
}

export interface PostageBatchLike {
  usable?: boolean | null;
  duration?: DurationLike | null;
}

/** Adapter over bee.stamp.get(batchId): maps the node shape onto BatchSnapshot. */
export function createBeeBatchReader(bee: {
  stamp: { get(batchId: string): Promise<PostageBatchLike> };
}): BatchLifetimeReader {
  return {
    async read(batchId: string): Promise<BatchSnapshot> {
      const batch = await bee.stamp.get(batchId);
      const durationSeconds = batch.duration?.toSeconds();
      const remainingMs =
        typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) ? durationSeconds * 1000 : null;
      return { remainingMs, usable: batch.usable ?? false };
    },
  };
}

export interface BatchLifetimeLine {
  batchId: string;
  remainingMs: number | null;
  usable: boolean;
  status: BatchStatusKind;
  remainingHuman: string;
}

/** Classify + format a live batch snapshot into the line the CLI/application surfaces. */
export async function describeBatchLifetime(
  reader: BatchLifetimeReader,
  batchId: string,
): Promise<BatchLifetimeLine> {
  const { remainingMs, usable } = await reader.read(batchId);
  const evaluated = batchStatus({ durationMs: remainingMs ?? 0, usable });
  return {
    batchId,
    remainingMs,
    usable,
    status: evaluated.status,
    remainingHuman: formatRemainingLifetime(remainingMs),
  };
}

/** Machine/prose line exposed in CLI/application output (never prints secrets). */
export function formatBatchLifetimeLine(line: BatchLifetimeLine): string {
  return [
    `batch ${line.batchId}`,
    `lifetime-remaining ${line.remainingHuman}`,
    `status ${line.status}`,
    `usable ${String(line.usable)}`,
  ].join(' | ');
}