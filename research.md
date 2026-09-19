# Research — Problem 1 (Archive That Outlives Its Host)

Research standard: master plan §31 (Question / Source / Version / Verified API /
Observed Behavior / Decision / Implementation Consequence). Status legend:
`VERIFIED` = confirmed from authoritative source; `INFERENCE` = reasoned from verified
facts; `UNKNOWN` = not yet confirmable. Research date: 2026-09-19.

---

## R1. Current bee-js version

### Question
What is the current published version of `@ethersphere/bee-js`?

### Source
npm registry (`npm view @ethersphere/bee-js dist-tags`)

### Version
latest **13.1.0** (upcoming `13.1.1-upcoming.g80d8b1e`, next `6.4.1-pre.1`)

### Verified API
`npm view` dist-tags output

### Observed Behavior
v13 is the current major line; v12/v11 are legacy.

### Decision
Pin `@ethersphere/bee-js@^13.1.0` in `package.json`.

### Implementation Consequence
Namespaced API (`bee.data.*`, `bee.feed.*`, `bee.stamp.*`, `bee.storage.*`) is the
only supported surface. Verified in R2–R8.

---

## R2. v13 namespace reorganization

### Question
Which method names changed between v12 and v13?

### Source
Official bee-js docs — "Migrating from v12" (https://bee-js.ethswarm.org/docs/migrating-to-v13/)

### Version
13.x (documented migration)

### Verified API
- v12 `bee.uploadData()` → v13 `bee.data.upload()`
- v12 `bee.downloadData()` → v13 `bee.data.download()`
- v12 `bee.getAllPostageBatch()` → v13 `bee.stamp.getAll()`
- feeds: `bee.feed.createManifest()`, `bee.feed.fetchLatestUpdate()`,
  `bee.feed.makeReader()`, `bee.feed.makeWriter()`
- storage: `bee.storage.buy()`, `bee.storage.extend()`, `bee.storage.extendDuration()`,
  `bee.storage.extendSize()`

### Observed Behavior
API reorganized into method namespaces on the `Bee` instance.

### Decision
Use only the v13 namespaced surface; no v12 method calls.

### Implementation Consequence
Before Phase 3, assert imports resolve against the installed 13.1.0 package types
(named classes `Topic`, `PrivateKey`, `FeedIndex`, `Reference`).

---

## R3. Data upload returns a content reference (P1-4)

### Question
How does bee-js upload raw bytes and return a reference?

### Source
Official bee-js docs — Upload and Download (https://bee-js.ethswarm.org/docs/upload-download/)

### Version
13.x

### Verified API
`const upload = await bee.data.upload(batchId, data)` → upload object; reference via
`upload.reference` (typed `Reference`). Raw byte upload uses the `/bytes` endpoint.

### Observed Behavior
`bee.data.download(reference)` retrieves the same bytes. Result types are content-addressed.

### Decision
Archive publisher uploads manifest bytes with `bee.data.upload`, then writes
`reference` into the feed. Files larger than one chunk are naturally represented by
their `Reference` (content address), satisfying "large content by reference".

### Implementation Consequence
`writer.uploadReference(batchId, reference)` receives the `Reference` from a
`bee.data.upload` call — two separate on-chain operations, feed points to the reference.

---

## R4. Feed reader exposes current index (P1-3)

### Question
How does bee-js obtain the current feed state / next index from the network?

### Source
Official bee-js API — `FeedReader` interface & feed docs
(https://bee-js.ethswarm.org/docs/soc-and-feeds/)

### Version
13.x

### Verified API
- `bee.feed.makeReader(topic, owner)` → reader (extends FeedReader)
- `reader.downloadReference()` → `{ reference, feedIndex, feedIndexNext }`
- `reader.downloadPayload()` → returns payload + feed state
- `FeedIndex.fromBigInt(0n)` for an explicit first index

### Observed Behavior
The reader when it exists returns the current `reference` along with
`feedIndexNext`, i.e. the next index the network will accept. The **feed is the source
of truth** for index state.

### Decision
Publisher never keeps a local/JSON/db counter. Next index comes from the network
(download current state before writing, using `feedIndexNext`; or rely on the writer's
default next-index resolution).

### Implementation Consequence
`feed.ts` exposes `readFeedState()` (used before every update) and
`publishManifestReference()`; test asserts no local counter exists.

---

## R5. Empty feed behavior (P1-7)

### Question
What happens when a feed has never been updated, and how should the app handle it?

### Source
Official bee-js feed documentation/examples (https://bee-js.ethswarm.org/docs/soc-and-feeds/)

### Version
13.x

### Verified API
`reader.downloadReference()` on an empty feed **throws** (no update exists to return).

### Observed Behavior
Official examples catch the empty-feed error and treat it as "no update yet",
deriving the initial index as `FeedIndex.fromBigInt(0n)`.

### Decision
Recovery/publisher first-run path wraps the first read in try/catch; on the
empty-feed error it returns a defined first-run state and proceeds from index 0.

### Implementation Consequence
Empty feed → clean user-facing message, never an unhandled promise rejection.
Unit test covers the guard.

---

## R6. Feed writer publishes a reference (P1-1 / P1-4)

### Question
What is the exact signature to publish a reference to a feed?

### Source
Official bee-js API — `FeedWriter` interface (https://bee-js.ethswarm.org/docs/api/interfaces/FeedWriter/)

### Version
13.x

### Verified API
```
uploadReference(postageBatchId, reference, options?): Promise<void>
  options.index?: FeedIndex     // if omitted, next index resolved from the network
uploadPayload(postageBatchId, data, options?): Promise<void>
```

### Observed Behavior
`feedwriter.uploadReference(batch_, reference)` is the documented way to point a feed
at a reference. Omitting `index` uses the network-decided next index (recommended
default for append-only feeds).

### Decision
Use `writer.uploadReference(batchId, reference)` without an explicit index for the
normal publish path (network-resolved), after reading current state for safety
(R4). No hardcoded or persisted indices.

### Implementation Consequence
Satisfies P1-1 (feed writer + published feed identity) and P1-4 (reference in feed).

---

## R7. Feed manifest for a stable URL (P1-5 support)

### Question
Can a stable human-friendly address be published instead of raw owner/topic?

### Source
Official bee-js docs — `bee.feed.createManifest`
(https://bee-js.ethswarm.org/docs/soc-and-feeds/)

### Version
13.x

### Verified API
```
bee.feed.createManifest(postageBatchId, topic, owner): Promise<Reference>
```
returns a swarm manifest reference that always resolves to the latest feed update.

### Observed Behavior
The manifest is a stable reference that redirects to the feed's current content.

### Decision
Optional enhancement: publish a feed manifest so recovery can accept either
`owner+topic` or a single manifest reference. Recovery CLI accepts both forms
(recovery.md).

### Implementation Consequence
Recovery entry reads either (a) `--owner --topic`, or (b) a manifest reference that
`bee.data.download` resolves to the feed-manifest document which contains owner/topic.

---

## R8. Postage batch state — duration / TTL (P1-6)

### Question
How do we read a batch's remaining lifetime from the node?

### Source
Official bee-js API — `Stamp` class + `PostageBatch` interface
(https://bee-js.ethswarm.org/docs/api/classes/Stamp/,
https://bee-js.ethswarm.org/docs/api/interfaces/PostageBatch/)

### Version
13.x

### Verified API
```
bee.stamp.get(postageBatchId) → Promise<PostageBatch>
PostageBatch: { batchID, batchTTL, depth, amount, bucketDepth, immutable,
               label, usage, usageText, utilization, remainingSize?,
               duration?: Duration, usable: boolean, ... }
bee.stamp.getAll() → Promise<PostageBatch[]>
```

### Observed Behavior
`get` returns node-computed state; `duration` is the estimated time until the batch
expires (a `Duration`); `usable` indicates whether the batch is usable for new
upload; `usage` is current capacity utilization.

### Decision
Lifetime surfaced via `bee.stamp.get`. App computes status: `usable && duration OK` →
PAID; near expiry → EXPIRING (>threshold check using duration); else EXPIRED.

### Implementation Consequence
`storage.ts` → `getBatchStatus(batchId)` returns `{ duration, usable, status }`.
Printed in CLI output adjacent to feed/manifest (master plan §9 format).

---

## R9. Local Bee availability (Phase 3 prerequisite)

### Question
Is a Bee node reachable locally for feed/stamp operations?

### Source
Probe: `curl http://localhost:1633/health`

### Version
n/a

### Verified API
HTTP `/health`

### Observed Behavior
No response on 2026-09-19 (no local Bee running).

### Decision
Phase 3 requires a real local Bee (own batch). Install/start Bee before Phase 3:
Swarm Desktop (recommended for light node) or Dockerised Bee + API on 1633.
No uploads or fee spending during Phase 0.

### Implementation Consequence
Test strategy includes a "skip when no Bee" guard so unit tests run without a node,
while integration tests are marked and run when `BEE_URL` responds.

---

## Consolidated API decision list (P1)

| Item | Method / symbol | Verified? | Source |
| ---- | --------------- | --------- | ------ |
| Data upload ref | `bee.data.upload(batch, data)` → `{reference}` | VERIFIED | bee-js upload-download |
| Feed writer | `bee.feed.makeWriter(topic, signer)`; `writer.uploadReference(batch, ref)` | VERIFIED | FeedWriter interface |
| Feed reader | `bee.feed.makeReader(topic, owner)`; `downloadReference()` | VERIFIED | FeedReader |
| Current index | `feedIndex` / `feedIndexNext` from `downloadReference()` | VERIFIED | soc-and-feeds |
| Empty feed | throws; catch → start `FeedIndex.fromBigInt(0n)` | VERIFIED | soc-and-feeds examples |
| Stable manifest | `bee.feed.createManifest(batch, topic, owner)` | VERIFIED | soc-and-feeds |
| Batch lifetime | `bee.stamp.get(batchID)` → `PostageBatch.duration` | VERIFIED | Stamp/PostageBatch |
| Version | @ethersphere/bee-js 13.1.0 | VERIFIED | npm dist-tags |

Remaining `UNKNOWN`: none for P1 core; exact named re-exports confirmed against the
installed package in Phase 2 foundation.