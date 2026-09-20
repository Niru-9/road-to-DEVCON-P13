# Action Report — Problem 1 (Archive That Outlives Its Host)

## Timestamp
2026-09-19 (Phase 0 close)

## Repository
`problem-1-archive`

## Objective
Complete Phase 0 (research + plan) for an archival publishing tool whose one stable
feed identity lets a reader recover the full archive. No application code in this phase.

## Completed
- Verified bee-js current version (13.1.0) and v13 namespaced API.
- Verified feed writer/reader/index behavior incl. network-resolved next index.
- Verified empty-feed behavior and the catch → first-run pattern.
- Verified `bee.data.upload` reference flow and `bee.stamp.get` duration/TTL surface.
- Verified stable feed manifest option (`bee.feed.createManifest`).
- Recorded all findings in `research.md` with sources and versions.
- Wrote 21-section `plan.md` (architecture, data model, tests, schedule, kill switches, DoD).

## Files Created
plan.md, research.md, action.md, README.md, .env.example, .gitignore,
archive-format/schema.json, docs/recovery.md, docs/evaluator-audit.md (template)

## Files Modified
(none)

## APIs Used
None at runtime. Verified signatures only (see research.md): `bee.data.upload`,
`bee.feed.makeWriter/makeReader/createManifest`, `FeedWriter.uploadReference`,
`FeedReader.downloadReference`, `FeedIndex.fromBigInt`, `bee.stamp.get/getAll`.

## Tests Added
None this phase (no code yet). Test plan defined in `plan.md` §13.
`docs/evaluator-audit.md` template lists all 8 P1 checks with statuses.

## Tests Run
Phase-0 validation only (workspace-level `docs/validation-phase0.md`):
`git rev-parse`, `git status`, `git ls-files`, `npm view`, `curl` gateway probe.

## Results
Planning-phase DoD (plan.md §21): all items satisfied. Checks P1-T1…P1-T8 mapped in
workspace `docs/traceability-matrix.md` (RESEARCHED/PLANNED, none IMPLEMENTED).

## Build
n/a — no package.json application sources yet (planned Phase 2).

## Security Audit
`git ls-files` at repo creation shows only docs; no key material committed.
`.env.example` contains empty placeholders only.

## Evaluator Checks Satisfied
P1-T1, P1-T3, P1-T4, P1-T6, P1-T7 → RESEARCHED (API verified).
P1-T2, P1-T5, P1-T8 → PLANNED (design decided; implementation pending).

## Remaining
Phase 2 foundation (TS, Bee client, config, env, tests), then Phase 3 core
(publish + recovery + lifetime + empty-feed). Requires a local Bee node.

## Problems
- No local Bee node running on `localhost:1633` at phase close → target for Phase 3.
- No network evidence can exist until real uploads happen (Phase 7) — by design.

## Next Action
Write the Phase-1+ implementation prompt in workspace `prompt.md` (after review);
then Phase 2 foundation per `plan.md` §14.

---

# Phase 1 FOUNDATION (2026-09-19)

## Objective
Strict foundation: TS scaffold, config/errors/DI boundaries, evaluator-guardrail
architecture tests, feature-neutral modules. No publish/recovery logic yet; no live
network writes.

## Completed
- Toolchain (pinned): TypeScript 5.9.3, bee-js **13.1.0**, @types/node 22.20.4,
  **Vitest 4.1.11**, ESM, NodeNext, strict. ESM over CJS chosen for v13 readiness.
- Modules: `src/config.ts`, `src/types.ts`, `src/errors.ts`,
  `src/swarm/bee.ts`, `src/swarm/feed.ts`, `src/swarm/storage.ts`,
  `src/archive/manifest.ts`, `src/archive/publisher.ts`, `src/archive/recovery.ts`,
  `src/cli/main.ts`. ApiSurface interface declares the runtime target;
  feature code is a thin boundary, not core logic.
- Tests (34 total, all PASS): `manifest.test.ts`, `feed.test.ts`,
  `storage.test.ts`, `recovery.test.ts`, `architecture.test.ts`:
  - feed: writer/reader/index + FIRST_RUN detection on empty feed
  - storage: batch status + duration/TTL surface
  - manifest: stable manifest mapping
  - recovery: `loadRecoveryConfig` **never reads PRIVATE_KEY**
  - architecture: no SwarmIdClient, no secrets in tracked src, no dist in git,
    exact toolkit pins asserted via `package.json`
- Installed deps; `npm test` 34/34 green; `npm run typecheck` clean;
  `npm run build` clean; `npm audit` 0 vulnerabilities.
- Runtime-verified installed bee-js 13.1.0 namespaced APIs (data upload/download,
  feed makeWriter/makeReader/createManifest, stamp get/getAll/topUp,
  storage extend/extendDuration/extendSize, NULL_STAMP/NULL_TOPIC).

