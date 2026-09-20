// Typed error taxonomy for Problem 1. Every failure path maps to a distinct
// ArchiveError subclass so the CLI and recovery flow can react specifically.

export class ArchiveError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Configuration is missing or structurally invalid. */
export class ConfigError extends ArchiveError {}

/** The manifest bytes do not validate against the archive schema. */
export class InvalidManifestError extends ArchiveError {}

/** A feed has never been updated; reading it yields no state (P1-7). */
export class FeedEmptyError extends ArchiveError {}

/** A just-written feed update was not observed by the network within the bounded confirmation window. */
export class FeedWriteUnconfirmedError extends ArchiveError {}

/** A postage batch is not usable for new uploads (P1-6). */
export class BatchUnusableError extends ArchiveError {}

/** A referenced file/item could not be downloaded to the output directory (P1-5). */
export class RecoveryItemError extends ArchiveError {}

/** The Bee node could not be reached. */
export class SwarmUnreachableError extends ArchiveError {}