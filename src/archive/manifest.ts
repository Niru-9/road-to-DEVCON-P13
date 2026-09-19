// Archive manifest: build + validate against the committed schema.
// Pure logic — no network, no Bee. Content is addressed by reference so large
// files are represented by their reference, not their bytes (P1-4).

import { ARCHIVE_FORMAT, ARCHIVE_VERSION } from '../types.js';
import type { ArchiveManifest } from '../types.js';
import { InvalidManifestError } from '../errors.js';

export interface ManifestInput {
  title: string;
  updatedAt: string;
  items: { name: string; reference: string; size?: number }[];
  format?: string;
  version?: number;
}

export function buildManifest(input: ManifestInput): ArchiveManifest {
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    title: input.title,
    updatedAt: input.updatedAt,
    items: input.items.map((item) => ({
      name: item.name,
      reference: item.reference,
      ...(item.size !== undefined ? { size: item.size } : {}),
    })),
  };
}

export function validateManifest(raw: unknown): ArchiveManifest {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidManifestError('Archive manifest must be an object.');
  }
  const manifest = raw as Record<string, unknown>;
  if (manifest['format'] !== ARCHIVE_FORMAT) {
    throw new InvalidManifestError(`Unsupported archive format: ${String(manifest['format'])}`);
  }
  if (manifest['version'] !== ARCHIVE_VERSION) {
    throw new InvalidManifestError(`Unsupported archive version: ${String(manifest['version'])}`);
  }
  if (typeof manifest['title'] !== 'string' || manifest['title'].trim() === '') {
    throw new InvalidManifestError('Archive manifest requires a non-empty title.');
  }
  if (typeof manifest['updatedAt'] !== 'string' || Number.isNaN(Date.parse(manifest['updatedAt']))) {
    throw new InvalidManifestError('Archive manifest requires a valid updatedAt timestamp.');
  }
  if (!Array.isArray(manifest['items'])) {
    throw new InvalidManifestError('Archive manifest requires an items array.');
  }
  for (const item of manifest['items'] as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      throw new InvalidManifestError('Each archive item must be an object.');
    }
    const it = item as Record<string, unknown>;
    if (typeof it['name'] !== 'string' || it['name'].trim() === '') {
      throw new InvalidManifestError('Archive item requires a non-empty name.');
    }
    if (typeof it['reference'] !== 'string' || /^[0-9a-f]{64}$/i.test(it['reference']) === false) {
      throw new InvalidManifestError(`Archive item "${String(it['name'])}" has an invalid reference.`);
    }
  }
  return manifest as unknown as ArchiveManifest;
}