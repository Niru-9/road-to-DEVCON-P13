# Problem 1 — Archive That Outlives Its Host (plan)

## 1. Mission

Build an archival publishing tool for manuscript collections on Swarm such that a
person who receives **one published archive identifier** can recover the complete
collection even if the original application and its host disappear.

## 2. Goal & central property

```
content  →  content-addressed references  →  archive manifest  →  feed  →  stable identity
```

The **stable identity** (owner + topic, or feed manifest reference) is the only thing
a reader needs.

## 3. Why Swarm

- Content-addressed uploads give verifiable, referenceable data (`/bytes`, `/bzz`).
- Feeds provide stable mutable pointers driven by signed updates — the publish
  mechanism behind "one identifier that can track new archive versions".
- Postage-batch lifetime is honest storage rental: lifetime must be measured, not
  assumed permanent.

## 4. Repository structure

```text
problem-1-archive/
  .git/
  README.md  plan.md  research.md  action.md
  package.json  tsconfig.json  .env.example  .gitignore
  src/swarm/{bee,upload,feed,storage}.ts
  src/archive/{manifest,publisher,recovery}.ts
  src/cli/...   src/config.ts
  tests/{feed,recovery,storage,security}.test.ts
  archive-format/schema.json      # manifest schema (created Phase 0)
  docs/recovery.md                # recovery guide
  docs/evaluator-audit.md         # final PASS evidence (Phase 9)
```

## 5. Requirements → evaluator checks

| Req | Check | Pts | Planned implementation |
| --- | ----- | --: | ---------------------- |
| P1-1 | Feed publication | 8 | `bee.feed.makeWriter(topic, signer)`; upload manifest reference; record feed identity |
| P1-2 | Owner/topic tracked | 6 | tracked `archive-format/feed.json` with `{owner, topic}` — public identifiers only |
| P1-3 | Network feed index | 16 | read feed state immediately before every update; never a local counter |
| P1-4 | Large content by reference | 12 | `bee.data.upload(batchId, bytes)` → `{reference}` → `writer.uploadReference(batchId, reference)` |
| P1-5 | Independent recovery | 14 | separate `recover` entrypoint; needs only owner/topic + Bee endpoint |
| P1-6 | Batch lifetime | 8 | `bee.stamp.get(batchId)` → `PostageBatch.duration`; print `PAID/EXPIRING/EXPIRED` |
| P1-7 | Empty feed | 8 | first read: catch "empty feed" error → well-defined initial state, no crash |
| P1-8 | No credentials | 8 | keys only via `.env`; `git ls-files` audit; `.env.example` placeholders |

## 6. Architecture (decided)

- **Publisher**: CLI reads a folder of manuscript files → uploads each file
  (`bee.data.upload`/`bee.file.upload`) → builds manifest `{format, version, title,
  updatedAt, items[]}` → uploads manifest → writes manifest reference to feed.
- **Identity**: `owner` = signer public key; `topic` = derived/random 32-byte topic
  recorded in `feed.json`.
- **Recovery**: standalone reader resolves feed → manifest → each item reference →
  files to output dir. Zero dependency on publisher state.
- **Feed import design**: use a dedicated topic per archive; `owner` from the
  publishing key. Optionally publish `bee.feed.createManifest` for a human-friendly
  stable URL.

## 7. Data model

Manifest (`archive-format/schema.json`, section 7 of master plan):

```json
{
  "format": "swarm-preservation-archive",
  "version": 1,
  "title": "Himalayan Manuscript Archive",
  "updatedAt": "2026-09-19T00:00:00.000Z",
  "items": [{ "name": "folio-001.jpg", "reference": "c00f..." }]
}
```

Feed identity file (`archive-format/feed.json`):

```json
{ "owner": "0x...", "topic": "..." }
```

## 8. Feed & index strategy (P1-3)

Verified behavior (bee-js 13.x):

- `writer.uploadReference(batchId, reference)` — when `options.index` is omitted,
  bee-js resolves the **next index from the network** (recommended append-only flow).
- `reader.downloadReference()` → `{ reference, feedIndex, feedIndexNext }` — the
  current state; `feedIndexNext` is what the next write will use.
- Empty feed: `downloadReference()` **throws**; catch and start at
  `FeedIndex.fromBigInt(0n)`.

