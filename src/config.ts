// Environment configuration. Private values only ever come from the environment
// (e.g. a .env file that is git-ignored). Nothing here is committed to source.

import { ConfigError } from './errors.js';

export interface ArchiveConfig {
  /** Bee node HTTP API base URL, e.g. http://localhost:1633 */
  beeUrl: string;
  /** Archive publishing private key (hex). May be empty -> derived anonymous owner. */
  privateKey?: string;
  /** Postage batch id used for uploads + feed writes. */
  batchId?: string;
}

export interface RecoveryConfig {
  beeUrl: string;
  /** Public feed owner address (0x-prefixed hex). */
  owner: string;
  /** Feed topic (hex or hex string). */
  topic: string;
  /** Directory to write recovered files into. */
  outputDir: string;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function loadArchiveConfig(env: Record<string, string | undefined> = process.env): ArchiveConfig {
  const beeUrl = required('BEE_URL', env['BEE_URL']);
  return {
    beeUrl,
    privateKey: env['PRIVATE_KEY']?.trim() || undefined,
    batchId: env['BATCH_ID']?.trim() || undefined,
  };
}

/**
 * Recovery needs only PUBLIC identifiers plus the Bee endpoint (P1-5).
 * Note: it deliberately reads NONE of the private publishing keys.
 */
export function loadRecoveryConfig(env: Record<string, string | undefined> = process.env): RecoveryConfig {
  return {
    beeUrl: required('BEE_URL', env['BEE_URL']),
    owner: required('RECOVERY_OWNER', env['RECOVERY_OWNER']),
    topic: required('RECOVERY_TOPIC', env['RECOVERY_TOPIC']),
    outputDir: env['OUTPUT_DIR']?.trim() || './recovered',
  };
}