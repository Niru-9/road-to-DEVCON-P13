// P1 LIVE acceptance — REAL Bee round trip (P1-01..P1-08).
// Runs ONLY via: npm run test:live  (vitest.live.config.ts -> tests/live/**)
// Deterministic floor is untouched: this file is excluded from `npx vitest run`
// by vitest.config.ts `exclude: ['tests/live/**', ...]` and stays out of the
// deterministic suite. Live evidence is network-derived ONLY; there is
// no Utils.*, no makeTopic, no makePrivateKeySigner, no Utils.makeTopic, no
// local feed counter, no fabricated reference/owner/topic/index. Never prints
// PRIVATE_KEY, PRIVATE_KEY values, .env contents, or batch secrets.
//
// Recovery identity is PUBLIC: reader = makeReader(topic, owner) where owner =
// writer.owner (EthAddress) is recovered from the signer's public identity, NOT
// from PRIVATE_KEY, NOT from a local counter, NOT from any writer state. The
// Feed index is network-derived by bee-js FeedWriter/FeedReader itself; there is
// no application-side `let index = 0` and no `previousIndex + 1`.
//
// P1-T2: after the successful round trip the REAL feed identity (owner + topic)
// is persisted into publication.json (status 'published') by THIS live flow —
// never fabricated. P1-T6: the batch remaining lifetime is read from the REAL
// node (bee.stamp.get) and surfaced through the application line.
import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { Bee, PrivateKey, Topic } from '@ethersphere/bee-js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBeeBatchReader, describeBatchLifetime, formatBatchLifetimeLine } from '../../src/swarm/batch.js';
import {
  buildPublicationDescriptor,
  loadPublicationDescriptor,
  persistPublicationDescriptor,
} from '../../src/archive/publication.js';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const descriptorPath = join(projectRoot, 'publication.json');

function loadEnv(): { beeUrl: string; batchId: string; privateKey: PrivateKey } {
  const beeUrl = (process.env.BEE_URL ?? '').trim();
  const batchId = (process.env.BATCH_ID ?? '').trim();
  const privateKeyHex = (process.env.PRIVATE_KEY ?? '').trim();
  const missing: string[] = [];
  if (!beeUrl) missing.push('BEE_URL');
  if (!batchId) missing.push('BATCH_ID');
  if (!privateKeyHex) missing.push('PRIVATE_KEY');
  if (missing.length > 0) {
    throw new Error(
      'LIVE BLOCKED: missing required env var(s): ' + missing.join(', ') +
      '. Set BEE_URL, BATCH_ID, PRIVATE_KEY (a real postage batch + key) in the local, git-ignored .env and run: npm run test:live',
    );
  }
  return { beeUrl, batchId, privateKey: new PrivateKey(privateKeyHex) };
}

const TOPIC_STRING = 'p1-live-round-trip-archive-reference';
const PAYLOAD_PREFIX = 'P1-LIVE-ARCHIVE-REFERENCE-PAYLOAD';
const DETERMINISTIC_PADDING = 'a'.repeat(52000);

describe('P1 live archive round trip against a real Bee', () => {
  let bee: Bee;
  let batchId: string;
  let privateKey: PrivateKey;

  beforeAll(() => {
    const env = loadEnv();
    bee = new Bee(env.beeUrl);
    batchId = env.batchId;
    privateKey = env.privateKey;
  });

  it('public archive bytes by REAL Feed reference, recover publicly, byte-identical (P1-01..P1-08)', async () => {
    // P1-06: the batch must be real and usable (never hardcode lifetime), and its
    // remaining lifetime is read from the REAL node and surfaced.
    const lifetime = await describeBatchLifetime(createBeeBatchReader(bee), batchId);
    expect(lifetime.usable).toBe(true);
    expect(lifetime.remainingMs).toBeGreaterThan(0);
    const lifetimeLine = formatBatchLifetimeLine(lifetime);
    expect(lifetimeLine).toContain(batchId);
    expect(lifetimeLine).toContain('lifetime-remaining');
    expect(lifetimeLine).toMatch(/status (PAID|EXPIRING|EXPIRED)/);
    expect(lifetimeLine).not.toMatch(/PRIVATE_KEY|private[ -]?key|mnemonic|seed phrase/i);

    // P1-03: deterministic payload larger than one Bee chunk (4096 bytes).
    const payload = PAYLOAD_PREFIX + ':' + DETERMINISTIC_PADDING ;
    const payloadBytes = new TextEncoder().encode(payload);
    expect(payloadBytes.length).toBeGreaterThan(4096);

    // Really upload the bytes; reference is the REAL content reference.
    const uploaded = await bee.data.upload(batchId, payloadBytes);
    const reference = uploaded.reference;
    expect(reference.toHex()).toMatch(/^[0-9a-f]{64}$/);

    // P1-04: REAL Topic + REAL signer from the core-sdk types.
    const topic = Topic.fromString(TOPIC_STRING);
    const writer = bee.feed.makeWriter(topic, privateKey);
    // Owner is the PUBLIC identity derived from the signer (never the key).
    const owner = '0x' + writer.owner.toHex();

    // P1-02: publish the CONTENT REFERENCE (not the bytes) through the Feed.
    await writer.uploadReference(batchId, reference);

    // P1-05/P1-08: recover using ONLY public owner + topic; no key, no signer,
    // no writer, no local counter. The Feed index is network-derived.
    const reader = bee.feed.makeReader(topic, owner);
    const recovered = await reader.downloadReference();
    expect(recovered.reference.toHex()).toBe(reference.toHex());

    // P1-T2: THIS real, successful publication persists the actual feed identity
    // into the tracked artifact. feedIndex is network-derived, never guessed.
    const descriptor = buildPublicationDescriptor({
      owner,
      topic: TOPIC_STRING,
      status: 'published',
      publishedAt: new Date().toISOString(),
      feedIndex: recovered.feedIndex.toBigInt().toString(),
      reference: reference.toHex(),
    });
    await persistPublicationDescriptor(descriptor, descriptorPath);
    const stored = await loadPublicationDescriptor(descriptorPath);
    expect(stored.identity.owner.toLowerCase()).toBe(owner.toLowerCase());
    expect(stored.identity.topic).toBe(TOPIC_STRING);
    expect(stored.status).toBe('published');
    expect(stored.feedIndex).toBe(recovered.feedIndex.toBigInt().toString());
    expect(stored.reference).toBe(reference.toHex());

    // P1-07: download the archive by the RECOVERED reference.
    const downloadedBytes = (await bee.data.download(reference)).toUint8Array();

    // Byte-for-byte comparison; fail if any byte differs.
    expect(downloadedBytes.length).toBe(payloadBytes.length);
    for (let i = 0; i < payloadBytes.length; i++) {
      if (downloadedBytes[i] !== payloadBytes[i]) {
        throw new Error('byte mismatch at offset ' + i + ' of ' + payloadBytes.length);
      }
    }
  });
});