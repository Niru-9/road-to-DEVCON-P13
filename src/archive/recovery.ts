// Recovery (P1-5, P1-7): resolve the stable feed identity to the latest manifest
// reference, download the manifest, validate it, and materialize every item.
// Uses ONLY public identifiers — no private key is ever involved.

import type { ArchiveManifest, FeedIdentity } from '../types.js';
import { FeedEmptyError, RecoveryItemError } from '../errors.js';
import { validateManifest } from './manifest.js';

export interface FeedReaderPort {
  /** Resolve the feed to its current manifest reference. Throws FeedEmptyError on first run. */
  readLatestReference(): Promise<string>;
}

export interface ManifestResolver {
  download(reference: string): Promise<unknown>;
}

export interface ItemMaterializer {
  write(name: string, reference: string): Promise<void>;
}

export interface RecoveryInput {
  identity: FeedIdentity;
  beeUrl: string;
  outputDir: string;
}

export interface RecoveryResult {
  manifest: ArchiveManifest;
  recoveredItems: number;
}

/**
 * Full recovery flow: feed -> manifest reference -> manifest bytes -> items.
 * While the steps are delegated to injected ports (behind Bee adapters), the
 * orchestration and its empty-feed handling are core application logic that is
 * unit-tested here.
 */
export async function recoverArchive(
  input: RecoveryInput,
  feed: FeedReaderPort,
  resolver: ManifestResolver,
  items: ItemMaterializer,
): Promise<RecoveryResult> {
  let reference: string;
  try {
    reference = await feed.readLatestReference();
  } catch (err) {
    if (err instanceof FeedEmptyError) {
      throw new FeedEmptyError(`Feed (owner ${input.identity.owner}, topic ${input.identity.topic}) has no updates yet.`);
    }
    throw err;
  }

  const rawManifest = await resolver.download(reference);
  const manifest = validateManifest(rawManifest);

  for (const item of manifest.items) {
    try {
      await items.write(item.name, item.reference);
    } catch (err) {
      throw new RecoveryItemError(`Failed to recover item "${item.name}" (${item.reference}).`, { cause: err });
    }
  }

  return { manifest, recoveredItems: manifest.items.length };
}