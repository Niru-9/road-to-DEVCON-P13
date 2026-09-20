# P1 — Archive That Outlives Its Host

> **Swarm Build Battle — Problem 1**  
> A durable, independently recoverable manuscript archive built on Swarm.

## Overview

This project implements a Swarm-backed archive for a collection that must remain recoverable even if the original application, host, database, or operator disappears.

The design deliberately separates:

- **content storage** — archive data is uploaded to Swarm and represented by content references;
- **publication identity** — a Swarm Feed provides the stable publication identity;
- **recovery** — a reader resolves the published Feed, obtains the manifest, and downloads the referenced content without publisher-local state or signing credentials.

### Core recovery guarantee

```text
Published Feed identity
        │
        ▼
     Feed
        │
        ▼
Manifest reference
        │
        ▼
Content references
        │
        ▼
Recovered archive
```

The Feed identity is the public entry point. A raw content reference is not treated as the archive's stable identity.

---

## Why Swarm

The implementation uses three Swarm primitives:

| Primitive | Role |
|---|---|
| Content addressing | Stores archive data independently of the application |
| Swarm Feed | Provides a stable, signed publication pointer |
| Postage Batch | Funds storage and determines the current storage lifetime |

The system does **not** claim that a funded batch provides indefinite storage. The application reads and surfaces the actual remaining batch lifetime.

---

## Architecture

```text
                    PUBLISHER
                       │
              archive files / pages
                       │
                       ▼
                 Bee upload
                       │
                       ▼
              content references
                       │
                       ▼
                 archive manifest
                       │
                       ▼
               manifest reference
                       │
                       ▼
                  Feed update
                       │
                       ▼
              stable owner + topic
                       │
                       ▼
              ┌─────────────────┐
              │ Independent     │
              │ Reader          │
              └────────┬────────┘
                       │
                       ▼
                 Feed resolution
                       │
                       ▼
                Manifest download
                       │
                       ▼
                Content download
```

### Key design decisions

#### 1. Feed-backed publication

The archive identity is the Feed's public `owner + topic`, not merely the latest `/bytes` reference.

#### 2. Network-derived Feed index

Before every publication, the next Feed index is resolved from network state. There is no authoritative local counter.

#### 3. Large content by reference

Archive content is uploaded separately. The Feed publishes a reference to the manifest rather than embedding the archive bytes.

#### 4. Independent recovery

Recovery does not require:

- the publisher's database;
- a local Feed counter;
- cached application state;
- the publisher's private signing key.

#### 5. Empty Feed handling

The first publication explicitly handles an empty Feed instead of assuming a previous update exists.

#### 6. Storage lifetime visibility

Postage Batch state is read from Bee and the remaining lifetime is surfaced to the application.

---

## Evaluator Traceability

| Criterion | Requirement | Result |
|---|---|---|
| **P1-01** | Feed-backed publication | ✅ PASS |
| **P1-02** | Feed owner/topic recorded in tracked evidence | ✅ PASS |
| **P1-03** | Next Feed index resolved from network | ✅ PASS |
| **P1-04** | Content larger than one chunk published by reference | ✅ PASS |
| **P1-05** | Recovery from published identifiers alone | ✅ PASS |
| **P1-06** | Batch remaining lifetime read and surfaced | ✅ PASS |
| **P1-07** | Empty Feed handled | ✅ PASS |
| **P1-08** | No secrets in tracked files | ✅ PASS |

**Evaluator result: 8/8 PASS**

---

## Verified Results

| Validation | Result |
|---|---:|
| Deterministic tests | **44/44 PASS** |
| TypeScript build | **PASS** |
| Type checking | **PASS** |
| Evaluator criteria | **8/8 PASS** |
| Live P1 integration | **1/1 PASS** |
| Secret audit | **PASS** |

The live integration previously completed against a real Bee node and exercised real storage, Feed publication, Feed-index resolution, and independent recovery.

A later local Bee restart introduced synchronization/readiness limitations. That environmental state is kept separate from the previously verified live result; the repository does not fabricate a new live pass when the node is not ready.

---