Decision: publisher uses the **default (network-resolved) index** path
(i.e. no local counter). Safety check before each write reads current feed state.

## 9. Recovery design (P1-5)

```bash
npm run recover -- --owner 0x... --topic ... --bee http://localhost:1633
```

1. read feed → current manifest reference
2. download manifest (`bee.data.download`)
3. validate against `schema.json`
4. enumerate items, download each referenced file
5. write to output dir with `name`
6. report per-item failures

## 10. Batch lifetime (P1-6)

`bee.stamp.get(batchId)` returns `PostageBatch` whose `duration` is the estimated
time until expiry (node-computed). Surface as:

```text
Batch: ...
Remaining lifetime: 6d 14h
Status: PAID / EXPIRING / EXPIRED
```

Thresholds are config constants; no hardcoded lifetime.

## 11. Security strategy

- Private key, batch id, and Bee URL live only in `.env` (git-ignored).
- `feed.json` holds public identifiers only — never the key.
- Publish key is a dedicated archival key (not a wallet used elsewhere).
- Final audit: `git status`, `git ls-files`, secret scan (master plan §34).

## 12. Configuration & environment

```env
BEE_URL=http://localhost:1633
PRIVATE_KEY=            # archive publishing key (hex) — placeholder
BATCH_ID=               # postage batch id — placeholder
OUTPUT_DIR=./recovered
```

## 13. Testing strategy

| Layer | Coverage |
| ----- | -------- |
| Unit | manifest build/validate; empty-feed guard; status thresholds |
| Integration (mock/real Bee) | upload → feed write → read-back index sequencing |
| Source/evaluator | feed.json present+public; no secrets; `uploadReference` used |
| Manual | real publish + recovery demo against a live Bee (Phase 7) |

## 14. TypeScript / build setup (planned Phase 2)

- `tsconfig.json` targeting Node 22 (ESM), strict.
- runner: Node 22 `--experimental-strip-types` or `tsx`; build with `tsc`.
- test runner: `node:test` (zero-dependency) or Vitest — decide after Bee availability.

## 15. 12-hour schedule

| Phase | Duration | Notes |
| ----- | -------: | ----- |
| P0 research | 60–90m | done (research.md) |
| P1 plan | 30m | done (this file) |
| P2 foundation | 45m | TS/Bee/config/tests |
| P3 core | 90m | upload, manifest, feed, recovery, lifetime, empty-feed |
| P6 testing | 60m | unit + integration + audit |
| P7 demo | 30–45m | real feed publish + recovery |
| P8/9 docs+audit | 60m | evaluator-audit.md |

## 16. Kill switches (master plan §38)

- UI >20 min with no scored benefit → stop.
- Sophisticated primitive unreliable >30 min → use simplest documented mechanism.
- Cannot demonstrate → document limitation; never fake.

## 17. Research plan & verified decisions (summary)

See `research.md`. All feed/data/stamp APIs verified from official bee-js docs
(URL + version recorded). Remaining re-verification: confirm exact named exports of
the **installed** 13.1.0 package before Phase 3.

## 18. Interoperability

- P1 defines the durable archive manifest (content-addressed, referenced by feed).
- P2 demonstrates that published data survives the original app (reads by reference).
- P3 demonstrates stewardship continuity using the same feed/signing primitives.
- Format is public and documented so any agent can read it without this codebase.

## 19. Traceability matrix

See workspace `docs/traceability-matrix.md` (rows P1-T1…P1-T8). Statuses are
RESEARCHED / PLANNED — nothing is implemented yet.

## 20. Risks & re-verification flags

| Risk | Mitigation |
| ---- | ---------- |
| Local Bee absent at implementation time | Documented fallback: install/start Bee (Swarm Desktop or Docker) before Phase 3; no fee spend in Phase 0 |
| bee-js re-export names drift in 13.1.x | Verify exact installed exports in Phase 2 foundation |
| Gateway rate limits on big blobs | Archive uses own Bee + own batch; gateway only relevant for P2 |
| `duration` semantics | Verified: node-reported estimate; surface raw value and threshold text |

## 21. Definition of done (planning)

- [x] Feed APIs verified (writer/reader/index/empty)
- [x] Upload/storage/stamp APIs verified
- [x] 8 P1 checks mapped
- [x] Recovery path designed
- [x] Security + git strategy written
- [x] No implementation claims made without evidence