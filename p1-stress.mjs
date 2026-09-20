import { Bee, Topic } from '@ethersphere/bee-js';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadArchiveConfig, loadRecoveryConfig } from './dist/config.js';
import {
  buildPublicationDescriptor,
  validatePublicationDescriptor,
  persistPublicationDescriptor,
  loadPublicationDescriptor,
} from './dist/archive/publication.js';
import { signerFromPrivateKey } from './dist/swarm/bee.js';
import { readFeedState } from './dist/swarm/bee.js';
import { healthyPublishFlow } from './dist/swarm/feed.js';
import { buildManifest, validateManifest } from './dist/archive/manifest.js';
import { publishArchive } from './dist/archive/publisher.js';
import { recoverArchive } from './dist/archive/recovery.js';
import { describeBatchLifetime, formatBatchLifetimeLine, createBeeBatchReader } from './dist/swarm/batch.js';
import { FeedEmptyError, ConfigError } from './dist/errors.js';
import { dispatch } from './dist/cli/main.js';

process.loadEnvFile('.env');
const cfg = loadArchiveConfig(process.env);
const bee = new Bee(cfg.beeUrl);
const signer = signerFromPrivateKey(cfg.privateKey);
const feedOwner = signer.publicKey().address().toHex().replace(/^0x/i, '');

const results = { iterations: 0, failures: [], appBugCandidates: [] };
let failed = 0;
function note(ok, label, extra = '') {
  const status = ok ? 'PASS' : 'FAIL';
  if (!ok) {
    failed += 1;
    results.failures.push({ label, extra: String(extra).slice(0, 200) });
  }
  console.log(`[${status}] ${label}${extra ? ' :: ' + String(extra).slice(0, 120) : ''}`);
}

function contentBytes(id, size) {
  const head = `p1-stress:${id}:`;
  const filler = new TextEncoder().encode(id.repeat(Math.ceil((size - head.length) / id.length)).slice(0, size - head.length));
  return new TextEncoder().encode(head).length + filler.length === size
    ? new Uint8Array([...new TextEncoder().encode(head), ...filler])
    : (() => { throw new Error('size bookkeeping'); })();
}
function bytesToUtf8(b) {
  return new TextDecoder().decode(b);
}

const sizes = { SMALL: 900, KB4: 4096, KB8: 8192, KB32: 33152 };
const topicIds = ['sa', 'sb', 'sc', 'sd', 'se', 'sf'];
const plan = [
  { topic: 'sa', sizes: ['SMALL', 'KB4', 'KB8'] },
  { topic: 'sb', sizes: ['KB32', 'SMALL'] },
  { topic: 'sc', sizes: ['KB4'] },
  { topic: 'sd', sizes: ['KB8'] },
  { topic: 'se', sizes: ['KB32'] },
  { topic: 'sf', sizes: ['SMALL'] },
  { topic: 'sg', sizes: ['KB4'] },
];

// Batch lifetime surfacing (real node).
const lifetime = await describeBatchLifetime(createBeeBatchReader(bee), cfg.batchId);
note(lifetime.usable, 'P1 batch usable', `batch=${cfg.batchId}`);
note(lifetime.remainingMs !== null && lifetime.remainingMs > 0, 'P1 batch lifetime > 0', formatBatchLifetimeLine(lifetime));
note(formatBatchLifetimeLine(lifetime).includes(cfg.batchId), 'P1 lifetime line has batch id');

// Empty-feed handling on a REAL fresh topic (recovery before any write).
const emptyTopic = `p1-stress-empty-${Date.now().toString(36)}`;
const emptyReader = bee.feed.makeReader(Topic.fromString(emptyTopic), feedOwner);
const emptyFeedPort = {
  async readLatestReference() {
    try {
      const st = await readFeedState(() => emptyReader.downloadReference());
      return st.reference;
    } catch (e) {
      throw e;
    }
  },
};
let emptyHandled = false;
try {
  await recoverArchive(
    { identity: { owner: feedOwner, topic: emptyTopic }, beeUrl: cfg.beeUrl, outputDir: '.' },
    emptyFeedPort,
    { download: async () => ({}) },
    { write: async () => {} },
  );
} catch (e) {
  emptyHandled = e instanceof FeedEmptyError;
}
note(emptyHandled, 'P1 empty-feed recovery throws FeedEmptyError');

