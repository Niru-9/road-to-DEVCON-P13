# Evaluator Audit — Problem 1 (template)

Filled with PASS/fail evidence at the end of Phase 9. Statuses below are Phase-0
planning states; the template fields (`Source`, `Evidence`, `Test`) are completed
during/after implementation.

## P1-T1 — Feed publication (8 pts)

- Status: RESEARCHED
- Source: (map to src/swarm/feed.ts after implementation)
- Evidence: (feed writer + published feed address)
- Test: tests/feed.test.ts
- Manual verification: real feed publish (Phase 7)

## P1-T2 — Owner/topic tracked (6 pts)

- Status: PLANNED
- Source: archive-format/feed.json
- Evidence: public `{owner, topic}` committed
- Test: source/evaluator check (file exists; no private key)

## P1-T3 — Network feed index (16 pts)

- Status: RESEARCHED
- Source: src/swarm/feed.ts
- Evidence: read current feed state immediately before every update; no counters
- Test: tests/feed.test.ts

## P1-T4 — Large content by reference (12 pts)

- Status: RESEARCHED
- Source: src/archive/publisher.ts
- Evidence: `bee.data.upload` → `writer.uploadReference(batchId, reference)`
- Test: tests/recovery.test.ts

## P1-T5 — Independent recovery (14 pts)

- Status: PLANNED
- Source: src/cli/recover.ts
- Evidence: standalone entrypoint; owner/topic + Bee only
- Test: tests/recovery.test.ts
- Manual: teardown the app, run recover

## P1-T6 — Batch lifetime (8 pts)

- Status: RESEARCHED
- Source: src/swarm/storage.ts
- Evidence: `bee.stamp.get(batchId)` → displayed PAID/EXPIRING/EXPIRED
- Test: tests/storage.test.ts

## P1-T7 — Empty feed (8 pts)

- Status: RESEARCHED
- Source: src/swarm/feed.ts
- Evidence: empty-feed error → defined first-run state, no crash
- Test: tests/feed.test.ts

## P1-T8 — No credentials (8 pts)

- Status: PLANNED
- Source: .env.example + git ls-files audit
- Evidence: no keys/mnemonics/codes in tracked files
- Test: tests/security.test.ts