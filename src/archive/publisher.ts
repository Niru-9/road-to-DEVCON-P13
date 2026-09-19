// Publisher orchestration (P1-1, P1-3, P1-4).
// Depends on small injected interfaces; the network-facing adapters live in
// src/swarm/*. The publisher thread performs a network read immediately before
// each feed update and never keeps a local index counter.

import type { ArchiveManifest, FeedIdentity } from '../types.js';

export interface ManifestStore {
  /** Address the manifest bytes by content (upload). Must return the 64-hex reference. */
  upload(manifest: ArchiveManifest, batchId: string): Promise<string>;
}

export interface FeedPublisher {
  /** Read current network feed state, then write the reference at the resolved next index. */
  publishReference(reference: string, batchId: string): Promise<{ index: string; startedEmpty: boolean }>;
  /** Public identity of the feed (owner public key + topic). */
  identity(): FeedIdentity;
}

export interface PublishResult {
  identity: FeedIdentity;
  manifestReference: string;
  feed: { index: string; startedEmpty: boolean };
}

/** Orchestrate: upload manifest bytes, then publish the reference to the feed. */
export async function publishArchive(
  manifest: ArchiveManifest,
  batchId: string,
  store: ManifestStore,
  feed: FeedPublisher,
): Promise<PublishResult> {
  const manifestReference = await store.upload(manifest, batchId);
  const feedState = await feed.publishReference(manifestReference, batchId);
  return {
    identity: feed.identity(),
    manifestReference,
    feed: feedState,
  };
}