// Malformed / missing identifiers.
let descriptorRejected = false;
try {
  buildPublicationDescriptor({ owner: '  ', topic: 'x' });
} catch {
  descriptorRejected = true;
}
note(descriptorRejected, 'P1 descriptor empty owner rejected');

let formatRejected = false;
try {
  validatePublicationDescriptor({ format: 'junk', version: 1, identity: { owner: 'a', topic: 'b' }, status: 'created' });
} catch {
  formatRejected = true;
}
note(formatRejected, 'P1 descriptor bad format rejected');

let recoveryMissingOwner = false;
try {
  loadRecoveryConfig({ BEE_URL: 'http://x', RECOVERY_OWNER: '', RECOVERY_TOPIC: 't' });
} catch (e) {
  recoveryMissingOwner = e instanceof ConfigError;
}
note(recoveryMissingOwner, 'P1 recovery missing owner -> ConfigError');

// CLI real paths (status/recover) against the live node.
const statusCode = await dispatch(['status']);
note(statusCode === 0, 'P1 CLI status real-Bee path', `exit=${statusCode}`);
const recCode = await dispatch(['recover', '--owner', feedOwner, '--topic', emptyTopic]);
note(recCode === 0, 'P1 CLI recover ready-throw path OK', `exit=${recCode}`);

