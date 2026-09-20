import { Bee, Topic } from '@ethersphere/bee-js';
import { loadArchiveConfig } from './dist/config.js';
import { signerFromPrivateKey } from './dist/swarm/bee.js';

process.loadEnvFile('.env');
const cfg = loadArchiveConfig(process.env);
const bee = new Bee(cfg.beeUrl);
const signer = signerFromPrivateKey(cfg.privateKey);
const owner = signer.publicKey().address().toHex().replace(/^0x/i, '');
console.log('owner', '0x' + owner);
console.log('batch usable', (await bee.stamp.get(cfg.batchId)).usable);

const topic = `p1-stress-probe-${Date.now().toString(36)}`;
const reader = bee.feed.makeReader(Topic.fromString(topic), '0x' + owner);
const writer = bee.feed.makeWriter(Topic.fromString(topic), signer);

let empty = false;
try {
  await reader.downloadReference();
} catch {
  empty = true;
}
console.log('probe-empty', empty, 'T+0');

const t0 = Date.now();
const ref = await bee.data.upload(cfg.batchId, new TextEncoder().encode(JSON.stringify({ probe: topic })));
console.log('upload ok', ref.reference.toHex(), 'T+' + (Date.now() - t0));

const wt0 = Date.now();
await writer.uploadReference(cfg.batchId, ref.reference.toHex());
console.log('feed write ok T+' + (Date.now() - wt0));

for (let i = 1; i <= 10; i += 1) {
  const at = Date.now() - t0;
  try {
    const r = await reader.downloadReference();
    console.log(`[T+${String(at).padStart(5)}ms] read OK idx=${r.feedIndex.toBigInt()} ref=${r.reference.toHex() === ref.reference.toHex() ? 'MATCH' : 'MISMATCH'}`);
    break;
  } catch (e) {
    console.log(`[T+${String(at).padStart(5)}ms] read ERR http=${e?.response?.status ?? '-'} ${String(e?.message).slice(0, 24)}`);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.log('DONE');