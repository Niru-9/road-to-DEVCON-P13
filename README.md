# Problem 1 — Archive That Outlives Its Host

> Phase 0 (research + plan). Implementation **NOT STARTED**.

## 1. Problem
A manuscript archive is published once; the publishing application disappears; a
reader who holds a single archive identifier must still recover every file.

## 2. Why Swarm
Content-addressed storage (`/bytes`) makes references verifiable and independent of
any host. Feeds provide signed, mutable pointers so "the archive" keeps one stable
identity across updates. Postage-batch lifetime makes storage honesty explicit.

## 3. Architecture
```
content → references → manifest (content-addressed) → feed → stable identity
```
- **Publisher** CLI: uploads files, builds a manifest, uploads it, writes its
  reference to a feed.
- **Recovery** entrypoint: feed → manifest → items → files. No publisher state used.
- Feed identity = `owner` (publisher public key) + `topic`, recorded in
  `archive-format/feed.json` (public only).

## 4. Prerequisites
- Node.js 22+, npm 11+
- A Bee node for real writes (`http://localhost:1633`) plus a funded postage batch
- `@ethersphere/bee-js@^13.1.0`

## 5. Installation
Planned (Phase 2): `npm install` after `package.json` is added.

## 6. Configuration
Copy `.env.example` → `.env`:
`BEE_URL`, `PRIVATE_KEY`, `BATCH_ID`, `OUTPUT_DIR`. `.env` is git-ignored.

## 7. Running
Planned: `npm run publish` (publish archive) and `npm run recover` (independent
recovery). See `docs/recovery.md`.

## 8. Demo
Planned (Phase 7): real publish of a manuscript folder against a live Bee, then
recovery from only the feed identity.

## 9. Recovery
`docs/recovery.md` — the standalone reader contract: inputs owner/topic (or feed
manifest), Bee endpoint, output directory.

## 10. Test results
No code yet. Test plan in `plan.md` §13; per-check template in
`docs/evaluator-audit.md`.

## 11. Evaluator traceability
`plan.md` §5 and workspace `docs/traceability-matrix.md` (P1-T1…P1-T8).

## 12. Security
Keys only in `.env`; `feed.json` and repo files contain public identifiers only;
`.env.example` placeholders; final audit via `git ls-files` (master plan §34).

## 13. Limitations
- "Permanent" is bounded by postage-batch lifetime; the app measures and displays it
  honestly (P1-6).
- Requires a live Bee node for real publication (reveal at demo time).

## 14. Interoperability
Defines the public `swarm-preservation-archive` manifesto format (readable by any
agent). P2 reads published references without the original app; P3 uses the same
feed/signing primitives for stewardship continuity.

## 15. Reproduction instructions
Re-enact: start Bee → fund batch → `npm run publish` → note feed identity → teardown
app → `npm run recover --owner … --topic …`. Full scripts land in Phase 8 docs.