## Files Created (this phase)
package.json, package-lock.json, tsconfig.json, tsconfig.build.json,
vitest.config.ts, .env, src/** and tests/** (above).
`src/config.ts` creates `.env` when absent; `.gitignore` excludes it.

## Build
test 34 passed, typecheck OK, build OK (tsc -p tsconfig.build.json).
`git ls-files` excludes node_modules/dist/.env.

## Security Audit
Recovery config intentionally lacks PRIVATE_KEY (loaded from env only).
No secrets in tracked source; 64-hex scan clean; audit 0 vulnerabilities.

## Evaluator Checks Satisfied
P1-T1..P1-T8 mapped in workspace traceability: foundation tests now enforce
P1-T2 first-run empty-feed, P1-T3 no-fake-index (network-derived reference),
P1-T5 identity env-only, P1-T7 recovery hides the private key, P1-T8 valuation.
CORE (publish/recover/see-later) deferred to next phase.

## Remaining
Phase 2 core: real publish, recovery CLI, network effects via a live Bee node.

## Problems
- No live Bee on localhost:1633 at phase close (by design; verified in probe).
---

# Phase 2 LIVE-CORE GATE — BLOCKED (2026-09-19, this session)

## Objective (phase 2)
Live round-trip: publish archive via signed feed on a real Bee, then independently
recover from the feed identity alone. Foundation (34 tests) already green.

## Fresh gate probe (2026-09-19, three independent methods)
1. HTTP/TCP: `http://localhost:1633/health` -> REFUSED/TIMEOUT (4s cap). No Bee
   listener on 1633 (nor 1634/1635/3000/4000).
2. Binaries/tools: `docker` NOT INSTALLED; no `bee`, `bee-smoke`, `swarm` binaries;
   no bee/swarm processes. Cannot start a node (no Docker, no binary bundle).
3. Public gateway `api.gateway.ethswarm.org` -> 200 (reachable) but serves bytes
   only; no postage-batch creation and no feed writes under an arbitrary private
   key. P1's round-trip requires BOTH a usable batch AND a signed feed writer ->
   not satisfyable via public gateway.

## Decision (per phase gate)
STOP live P1 core. Do not fake network results. No publish/recover manifest was
written to any network, and none is claimed.

## What IS verified this phase (no network needed)
- 34 foundation tests green (5 files), `typecheck` clean, `build` clean, git clean.
- Publisher/recovery orchestration + boundary guards are unit-tested (feeds resolve
  next index from network state, never a local counter; recovery uses public info only).

## Exact blocker
No Bee node (and no way to launch one: no Docker, no binary, no process) is
available in this environment at phase close. Live publish + network recovery +
batch-lifetime + empty-feed-effects therefore remain blocked, exactly as designed
in Phase 0 (plan.md sec 20 / action.md "Problems").

## TASK 7 — Final Report (P1-01..P1-08)

Date: 2026-09-19 (this session's date per env).

### P1-01 (Tracked non-secret publication descriptor) — DONE
publication.json is tracked at repo root (on disk, verified by tests/publication.test.ts):
owner/topic = PENDING (placeholders the human replaces on first live publish), format =
swarm-preservation-archive, version = 1. Non-secret by construction (no keys/batches).

### P1-02 (Deterministic architecture + tests) — DONE, 37/37 GREEN
npm test = vitest run (6 test files, 37 tests, all passing, deterministic).
npm run build = clean (tsc -p tsconfig.build.json, BUILD_EXIT=0).
npx tsc --noEmit = clean (src + tests all typecheck).

### P1-03 (TASK  emergencies) —

### P1-04 (Live write typechecker/oracle distinction) — IMPLEMENTED
src/swarm + src/archive are deterministic-blind ports (no Bee imports). Live tree was
removed (deleted src/live scratch per TASK 6 instruction "no parallel architecture").

### P1-05 (No fabricated live results) — UPHELD
This session never ran against a live Bee (no BEE_URL/BATCH available to me). The live
integration command exists (npm run test:live) and FAILS CLEARLY when BEE_URL is absent:
`
if (!BEE_URL) { throw new Error('Refusing to fake a live result without a live Bee. ...') }
`
Deterministic suite excludes tests/live/** (vitest.config.ts) so 
pm test stays green
on this machine even though the live round trip was NOT executed here.

### P1-06 (Security audit) — CLEAN
Secret scan across tracked working tree (excluded node_modules/.git and generated dist):
grep for private keys (0x[64 hex]), pre-issued postage batch IDs, BEE_URL-with-credentials,
BATCH_ID/PRIVATE_KEY literals, gold-ticket/gift-word tokens — NO matches.
publication.json contains no seed phrases, private keys, or batch identifiers.
(No filesystem secret scan: secrets live only in the human's real .env / 1Password, never
in tracked files — ADDED as P1-06 note.)

### P1-07 (Cle) —

### P1-08 — DONE
- action.md updated (this file).
- README.md + docs/recovery.md contain the exact live command for the human:
  npm run test:live  (requires: a running Bee node, BEE_URL, BATCH_ID env, npm i first)
- publication.json left in PENDING state; the human's real publish replaces PENDING with
  the real feed owner + topic and records the live evidence in this report.

## How the human runs the live round trip (TASK 2/3)
1. Ensure a Bee node is running locally (Bee Desktop or 
pm run bee), reachable at
   http://localhost:1633 (BEE_URL).
2. Create a usable postage batch (BATCH_ID).
3. From the repo root:
   `
   npm i
      = "http://localhost:1633"
     = "<your usable postage batch id>"
   npm run test:live
   `
4. Expected: the gated live test performs the real 1..12 round trip against Bee and
   reports byte-exact recovery. If it fails, the failure is real and shown, never faked.

## Done. Honest limit recorded
Deterministic layer: fully built + all tests green, verified directly (tsc/vitest/build).
Live round trip: NOT run here (no live Bee attachable from this session) — command +
gating are in place; success requires the human's real Bee in step 3 above. No fabricated
results are claimed anywhere in this repo.
