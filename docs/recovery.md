# Recovery — Archive That Outlives Its Host

## What the reader needs

- The archive feed identity: **owner** (publisher public key) + **topic**, or a
  **feed manifest reference**.
- A Bee endpoint (own node or a gateway).

## What the reader must NOT need

- The original application, its database, its index, its config, or its credentials.

## Steps

1. Resolve the current feed reference:
   - from `owner + topic`: `bee.feed.makeReader(topic, owner)` →
     `downloadReference()` (if feed is empty, report "archive not published yet").
   - from a feed-manifest reference: `bee.data.download(reference)` → the manifest
     document contains owner/topic; then proceed as above.
2. Download the archive manifest (`bee.data.download`).
3. Validate it against `archive-format/schema.json`.
4. For each item: `bee.data.download(item.reference)`, write to `OUTPUT_DIR/<name>`.
5. Report per-file success/failure clearly.

## Planned CLI

```bash
npm run recover -- --owner 0x... --topic 0x... --bee http://localhost:1633 -o ./recovered
# or
npm run recover -- --manifest 0x... --bee http://localhost:1633 -o ./recovered
```

## Design properties (map to checks)

| Property | Check |
| -------- | ----- |
| Reads current feed state from network | P1-3 |
| Feed points to a content-addressed manifest | P1-4 |
| No local publisher state consulted | P1-5 |
| Empty feed handled as defined first-run state | P1-7 |