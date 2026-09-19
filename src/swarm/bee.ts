// Bee client construction and shared adapters. Kept as a thin boundary so the
// rest of the code depends on small interfaces, not on bee-js directly.

import { Bee, PrivateKey, Topic } from '@ethersphere/bee-js';
import type { FeedState } from '../types.js';
import { FeedEmptyError, SwarmUnreachableError } from '../errors.js';

/** Build a Bee client. Construction is offline; errors surface on first call. */
export function createBee(apiUrl: string): Bee {
  return new Bee(apiUrl);
}

/** Resolve a hex private key into a signing key object. */
export function signerFromPrivateKey(privateKeyHex: string): PrivateKey {
  const normalized = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  return new PrivateKey(normalized);
}

/** Resolve a hex topic string into a Topic (32 bytes). */
export function topicFromHex(topicHex: string): Topic {
  const normalized = topicHex.startsWith('0x') ? topicHex.slice(2) : topicHex;
  return new Topic(normalized);
}

/** Owner public key (0x hex) for a signer. */
export function ownerOf(signer: PrivateKey): string {
  return signer.publicKey().toHex();
}

/**
 * Map the bee-js downloadReference() result onto our FeedState, translating the
 * empty-feed throw into a well-defined first-run state (P1-7).
 */
export async function readFeedState(read: () => Promise<unknown>): Promise<FeedState> {
  try {
    const raw = (await read()) as {
      reference?: unknown;
      referenceString?: string;
      feedIndex?: { toString(): string } | null;
      feedIndexNext?: { toString(): string } | null;
    };
    const toIndexString = (v: unknown): string | null =>
      v == null ? null : typeof v === 'string' ? v : (v as { toString(): string }).toString();
    return {
      reference: raw.referenceString ?? (raw.reference as string) ?? '',
      feedIndex: toIndexString(raw.feedIndex),
      feedIndexNext: toIndexString(raw.feedIndexNext),
    };
  } catch (err) {
    if (err instanceof Error && /empty|not found|404|no update/i.test(err.message)) {
      throw new FeedEmptyError('Feed has never been updated.', { cause: err });
    }
    throw new SwarmUnreachableError('Failed to read feed state from the node.', { cause: err });
  }
}