// P1-02 — Tracked, non-secret public publication descriptor.
// Ties together the PUBLIC feed identity (owner + topic) with the archive
// format/version. Deliberately plaintext-safe: it is the recovery identifier
// (P1-5, P1-9) and is READ by recovery — never used to sign. No private key,
// no batch id, no Bee URL belongs here.
//
// The tracked artifact (publication.json) is written ONLY by the live
// publication flow after a real, verified network round trip (status
// 'published'); it is never hand-fabricated. The optional publishedAt /
// feedIndex / reference fields are additional PUBLIC network-observed values,
// not secrets.

import { readFile, writeFile } from 'node:fs/promises';
import { ARCHIVE_FORMAT, ARCHIVE_VERSION } from '../types.js';
import type { FeedIdentity } from '../types.js';

export interface PublicationDescriptor {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
  /** Public feed identity: the ONLY inputs recovery needs (P1-5). */
  identity: FeedIdentity;
  /**
   * One of: 'created' (descriptor is the source of truth),
   * 'awaiting-first-live-publish' (identity resolved but no network write yet),
   * 'published' (a real network round trip verified identity + topic),
   * 'recovered' (manifest bytes re-materialized from feed state).
   */
  status: PublicationStatus;
  /** ISO timestamp of the live publication that produced identity (optional). */
  publishedAt?: string;
  /** Network-observed feed index at the time of publication (optional). */
  feedIndex?: string;
  /** Network-observed content reference of the published manifest (optional). */
  reference?: string;
}

export type PublicationStatus = 'created' | 'awaiting-first-live-publish' | 'published' | 'recovered';

export interface BuildPublicationDescriptorInput {
  owner: string;
  topic: string;
  status?: PublicationStatus;
  publishedAt?: string;
  feedIndex?: string;
  reference?: string;
}

export function buildPublicationDescriptor(input: BuildPublicationDescriptorInput): PublicationDescriptor {
  const owner = input.owner.trim();
  const topic = input.topic.trim();
  if (owner === '') throw new Error('Publication descriptor requires a feed owner (public address).');
  if (topic === '') throw new Error('Publication descriptor requires a feed topic.');
  const descriptor: PublicationDescriptor = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    identity: { owner, topic },
    status: input.status ?? 'created',
  };
  if (input.publishedAt !== undefined && input.publishedAt.trim() !== '') descriptor.publishedAt = input.publishedAt.trim();
  if (input.feedIndex !== undefined && input.feedIndex.trim() !== '') descriptor.feedIndex = input.feedIndex.trim();
  if (input.reference !== undefined && input.reference.trim() !== '') descriptor.reference = input.reference.trim();
  return descriptor;
}

const VALID_STATUSES: readonly PublicationStatus[] = ['created', 'awaiting-first-live-publish', 'published', 'recovered'];

export function validatePublicationDescriptor(raw: unknown): PublicationDescriptor {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Publication descriptor must be an object.');
  }
  const d = raw as Record<string, unknown>;
  if (d['format'] !== ARCHIVE_FORMAT) throw new Error(`Unsupported publication format: ${String(d['format'])}`);
  if (d['version'] !== ARCHIVE_VERSION) throw new Error(`Unsupported publication version: ${String(d['version'])}`);
  const id = d['identity'] as Record<string, unknown> | undefined;
  if (typeof id !== 'object' || id === null) throw new Error('Publication descriptor requires identity { owner, topic }.');
  const owner = String(id['owner'] ?? '');
  const topic = String(id['topic'] ?? '');
  if (owner.trim() === '') throw new Error('Publication descriptor requires an owner (public address).');
  if (topic.trim() === '') throw new Error('Publication descriptor requires a topic.');
  const status = String(d['status'] ?? 'created') as PublicationStatus;
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Unsupported publication status: ${status}`);
  }
  const descriptor: PublicationDescriptor = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    identity: { owner, topic },
    status,
  };
  const publishedAt = d['publishedAt'];
  if (typeof publishedAt === 'string' && publishedAt.trim() !== '') descriptor.publishedAt = publishedAt.trim();
  const feedIndex = d['feedIndex'];
  if (typeof feedIndex === 'string' && feedIndex.trim() !== '') descriptor.feedIndex = feedIndex.trim();
  const reference = d['reference'];
  if (typeof reference === 'string' && reference.trim() !== '') descriptor.reference = reference.trim();
  return descriptor;
}

/** Persist the descriptor as the tracked, non-secret publication artifact. */
export async function persistPublicationDescriptor(descriptor: PublicationDescriptor, filePath: string): Promise<void> {
  const json = JSON.stringify(descriptor, null, 2) + '\n';
  await writeFile(filePath, json, 'utf8');
}

/** Read + validate the persisted publication artifact. Throws if absent/invalid. */
export async function loadPublicationDescriptor(filePath: string): Promise<PublicationDescriptor> {
  const raw = await readFile(filePath, 'utf8');
  return validatePublicationDescriptor(JSON.parse(raw));
}