const manifestRefs = {};
const recoveredLast = {};
for (const { topic, sizes: sizeKeys } of plan) {
  const topicName = `${topic}-${Date.now().toString(36)}`;
  const reader = bee.feed.makeReader(Topic.fromString(topicName), feedOwner);
  const writer = bee.feed.makeWriter(Topic.fromString(topicName), signer);

  const feedPublisher = {
    async publishReference(reference, batchId) {
      const res = await healthyPublishFlow(
        {
          async readState() {
            try {
              return await readFeedState(() => reader.downloadReference());
            } catch (e) {
              throw e;
            }
          },
          async writeReference(ref, batch) {
            await writer.uploadReference(batch, ref);
          },
        },
        reference,
        batchId,
      );
      return { index: res.index, startedEmpty: res.startedEmpty };
    },
    identity() {
      return { owner: '0x' + feedOwner, topic: topicName };
    },
  };
  const store = {
    async upload(manifest, batchId) {
      const ref = await bee.data.upload(batchId, new TextEncoder().encode(JSON.stringify(manifest)));
      return ref.reference.toHex();
    },
  };

  let prevIndex = -1n;
  for (const sizeKey of sizeKeys) {
    const size = sizes[sizeKey];
    const id = `${topic}-${sizeKey}`;
    const content = contentBytes(id, size);
    const contentRef = await bee.data.upload(cfg.batchId, content);
    const manifest = buildManifest({
      title: `p1-stress ${id}`,
      updatedAt: new Date().toISOString(),
      items: [{ name: id, reference: contentRef.reference.toHex(), size }],
    });
    results.iterations += 1;

    try {
      const pub = await publishArchive(manifest, cfg.batchId, store, feedPublisher);
      const isFirst = prevIndex === -1n;
      const expectedStartEmpty = isFirst ? true : false;
      note(pub.feed.startedEmpty === expectedStartEmpty, `P1 pub#${results.iterations} startedEmpty`, `topic=${topicName} size=${sizeKey}`);
      note(typeof pub.feed.index === 'string' && pub.feed.index !== '', `P1 pub#${results.iterations} index present`, `index=${pub.feed.index}`);

      const readback = await reader.downloadReference();
      const rbIdx = readback.feedIndex.toBigInt();
      const expectedIdx = prevIndex + 1n;
      note(rbIdx === expectedIdx, `P1 pub#${results.iterations} monotonic index`, `expected=${expectedIdx} got=${rbIdx}`);
      note(readback.reference.toHex() === pub.manifestReference, `P1 pub#${results.iterations} feed->manifest ref match`);

        // Persist publication evidence (public descriptor) and verify it loads
        // back and contains NO secret material (private key, batch id, Bee URL).
        const evidenceDir = await mkdtemp(join(tmpdir(), 'p1-evidence-'));
        const evidencePath = join(evidenceDir, 'publication.json');
        const descriptor = buildPublicationDescriptor({
          owner: '0x' + feedOwner,
          topic: topicName,
          status: 'published',
          publishedAt: new Date().toISOString(),
          feedIndex: pub.feed.index,
          reference: pub.manifestReference,
        });
        await persistPublicationDescriptor(descriptor, evidencePath);
        const loaded = await loadPublicationDescriptor(evidencePath);
        note(
          loaded.identity.owner === '0x' + feedOwner && loaded.identity.topic === topicName,
          `P1 pub#${results.iterations} evidence reloads`,
        );
        const evidenceText = JSON.stringify(loaded);
        note(!Object.values(cfg).some((v) => typeof v === 'string' && v.length > 32 && evidenceText.includes(v)), `P1 pub#${results.iterations} evidence has no secret`);
        note(
          !evidenceText.toLowerCase().includes('privatekey'.toLowerCase()) &&
            !evidenceText.toLowerCase().includes(cfg.batchId.toLowerCase()),
          `P1 pub#${results.iterations} evidence clean of key material`,
          `keys='privateKey','BATCH_ID'`,
        );

      // Recover via the independent entrypoint and compare bytes.
      const outDir = await mkdtemp(join(tmpdir(), 'p1-stress-'));
      const feedPortRec = {
        async readLatestReference() {
          return (await readFeedState(() => reader.downloadReference())).reference;
        },
      };
      const resolver = {
        async download(reference) {
          const raw = bytesToUtf8((await bee.data.download(reference)).toUint8Array());
          return validateManifest(JSON.parse(raw));
        },
      };
      const materializer = {
        async write(name, reference) {
          const bytes = (await bee.data.download(reference)).toUint8Array();
          await mkdir(outDir, { recursive: true });
          await writeFile(join(outDir, name), bytes, 'binary');
          const evens = await readFile(join(outDir, name), 'binary');
          const ev = new Uint8Array(evens.length);
          for (let i = 0; i < evens.length; i++) ev[i] = evens.charCodeAt(i);
          const lenMatch = ev.length === content.length;
          let byteOk = lenMatch;
          if (lenMatch) {
            for (let i = 0; i < content.length; i++) {
              if (ev[i] !== content[i]) {
                byteOk = false;
                break;
              }
            }
          }
          note(byteOk, `P1 pub#${results.iterations} recovered bytes identical`, `${name} len=${ev.length}/${content.length}`);
          if (!byteOk) results.appBugCandidates.push(`P1 byte mismatch ${name}`);
        },
      };
      const rec = await recoverArchive(
        { identity: { owner: '0x' + feedOwner, topic: topicName }, beeUrl: cfg.beeUrl, outputDir: outDir },
        feedPortRec,
        resolver,
        materializer,
      );
      note(rec.recoveredItems === 1, `P1 pub#${results.iterations} recovered item count`, String(rec.recoveredItems));

      manifestRefs[topicName] = pub.manifestReference;
      recoveredLast[topicName] = contentRef.reference.toHex();
      prevIndex = rbIdx;
    } catch (e) {
      failed += 1;
      results.failures.push({ label: `P1 pub#${results.iterations} ${topicName} ${sizeKey}`, extra: String(e?.stack ?? e).slice(0, 400) });
      console.log(`[FAIL] P1 pub#${results.iterations} ${topicName} :: ${String(e?.stack ?? e).slice(0, 300)}`);
    }
  }
}

console.log('\n=== P1 STRESS SUMMARY ===');
console.log(JSON.stringify({ iterations: results.iterations, failed, failures: results.failures, appBugCandidates: results.appBugCandidates }, null, 2));
console.log(`batch ${cfg.batchId} remainingMs=${lifetime.remainingMs} usable=${lifetime.usable}`);