// Domain types for the archival tool. Reference types mirror bee-js v13 shapes
// (FeedIndex is a bigint-based index class; Reference is a 32-byte hex string).

export const ARCHIVE_FORMAT = 'swarm-preservation-archive';
export const ARCHIVE_VERSION = 1;

/** One file inside an archive. `reference` is the content address of the file bytes. */
export interface ArchiveItem {
  name: string;
  reference: string;
  size?: number;
}

/** On-chain archive manifest: content-addressed references + metadata. */
export interface ArchiveManifest {
  format: 'swarm-preservation-archive';
  version: 1;
  title: string;
  updatedAt: string;
  items: ArchiveItem[];
}

/**
 * Public feed identity. Only public identifiers — never a private key.
 * This is the single value a reader needs to recover the archive (P1-T5).
 */
export interface FeedIdentity {
  owner: string;
  topic: string;
}

/** Network-reported feed state (from FeedReader.downloadReference). */
export interface FeedState {
  reference: string;
  /** Feed index of the last update (null on a never-written feed). */
  feedIndex: string | null;
  /** The index the next write will use; derived from the network, tokenized as decimal string. */
  feedIndexNext: string | null;
}

/** Batch lifetime status derived from node-reported PostageBatch fields (P1-T6). */
export type BatchStatus =
  | { status: 'PAID'; durationMs: number | null }
  | { status: 'EXPIRING'; durationMs: number | null }
  | { status: 'EXPIRED'; durationMs: number | null };

export const EMPTY_FEED_INDEX_NEXT = '0';