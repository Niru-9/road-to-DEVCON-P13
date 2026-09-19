import { describe, it, expect } from 'vitest';
import { buildManifest, validateManifest } from '../src/archive/manifest.js';
import { ARCHIVE_FORMAT, ARCHIVE_VERSION } from '../src/types.js';
import { InvalidManifestError } from '../src/errors.js';

const REF = 'c'.repeat(64);

describe('buildManifest', () => {
  it('sets format and version on every built manifest', () => {
    const m = buildManifest({
      title: 'Himalayan Manuscript Archive',
      updatedAt: '2026-09-19T00:00:00.000Z',
      items: [{ name: 'folio-001.jpg', reference: REF }],
    });
    expect(m.format).toBe(ARCHIVE_FORMAT);
    expect(m.version).toBe(ARCHIVE_VERSION);
    expect(m.title).toBe('Himalayan Manuscript Archive');
    expect(m.items).toHaveLength(1);
  });

  it('round-trips through JSON encoding (what gets uploaded as raw bytes)', () => {
    const m = buildManifest({
      title: 'T',
      updatedAt: '2026-01-01T00:00:00.000Z',
      items: [{ name: 'a.txt', reference: REF, size: 123 }],
    });
    const roundTripped = JSON.parse(JSON.stringify(m));
    expect(validateManifest(roundTripped)).toEqual(m);
  });
});

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    expect(() => validateManifest(buildManifest({ title: 'T', updatedAt: '2026-01-01T00:00:00.000Z', items: [] }))).not.toThrow();
  });

  it('rejects wrong format', () => {
    const raw = buildManifest({ title: 'T', updatedAt: '2026-01-01T00:00:00.000Z', items: [] });
    expect(() => validateManifest({ ...raw, format: 'other' })).toThrow(InvalidManifestError);
  });

  it('rejects wrong version', () => {
    const raw = buildManifest({ title: 'T', updatedAt: '2026-01-01T00:00:00.000Z', items: [] });
    expect(() => validateManifest({ ...raw, version: 99 })).toThrow(InvalidManifestError);
  });

  it('rejects non-object payloads', () => {
    expect(() => validateManifest(null)).toThrow(InvalidManifestError);
    expect(() => validateManifest('data')).toThrow(InvalidManifestError);
    expect(() => validateManifest([1, 2])).toThrow(InvalidManifestError);
  });

  it('rejects a bad item reference (non content address)', () => {
    const raw = buildManifest({
      title: 'T',
      updatedAt: '2026-01-01T00:00:00.000Z',
      items: [{ name: 'a.txt', reference: 'not-a-reference' }],
    });
    expect(() => validateManifest(raw)).toThrow(InvalidManifestError);
  });
});