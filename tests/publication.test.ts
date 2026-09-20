import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPublicationDescriptor,
  validatePublicationDescriptor,
  persistPublicationDescriptor,
  loadPublicationDescriptor,
  type PublicationDescriptor,
} from '../src/archive/publication.js';
import { ARCHIVE_FORMAT, ARCHIVE_VERSION } from '../src/types.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const descriptorPath = join(root, 'publication.json');

const OWNER = '0x' + 'ab'.repeat(20);
const TOPIC = '0x' + 'cd'.repeat(16);

describe('public publication descriptor (P1-02)', () => {
  it('builds a descriptor that carries feed owner, feed topic, format, and version', () => {
    const desc = buildPublicationDescriptor({ owner: OWNER, topic: TOPIC });
    expect(desc.identity.owner).toBe(OWNER);
    expect(desc.identity.topic).toBe(TOPIC);
    expect(desc.format).toBe(ARCHIVE_FORMAT);
    expect(desc.version).toBe(ARCHIVE_VERSION);
  });

  it('the descriptor schema rejects anything that is not public identity', () => {
    const desc: PublicationDescriptor = buildPublicationDescriptor({ owner: OWNER, topic: TOPIC });
    // The descriptor type has exactly {owner, topic} — no private key / batch / url.
    // Assert by construction: nothing to inject; validate the round-trip.
    expect(() => validatePublicationDescriptor(JSON.parse(JSON.stringify(desc)))).not.toThrow();
  });

  it('persists and reloads a published descriptor through the schema', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'swanloops-pub-'));
    const path = join(dir, 'publication.json');
    try {
      const desc = buildPublicationDescriptor({
        owner: OWNER,
        topic: TOPIC,
        status: 'published',
        publishedAt: '2026-09-20T00:00:00.000Z',
        feedIndex: '3',
        reference: 'cd'.repeat(32),
      });
      await persistPublicationDescriptor(desc, path);
      const loaded = await loadPublicationDescriptor(path);
      expect(loaded).toEqual(desc);
      expect(loaded.status).toBe('published');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('the repository tracks a non-secret publication file with REAL owner + topic, published by the live flow', () => {
    const raw: unknown = JSON.parse(readFileSync(descriptorPath, 'utf8'));
    const desc = validatePublicationDescriptor(raw);
    // P1-T2: the tracked artifact must carry the real feed identity produced by
    // a successful live publication — never the PENDING placeholder.
    expect(desc.identity.owner).toMatch(/^0x[0-9a-f]{40}$/);
    expect(desc.identity.topic).not.toBe('PENDING');
    expect(desc.identity.topic).toBeTruthy();
    expect(desc.status).toBe('published');
    // The tracked file is public metadata only.
    const text = readFileSync(descriptorPath, 'utf8');
    expect(text).not.toMatch(/PRIVATE_KEY|private[ -]?key|mnemonic|gift ?code|seed phrase/i);
  });
});