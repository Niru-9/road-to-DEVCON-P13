import { describe, it, expect } from 'vitest';
import { loadArchiveConfig, loadRecoveryConfig } from '../src/config.js';
import { ConfigError } from '../src/errors.js';
import { recoverArchive } from '../src/archive/recovery.js';
import type { ArchiveManifest } from '../src/types.js';
import { FeedEmptyError, RecoveryItemError } from '../src/errors.js';

const REF = 'c'.repeat(64);
const MANIFEST: ArchiveManifest = {
  format: 'swarm-preservation-archive',
  version: 1,
  title: 'Recovery Test',
  updatedAt: '2026-09-19T00:00:00.000Z',
  items: [{ name: 'a.txt', reference: REF }],
};

describe('recoverArchive (P1-5)', () => {
  it('reconstructs every item from reference alone', async () => {
    const written: string[] = [];
    const result = await recoverArchive(
      { identity: { owner: '0xowner', topic: '0xtopic' }, beeUrl: 'http://x', outputDir: '/out' },
      { readLatestReference: async () => REF },
      { download: async () => MANIFEST },
      { write: async (name) => { written.push(name); } },
    );
    expect(result.recoveredItems).toBe(1);
    expect(written).toEqual(['a.txt']);
  });

  it('surfaces an empty feed clearly (no crash)', async () => {
    await expect(
      recoverArchive(
        { identity: { owner: '0xowner', topic: '0xtopic' }, beeUrl: 'http://x', outputDir: '/out' },
        { readLatestReference: async () => { throw new FeedEmptyError('Feed has never been updated.'); } },
        { download: async () => MANIFEST },
        { write: async () => {} },
      ),
    ).rejects.toBeInstanceOf(FeedEmptyError);
  });

  it('wraps per-item failures in a typed error', async () => {
    await expect(
      recoverArchive(
        { identity: { owner: '0xo', topic: '0xt' }, beeUrl: 'http://x', outputDir: '/out' },
        { readLatestReference: async () => REF },
        { download: async () => MANIFEST },
        { write: async () => { throw new Error('disk full'); } },
      ),
    ).rejects.toBeInstanceOf(RecoveryItemError);
  });
});

describe('recovery has no access to publishing credentials (P1-5, P1-8)', () => {
  it('loadRecoveryConfig never reads a private key', () => {
    const env = {
      BEE_URL: 'http://localhost:1633',
      RECOVERY_OWNER: '0xowner',
      RECOVERY_TOPIC: '0xtopic',
      PRIVATE_KEY: 'deadbeef',
      BATCH_ID: 'batch',
    };
    const cfg = loadRecoveryConfig(env);
    expect(cfg.owner).toBe('0xowner');
    expect(cfg.topic).toBe('0xtopic');
    expect('privateKey' in cfg).toBe(false);
    expect('batchId' in cfg).toBe(false);
  });
});

describe('loadArchiveConfig', () => {
  it('reads publishing config from env', () => {
    const cfg = loadArchiveConfig({ BEE_URL: 'http://localhost:1633', PRIVATE_KEY: '0xabc', BATCH_ID: 'b1' });
    expect(cfg.beeUrl).toBe('http://localhost:1633');
    expect(cfg.privateKey).toBe('0xabc');
    expect(cfg.batchId).toBe('b1');
  });

  it('throws ConfigError when BEE_URL missing', () => {
    expect(() => loadArchiveConfig({})).toThrow(ConfigError);
  });
});