## Evidence

Important evaluator-facing artifacts:

```text
publication.json
docs/recovery.md
```

`publication.json` records public publication identifiers. It does not contain a private signing credential.

Implementation areas:

```text
src/archive/publication.ts
src/swarm/feed.ts
src/swarm/storage.ts
src/swarm/batch.ts
```

Tests include:

```text
tests/batch.test.ts
tests/feed.test.ts
tests/publication.test.ts
tests/live/p1-live.test.ts
```

---

## Repository Structure

```text
.
├── archive-format/
│   └── feed.json
├── docs/
│   └── recovery.md
├── src/
│   ├── archive/
│   │   └── publication.ts
│   ├── swarm/
│   │   ├── batch.ts
│   │   ├── feed.ts
│   │   └── storage.ts
│   ├── cli/
│   │   └── main.ts
│   └── errors.ts
├── tests/
│   ├── batch.test.ts
│   ├── feed.test.ts
│   ├── publication.test.ts
│   └── live/
│       └── p1-live.test.ts
├── publication.json
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── vitest.live.config.ts
└── .env.example
```

---

## Technology Stack

| Component | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 22+ |
| Package manager | npm |
| Storage | Swarm / Bee |
| SDK | `@ethersphere/bee-js` 13.1.x |
| Publication | Swarm Feed |
| Testing | Vitest |
| Local Bee | Swarm Desktop / Bee 2.x |

---

## Configuration

Create a local `.env` from `.env.example`.

Typical configuration:

```env
BEE_URL=http://localhost:1633
PRIVATE_KEY=<local-signing-key>
BATCH_ID=<usable-postage-batch-id>
OUTPUT_DIR=<recovery-output-directory>
```

### Security

`.env` is intentionally not tracked.

Never commit:

- private keys;
- seed phrases;
- wallet credentials;
- gift codes;
- authenticated URLs;
- API credentials.

Tracked evidence may contain public Feed identities and content references.

---

## Installation

Requirements:

- Node.js 22+
- npm 11+
- Bee / Swarm Desktop for live testing
- a usable funded Postage Batch for real uploads

Install:

```bash
npm install
```

---

## Verification

Build:

```bash
npm run build
```

Type check:

```bash
npx tsc --noEmit
```

Deterministic tests:

```bash
npx vitest run
```

Live integration:

```bash
npm run test:live
```

Live execution requires a synchronized Bee node and usable Postage Batch.

---

## Recovery Model

A recovery reader needs the published archive identity, not the original publisher's application state.

```text
Feed owner + topic
        │
        ▼
Feed reader
        │
        ▼
Published manifest reference
        │
        ▼
Manifest
        │
        ▼
Content references
        │
        ▼
Recovered files
```

The publisher's private signing key is not part of the recovery contract.

---

## Storage Durability Model

The durability model is explicit:

```text
Funded Postage Batch
        │
        ▼
Storage available
        │
        ▼
Archive references remain usable
        │
        ▼
Batch lifetime monitored
        │
        ▼
Funding must eventually be extended/topped up
```

The Feed provides publication continuity; the Postage Batch provides storage funding.

---

## Reproduction

For deterministic verification:

```bash
npm install
npm run build
npx tsc --noEmit
npx vitest run
```

For a live run:

1. Start Bee / Swarm Desktop.
2. Wait for synchronization/readiness.
3. Configure `BEE_URL`.
4. Configure a usable `BATCH_ID`.
5. Configure the local signing credential.
6. Publish the archive.
7. Record the public Feed owner/topic.
8. Run the independent recovery path.
9. Verify the recovered data.

---

## Submission Status

**Problem 1 — Archive That Outlives Its Host**

- Evaluator criteria: **8/8 PASS**
- Deterministic tests: **44/44 PASS**
- Live integration: **1/1 PASS**
- Build: **PASS**
- Typecheck: **PASS**
- Secret audit: **PASS**

The implementation provides a Feed-backed archive identity, network-derived Feed sequencing, content-by-reference publication, independent recovery, explicit empty-Feed handling, and visible Postage Batch lifetime.
