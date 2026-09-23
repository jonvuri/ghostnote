/** Version-bound documentation retrieval. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  cacheOfficialDocument, exactReleaseNotes, generalGuide53, installedVersion, readCachedDocument,
  MAX_OFFICIAL_DOCUMENT_BYTES, type CachedDocument, type DocumentCompatibility,
  type DocumentFetch, type OfficialDocumentRequest,
} from '../probes/phase6b-document-cache-lib.js';
import {
  WORKSTATION_RESPONSE_SCHEMA, WorkstationModuleError, type ModuleHealth,
  type WorkstationModule,
} from '../workstation/module-registry.js';

export const DOCUMENTATION_SOURCE_SCHEMA = 'ghostnote-documentation-source-v0';
export const DOCUMENTATION_REQUEST_SCHEMA = 'ghostnote-documentation-request-v0';
export const DOCUMENTATION_RESULT_SCHEMA = 'documentation-v0';
export const DOCUMENTATION_MODULE_ID = 'ghostnote-documentation';
export const DOCUMENTATION_MODULE_VERSION = '0';
export const DOCUMENTATION_INDEX_SCHEMA = 'ghostnote-documentation-index-v0';
export const DOCUMENTATION_PROVIDER_VERSION = '0';

const SOURCE_DIGEST_DOMAIN = 'documentation-source-v0';
const INDEX_TOKENIZER = 'porter unicode61';
const INDEX_TITLE_WEIGHT = 4;
const INDEX_CONTENT_WEIGHT = 1;
const MAX_QUERY_CHARACTERS = 512;
const MAX_RESULTS = 5;
const MAX_EXCERPT_CHARACTERS = 360;
const MAX_SOURCE_FILES = 4_096;
const MAX_SOURCE_BYTES = 128 * 1_024 * 1_024;
const MAX_SOURCE_FILE_BYTES = MAX_OFFICIAL_DOCUMENT_BYTES;
const MAX_RECORDS = 4_096;
const MAX_RECORD_CHARACTERS = 2_000_000;
const MAX_INDEX_TEXT_BYTES = 256 * 1_024 * 1_024;
const MAX_INDEX_FILE_BYTES = 512 * 1_024 * 1_024;
const MAX_EXTRACTED_TEXT_BYTES = 16 * 1_024 * 1_024;
const MAX_EXTRACTOR_STDERR_BYTES = 64 * 1_024;
const DEFAULT_GUIDE_TIMEOUT_MS = 20_000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 90_000;
const VERSION = /^\d+\.\d+(?:\.\d+)?$/;
const SHA256 = /^[a-f0-9]{64}$/;
const TOKEN = /[a-z0-9]+/g;
const CAMEL = /(?<=[a-z0-9])(?=[A-Z])/g;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'does', 'for', 'from',
  'how', 'i', 'in', 'into', 'is', 'it', 'made', 'of', 'on', 'or', 'project', 'same',
  'set', 'that', 'the', 'their', 'this', 'to', 'use', 'what', 'where', 'which', 'with',
]);

export type DocumentationFamily = 'api' | 'workflow' | 'device';
export type DocumentationCompatibilityRequirement = 'exact' | 'general-workflow-allowed';
export type DocumentationSourceMode = 'automatic' | 'offline';

export interface DocumentationSourceSelection {
  readonly productVersion: string;
  readonly family: DocumentationFamily;
}

export interface DocumentationSourceFile {
  readonly relativePath: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly content: Uint8Array;
}

export interface DocumentationSourceEntry {
  readonly sourceId: string;
  readonly kind: 'installed-tree' | 'verified-cache';
  readonly productVersion: string;
  readonly documentVersion: string;
  readonly compatibility: DocumentCompatibility;
  readonly mediaType: 'text/html' | 'application/pdf' | 'text/x-java-properties';
  readonly sourceUrl: string | null;
  readonly resolvedUrl: string | null;
  readonly manifestSha256: string;
  readonly sourceSha256: string;
  readonly byteCount: number;
  readonly files: readonly DocumentationSourceFile[];
}

export interface OpenDocumentationSource {
  readonly schema: typeof DOCUMENTATION_SOURCE_SCHEMA;
  readonly family: DocumentationFamily;
  readonly productVersion: string;
  readonly digest: {
    readonly algorithm: 'sha256';
    readonly domain: typeof SOURCE_DIGEST_DOMAIN;
    readonly value: string;
  };
  readonly sources: readonly DocumentationSourceEntry[];
  readonly unavailableSourceIds: readonly string[];
  readonly downloadMs: number;
  readonly validationMs: number;
}

export interface DocumentationSourceOptions {
  readonly bitwigAppRoot: string;
  readonly cacheRoot: string;
  readonly repositoryRoot: string;
  readonly downloadTimeoutMs?: number;
  readonly mode?: DocumentationSourceMode;
  readonly releaseNotesRequest?: OfficialDocumentRequest;
  readonly guideRequest?: OfficialDocumentRequest;
  readonly documentFetch?: DocumentFetch;
}

export interface DocumentationQuery {
  readonly schema: typeof DOCUMENTATION_REQUEST_SCHEMA;
  readonly source: OpenDocumentationSource;
  readonly family: DocumentationFamily;
  readonly productVersion: string;
  readonly compatibility: DocumentationCompatibilityRequirement;
  readonly query: string;
  readonly limit: number;
}

export interface DocumentationLocator {
  readonly kind: 'installed-path' | 'html-section' | 'property-key' | 'pdf-page';
  readonly path: string;
  readonly value: string;
}

export interface DocumentationHit {
  readonly recordId: string;
  readonly title: string;
  readonly excerpt: string;
  readonly excerptCoverage: {
    readonly unit: 'characters';
    readonly from: number;
    readonly to: number;
    readonly total: number;
    readonly complete: boolean;
  };
  readonly rank: number;
  readonly source: {
    readonly family: DocumentationFamily;
    readonly sourceId: string;
    readonly manifestSha256: string;
    readonly sourceSha256: string;
    readonly recordSourceSha256: string;
    readonly productVersion: string;
    readonly documentVersion: string;
    readonly compatibility: DocumentCompatibility;
    readonly mediaType: DocumentationSourceEntry['mediaType'];
    readonly locator: DocumentationLocator;
  };
  readonly provider: {
    readonly name: 'ghostnote-documentation-provider';
    readonly version: typeof DOCUMENTATION_PROVIDER_VERSION;
  };
  readonly extractor: {
    readonly name: string;
    readonly version: string;
  };
  readonly index: {
    readonly schema: typeof DOCUMENTATION_INDEX_SCHEMA;
    readonly identitySha256: string;
    readonly engine: 'SQLite FTS5';
    readonly engineVersion: string;
    readonly tokenizer: typeof INDEX_TOKENIZER;
    readonly titleWeight: typeof INDEX_TITLE_WEIGHT;
    readonly contentWeight: typeof INDEX_CONTENT_WEIGHT;
  };
}

export interface DocumentationResult {
  readonly schema: typeof DOCUMENTATION_RESULT_SCHEMA;
  readonly source: {
    readonly family: DocumentationFamily;
    readonly productVersion: string;
    readonly sha256: string;
    readonly digestDomain: typeof SOURCE_DIGEST_DOMAIN;
  };
  readonly provider: DocumentationHit['provider'];
  readonly coverage: {
    readonly requestedFamily: DocumentationFamily;
    readonly requestedLimit: number;
    readonly returned: number;
    readonly sourceCount: number;
    readonly recordCount: number;
    readonly complete: boolean;
    readonly unavailableSourceIds: readonly string[];
    readonly noMatch: boolean;
  };
  readonly authority: 'bounded-source-excerpts';
  readonly hits: readonly DocumentationHit[];
  readonly warnings: readonly {
    readonly code: string;
    readonly sourceId: string;
    readonly message: string;
  }[];
  readonly timingMs: {
    readonly download: number;
    readonly sourceValidation: number;
    readonly extraction: number;
    readonly indexBuild: number;
    readonly indexValidation: number;
    readonly query: number;
  };
}

export interface GuideExtractor {
  readonly name: string;
  version(): Promise<string>;
  extract(bytes: Uint8Array): Promise<string>;
}

export interface DocumentationProviderOptions {
  readonly indexRoot: string;
  readonly repositoryRoot: string;
  readonly guideExtractor?: GuideExtractor;
  readonly guideTimeoutMs?: number;
  readonly onTiming?: (event: { readonly phase: string; readonly elapsedMs: number }) => void;
}

export class DocumentationError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-request' | 'source-unavailable' | 'source-mismatch'
    | 'corrupt-source' | 'incompatible-source' | 'missing-dependency' | 'stale-index',
  ) {
    super(message);
    this.name = 'DocumentationError';
  }
}

interface DocumentRecord {
  readonly recordId: string;
  readonly title: string;
  readonly content: string;
  readonly source: Omit<DocumentationHit['source'], 'family' | 'locator'>;
  readonly locator: DocumentationLocator;
  readonly extractor: DocumentationHit['extractor'];
}

class GuideExtractorFailure extends Error {
  constructor(
    message: string,
    readonly code: 'missing-dependency' | 'corrupt-source',
  ) {
    super(message);
    this.name = 'GuideExtractorFailure';
  }
}

function hash(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function inside(parent: string, child: string): boolean {
  const offset = relative(parent, child);
  return offset === '' || (!offset.startsWith(`..${sep}`) && offset !== '..' && !offset.startsWith(sep));
}

async function resolvedWithMissingTail(path: string): Promise<string> {
  let existing = resolve(path);
  const tail: string[] = [];
  while (true) {
    try {
      return join(await realpath(existing), ...tail.reverse());
    } catch (error) {
      if (!missingFile(error) || dirname(existing) === existing) throw error;
      tail.push(basename(existing));
      existing = dirname(existing);
    }
  }
}

async function externalRoot(path: string, repositoryRoot: string, label: string): Promise<void> {
  const [checked, repository] = await Promise.all([
    resolvedWithMissingTail(path), resolvedWithMissingTail(repositoryRoot),
  ]);
  if (inside(repository, checked)) {
    throw new DocumentationError(`${label} must be outside the repository`, 'invalid-request');
  }
}

async function listFiles(root: string, suffix: string): Promise<string[]> {
  const found: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(suffix)) found.push(path);
    }
  };
  await visit(root);
  return found;
}

async function stableTree(root: string, suffix: string): Promise<DocumentationSourceFile[]> {
  const before = await listFiles(root, suffix);
  if (before.length > MAX_SOURCE_FILES) {
    throw new DocumentationError('installed documentation exceeds the file limit', 'corrupt-source');
  }
  const preflight: { path: string; size: bigint; mtimeNs: bigint }[] = [];
  let totalBytes = 0;
  for (const path of before) {
    const first = await stat(path, { bigint: true });
    if (first.size > BigInt(MAX_SOURCE_FILE_BYTES)) {
      throw new DocumentationError(`installed documentation file is too large: ${path}`, 'corrupt-source');
    }
    totalBytes += Number(first.size);
    if (totalBytes > MAX_SOURCE_BYTES) {
      throw new DocumentationError('installed documentation exceeds the byte limit', 'corrupt-source');
    }
    preflight.push({ path, size: first.size, mtimeNs: first.mtimeNs });
  }
  const files: DocumentationSourceFile[] = [];
  for (const first of preflight) {
    const content = new Uint8Array(await readFile(first.path));
    const second = await stat(first.path, { bigint: true });
    if (first.size !== second.size || first.mtimeNs !== second.mtimeNs) {
      throw new DocumentationError(`installed documentation changed while reading ${first.path}`, 'source-mismatch');
    }
    files.push({
      relativePath: relative(root, first.path).split(sep).join('/'),
      sha256: hash(content),
      bytes: content.byteLength,
      content,
    });
  }
  const after = await listFiles(root, suffix);
  if (before.length !== after.length || before.some((path, index) => path !== after[index])) {
    throw new DocumentationError('installed documentation tree changed while reading', 'source-mismatch');
  }
  return files;
}

function installedEntry(
  sourceId: string,
  productVersion: string,
  documentVersion: string,
  mediaType: 'text/html' | 'text/x-java-properties',
  files: readonly DocumentationSourceFile[],
): DocumentationSourceEntry {
  if (files.length === 0) {
    throw new DocumentationError(`${sourceId} is unavailable`, 'source-unavailable');
  }
  const manifest = files.map(({ relativePath, sha256, bytes }) => ({ relativePath, sha256, bytes }));
  const manifestSha256 = hash(canonical(manifest));
  return {
    sourceId,
    kind: 'installed-tree',
    productVersion,
    documentVersion,
    compatibility: 'exact',
    mediaType,
    sourceUrl: null,
    resolvedUrl: null,
    manifestSha256,
    sourceSha256: manifestSha256,
    byteCount: files.reduce((total, file) => total + file.bytes, 0),
    files,
  };
}

function bundleDigest(
  family: DocumentationFamily,
  productVersion: string,
  sources: readonly DocumentationSourceEntry[],
  unavailableSourceIds: readonly string[],
): string {
  return hash(canonical({
    schema: DOCUMENTATION_SOURCE_SCHEMA,
    family,
    productVersion,
    sources: sources.map((source) => ({
      sourceId: source.sourceId,
      kind: source.kind,
      productVersion: source.productVersion,
      documentVersion: source.documentVersion,
      compatibility: source.compatibility,
      mediaType: source.mediaType,
      sourceUrl: source.sourceUrl,
      resolvedUrl: source.resolvedUrl,
      manifestSha256: source.manifestSha256,
      sourceSha256: source.sourceSha256,
      byteCount: source.byteCount,
      files: source.files.map(({ relativePath, sha256, bytes }) => ({ relativePath, sha256, bytes })),
    })),
    unavailableSourceIds,
  }));
}

function validateSelection(selection: DocumentationSourceSelection): void {
  if (!VERSION.test(selection.productVersion)) {
    throw new DocumentationError('the documentation product version is invalid', 'invalid-request');
  }
  if (!['api', 'workflow', 'device'].includes(selection.family)) {
    throw new DocumentationError('the documentation source family is invalid', 'invalid-request');
  }
}

function cacheEntry(document: Awaited<ReturnType<typeof readCachedDocument>>): DocumentationSourceEntry {
  const content = new Uint8Array(document.bytes);
  return {
    sourceId: document.manifest.sourceId,
    kind: 'verified-cache',
    productVersion: document.manifest.productVersion,
    documentVersion: document.manifest.documentVersion,
    compatibility: document.manifest.compatibility,
    mediaType: document.manifest.mediaType,
    sourceUrl: document.manifest.sourceUrl,
    resolvedUrl: document.manifest.resolvedUrl,
    manifestSha256: document.manifestSha256,
    sourceSha256: document.manifest.sha256,
    byteCount: content.byteLength,
    files: [{
      relativePath: document.manifest.fileName,
      sha256: document.manifest.sha256,
      bytes: content.byteLength,
      content,
    }],
  };
}

function missingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: unknown }).code === 'ENOENT';
}

const pendingGuideDownloads = new Map<string, Promise<void>>();

function sourceMode(options: DocumentationSourceOptions): DocumentationSourceMode {
  const mode = options.mode ?? 'automatic';
  if (mode !== 'automatic' && mode !== 'offline') {
    throw new DocumentationError('the documentation source mode is invalid', 'invalid-request');
  }
  return mode;
}

function effectiveDownloadTimeout(options: DocumentationSourceOptions): number {
  const value = options.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value < 1 || value > DEFAULT_DOWNLOAD_TIMEOUT_MS) {
    throw new DocumentationError('the documentation download deadline is invalid', 'invalid-request');
  }
  return value;
}

async function withDownloadDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new Error(`the documentation download exceeded its ${timeoutMs} ms deadline`);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([work(controller.signal), expired]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function downloadGuide(
  options: DocumentationSourceOptions,
  request: OfficialDocumentRequest,
  maximumBytes: number,
  timeoutMs: number,
): Promise<number> {
  const key = canonical([resolve(options.cacheRoot), request.productVersion, request.sourceId]);
  const started = performance.now();
  let work = pendingGuideDownloads.get(key);
  if (work === undefined) {
    work = withDownloadDeadline(
      (signal) => cacheOfficialDocument(
        options.cacheRoot,
        request,
        options.documentFetch,
        { maximumBytes, signal },
      ).then(() => undefined),
      timeoutMs,
    );
    pendingGuideDownloads.set(key, work);
    void work.finally(() => {
      if (pendingGuideDownloads.get(key) === work) pendingGuideDownloads.delete(key);
    }).catch(() => undefined);
  }
  await work;
  return performance.now() - started;
}

async function readWorkflowDocument(
  options: DocumentationSourceOptions,
  request: OfficialDocumentRequest,
  maximumBytes: number,
  downloadMissing: boolean,
  downloadTimeoutMs: number,
): Promise<{ readonly document: CachedDocument | null; readonly downloadMs: number }> {
  const read = () => readCachedDocument(
    options.cacheRoot,
    request,
    maximumBytes,
    (path) => externalRoot(path, options.repositoryRoot, 'the cached documentation source'),
  );
  try {
    return { document: await read(), downloadMs: 0 };
  } catch (error) {
    if (!missingFile(error)) throw error;
    if (!downloadMissing) return { document: null, downloadMs: 0 };
  }

  let downloadMs: number;
  const downloadStarted = performance.now();
  try {
    downloadMs = await downloadGuide(options, request, maximumBytes, downloadTimeoutMs);
  } catch {
    return { document: null, downloadMs: performance.now() - downloadStarted };
  }
  return { document: await read(), downloadMs };
}

/** Open and hash one selected family. Cached extraction must consume these bytes. */
export async function openDocumentationSource(
  options: DocumentationSourceOptions,
  selection: DocumentationSourceSelection,
): Promise<OpenDocumentationSource> {
  const started = performance.now();
  validateSelection(selection);
  const mode = sourceMode(options);
  await externalRoot(options.cacheRoot, options.repositoryRoot, 'the documentation cache');
  const info = await readFile(join(options.bitwigAppRoot, 'Contents', 'Info.plist'), 'utf8');
  const observedVersion = installedVersion(info);
  if (observedVersion !== selection.productVersion) {
    throw new DocumentationError(
      `installed Bitwig ${observedVersion} does not match requested ${selection.productVersion}`,
      'source-mismatch',
    );
  }

  const resources = join(options.bitwigAppRoot, 'Contents', 'Resources');
  const sources: DocumentationSourceEntry[] = [];
  const unavailableSourceIds: string[] = [];
  let downloadMs = 0;
  try {
    if (selection.family === 'api') {
      const root = join(resources, 'Documentation', 'control-surface', 'api', 'com', 'bitwig');
      const files = await stableTree(root, '.html');
      let apiVersion = 0;
      for (const file of files) {
        const matches = new TextDecoder('utf8', { fatal: true }).decode(file.content)
          .matchAll(/API version (\d+)/g);
        for (const match of matches) apiVersion = Math.max(apiVersion, Number(match[1]));
      }
      if (apiVersion === 0) {
        throw new DocumentationError('the installed API version is missing', 'corrupt-source');
      }
      sources.push(installedEntry(
        `installed-api-${apiVersion}`, observedVersion, `API ${apiVersion}`, 'text/html', files,
      ));
    } else if (selection.family === 'device') {
      const root = join(resources, 'localization');
      const names = [
        'Device-descriptions-resources.properties',
        'Modulator-descriptions-resources.properties',
        'Module-descriptions-resources.properties',
      ];
      const all = await stableTree(root, '.properties');
      const files = all.filter((file) => names.includes(basename(file.relativePath)));
      if (files.length !== names.length) {
        throw new DocumentationError('installed device descriptions are incomplete', 'source-unavailable');
      }
      sources.push(installedEntry(
        'installed-device-descriptions', observedVersion, observedVersion,
        'text/x-java-properties', files,
      ));
    } else {
      const downloadTimeoutMs = effectiveDownloadTimeout(options);
      const requests: readonly [OfficialDocumentRequest, boolean][] = [
        [options.releaseNotesRequest ?? exactReleaseNotes(observedVersion), false],
        [options.guideRequest ?? generalGuide53(observedVersion), mode === 'automatic'],
      ];
      if (requests.some(([request]) => request.productVersion !== observedVersion)) {
        throw new DocumentationError(
          'a cached documentation request does not match the installed product version',
          'source-mismatch',
        );
      }
      let cachedBytes = 0;
      for (const [request, downloadMissing] of requests) {
        try {
          const remainingBytes = MAX_SOURCE_BYTES - cachedBytes;
          const opened = await readWorkflowDocument(
            options,
            request,
            Math.min(MAX_SOURCE_FILE_BYTES, remainingBytes),
            downloadMissing,
            downloadTimeoutMs,
          );
          downloadMs += opened.downloadMs;
          const document = opened.document;
          if (document === null) {
            unavailableSourceIds.push(request.sourceId);
            continue;
          }
          const entry = cacheEntry(document);
          cachedBytes += entry.byteCount;
          sources.push(entry);
        } catch (error) {
          if (error instanceof DocumentationError) throw error;
          if (missingFile(error)) unavailableSourceIds.push(request.sourceId);
          else throw new DocumentationError(
            `cached source ${request.sourceId} failed validation: ${error instanceof Error ? error.message : String(error)}; remove or repair the cache entry before retrying`,
            'corrupt-source',
          );
        }
      }
      if (sources.length === 0) {
        throw new DocumentationError(
          `the workflow documentation family is unavailable: ${unavailableSourceIds.join(', ')}`,
          'source-unavailable',
        );
      }
    }
  } catch (error) {
    if (error instanceof DocumentationError) throw error;
    if (missingFile(error)) {
      throw new DocumentationError(`${selection.family} documentation is unavailable`, 'source-unavailable');
    }
    throw new DocumentationError(
      `${selection.family} documentation failed validation: ${error instanceof Error ? error.message : String(error)}`,
      'corrupt-source',
    );
  }
  sources.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  unavailableSourceIds.sort();
  const value = bundleDigest(selection.family, observedVersion, sources, unavailableSourceIds);
  return {
    schema: DOCUMENTATION_SOURCE_SCHEMA,
    family: selection.family,
    productVersion: observedVersion,
    digest: { algorithm: 'sha256', domain: SOURCE_DIGEST_DOMAIN, value },
    sources,
    unavailableSourceIds,
    downloadMs,
    validationMs: performance.now() - started - downloadMs,
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_all, number: string) => String.fromCodePoint(Number(number)))
    .replace(/&#x([a-f0-9]+);/gi, (_all, number: string) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_all, entity: string) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    })[entity] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryTokens(value: string): string[] {
  const terms = value.replace(CAMEL, ' ').toLowerCase().match(TOKEN) ?? [];
  return [...new Set(terms.filter((term) => term.length > 1 && !STOP_WORDS.has(term)))];
}

function searchable(value: string): string {
  return queryTokens(value).join(' ');
}

function sourceFields(source: DocumentationSourceEntry, recordSourceSha256: string) {
  return {
    sourceId: source.sourceId,
    manifestSha256: source.manifestSha256,
    sourceSha256: source.sourceSha256,
    recordSourceSha256,
    productVersion: source.productVersion,
    documentVersion: source.documentVersion,
    compatibility: source.compatibility,
    mediaType: source.mediaType,
  } as const;
}

function apiRecords(source: DocumentationSourceEntry): DocumentRecord[] {
  return source.files.map((file) => {
    const content = decodeHtml(new TextDecoder('utf8', { fatal: true }).decode(file.content));
    return {
      recordId: `api:${file.relativePath}`,
      title: basename(file.relativePath, '.html'),
      content,
      source: sourceFields(source, file.sha256),
      locator: { kind: 'installed-path', path: file.relativePath, value: file.relativePath },
      extractor: { name: 'html-visible-text', version: '0' },
    };
  });
}

function deviceRecords(source: DocumentationSourceEntry): DocumentRecord[] {
  const records: DocumentRecord[] = [];
  for (const file of source.files) {
    const grouped = new Map<string, string[]>();
    const text = new TextDecoder('utf8', { fatal: true }).decode(file.content);
    for (const line of text.split(/\r?\n/)) {
      if (line.length === 0 || line.startsWith('#') || !line.includes('=')) continue;
      const index = line.indexOf('=');
      const key = line.slice(0, index);
      const stem = key.replace(/\.[^.]+$/, '');
      const values = grouped.get(stem) ?? [];
      values.push(line.slice(index + 1));
      grouped.set(stem, values);
    }
    for (const [stem, values] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
      records.push({
        recordId: `device:${file.relativePath}:${stem}`,
        title: stem.replace(/[._]/g, ' '),
        content: values.join(' '),
        source: sourceFields(source, file.sha256),
        locator: { kind: 'property-key', path: file.relativePath, value: stem },
        extractor: { name: 'java-properties-description', version: '0' },
      });
    }
  }
  return records;
}

function releaseRecords(source: DocumentationSourceEntry): DocumentRecord[] {
  const file = source.files[0]!;
  const html = new TextDecoder('utf8', { fatal: true }).decode(file.content);
  const headings = [...html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const records: DocumentRecord[] = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]!;
    const title = decodeHtml(heading[2]!);
    const start = heading.index! + heading[0].length;
    const end = headings[index + 1]?.index ?? html.length;
    const content = decodeHtml(html.slice(start, end));
    if (content.length === 0) continue;
    records.push({
      recordId: `workflow:${source.sourceId}:section-${index + 1}`,
      title,
      content,
      source: sourceFields(source, file.sha256),
      locator: { kind: 'html-section', path: file.relativePath, value: `${index + 1}:${title}` },
      extractor: { name: 'html-heading-sections', version: '0' },
    });
  }
  return records;
}

function defaultGuideExtractor(timeoutMs: number): GuideExtractor {
  const command = 'pdftotext';
  const run = (
    arguments_: readonly string[],
    failureCode: GuideExtractorFailure['code'],
    input?: Uint8Array,
  ): Promise<{ stdout: string; stderr: string }> =>
    new Promise((resolvePromise, reject) => {
      const child = spawn(command, [...arguments_], { stdio: ['pipe', 'pipe', 'pipe'] });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let finished = false;
      const finish = (error?: Error): void => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (error !== undefined) {
          child.kill('SIGKILL');
          reject(error);
        }
      };
      const timeout = setTimeout(() => finish(new GuideExtractorFailure(
        `pdftotext exceeded its ${timeoutMs} ms deadline`,
        failureCode,
      )), timeoutMs);
      child.stdout.on('data', (part: Buffer) => {
        stdoutBytes += part.byteLength;
        if (stdoutBytes > MAX_EXTRACTED_TEXT_BYTES) {
          finish(new GuideExtractorFailure('pdftotext output exceeds the byte limit', failureCode));
        } else stdout.push(part);
      });
      child.stderr.on('data', (part: Buffer) => {
        stderrBytes += part.byteLength;
        if (stderrBytes > MAX_EXTRACTOR_STDERR_BYTES) {
          finish(new GuideExtractorFailure(
            'pdftotext diagnostics exceed the byte limit', failureCode,
          ));
        } else stderr.push(part);
      });
      child.on('error', (error) => finish(new GuideExtractorFailure(
        error.message, 'missing-dependency',
      )));
      child.on('close', (code) => {
        if (finished) return;
        const errorText = Buffer.concat(stderr).toString('utf8');
        if (code !== 0) finish(new GuideExtractorFailure(
          `pdftotext exited ${code}: ${errorText.trim()}`, failureCode,
        ));
        else {
          finished = true;
          clearTimeout(timeout);
          resolvePromise({ stdout: Buffer.concat(stdout).toString('utf8'), stderr: errorText });
        }
      });
      child.stdin.on('error', (error) => finish(error));
      if (input === undefined) child.stdin.end();
      else child.stdin.end(input);
    });
  return {
    name: 'pdftotext',
    version: async () => {
      const output = await run(['-v'], 'missing-dependency');
      const match = output.stderr.match(/pdftotext version ([^\s]+)/);
      if (match?.[1] === undefined) {
        throw new GuideExtractorFailure('cannot read the pdftotext version', 'missing-dependency');
      }
      return match[1];
    },
    extract: async (bytes) => (await run(['-layout', '-', '-'], 'corrupt-source', bytes)).stdout,
  };
}

function effectiveGuideTimeout(options: DocumentationProviderOptions): number {
  const value = options.guideTimeoutMs ?? DEFAULT_GUIDE_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value < 1 || value > DEFAULT_GUIDE_TIMEOUT_MS) {
    throw new DocumentationError('the guide extractor deadline is invalid', 'invalid-request');
  }
  return value;
}

async function withGuideDeadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(
      `the guide extractor exceeded its ${timeoutMs} ms deadline`,
    )), timeoutMs);
  });
  return Promise.race([work, expired]).finally(() => {
    if (timeout !== undefined) clearTimeout(timeout);
  });
}

async function guideRecords(
  source: DocumentationSourceEntry,
  extractor: GuideExtractor,
  version: string,
  timeoutMs: number,
): Promise<DocumentRecord[]> {
  const file = source.files[0]!;
  const text = await withGuideDeadline(
    extractor.extract(new Uint8Array(file.content)), timeoutMs,
  );
  if (Buffer.byteLength(text, 'utf8') > MAX_EXTRACTED_TEXT_BYTES) {
    throw new DocumentationError('guide extraction exceeds the text limit', 'corrupt-source');
  }
  return text.split('\f').flatMap((page, index) => {
    const content = page.replace(/\s+/g, ' ').trim();
    if (content.length === 0) return [];
    return [{
      recordId: `workflow:${source.sourceId}:page-${index + 1}`,
      title: `Bitwig Studio ${source.documentVersion} guide page ${index + 1}`,
      content,
      source: sourceFields(source, file.sha256),
      locator: { kind: 'pdf-page' as const, path: file.relativePath, value: String(index + 1) },
      extractor: { name: extractor.name, version },
    }];
  });
}

function assertSource(source: OpenDocumentationSource): OpenDocumentationSource {
  if (source === null || typeof source !== 'object'
      || source.digest === null || typeof source.digest !== 'object'
      || source.schema !== DOCUMENTATION_SOURCE_SCHEMA
      || !['api', 'workflow', 'device'].includes(source.family)
      || !VERSION.test(source.productVersion)
      || source.digest.algorithm !== 'sha256'
      || source.digest.domain !== SOURCE_DIGEST_DOMAIN
      || !SHA256.test(source.digest.value)
      || !Array.isArray(source.sources)
      || source.sources.length > MAX_SOURCE_FILES
      || !Array.isArray(source.unavailableSourceIds)
      || !Number.isFinite(source.downloadMs)
      || source.downloadMs < 0
      || !Number.isFinite(source.validationMs)
      || source.validationMs < 0) {
    throw new DocumentationError('the opened documentation source is invalid', 'corrupt-source');
  }
  let totalFiles = 0;
  let totalBytes = 0;
  for (const entry of source.sources) {
    if (entry === null || typeof entry !== 'object'
        || !Array.isArray(entry.files) || entry.files.length === 0
        || entry.files.length > MAX_SOURCE_FILES
        || !Number.isSafeInteger(entry.byteCount) || entry.byteCount < 0
        || entry.byteCount > MAX_SOURCE_BYTES) {
      throw new DocumentationError('a documentation source entry is invalid', 'corrupt-source');
    }
    let entryBytes = 0;
    for (const file of entry.files as readonly DocumentationSourceFile[]) {
      if (file === null || typeof file !== 'object'
          || !Number.isSafeInteger(file.bytes) || file.bytes < 0
          || file.bytes > MAX_SOURCE_FILE_BYTES
          || !(file.content instanceof Uint8Array)
          || file.content.byteLength !== file.bytes) {
        throw new DocumentationError('a documentation source file is invalid', 'corrupt-source');
      }
      entryBytes += file.bytes;
    }
    totalFiles += entry.files.length;
    totalBytes += entryBytes;
    if (entryBytes !== entry.byteCount
        || totalFiles > MAX_SOURCE_FILES || totalBytes > MAX_SOURCE_BYTES) {
      throw new DocumentationError('documentation source coverage exceeds its limit', 'corrupt-source');
    }
  }
  const sources = source.sources.map((entry) => {
    if (entry === null || typeof entry !== 'object'
        || typeof entry.sourceId !== 'string' || entry.sourceId.length === 0
        || !['installed-tree', 'verified-cache'].includes(entry.kind)
        || entry.productVersion !== source.productVersion
        || typeof entry.documentVersion !== 'string' || entry.documentVersion.length === 0
        || !['exact', 'general-workflow-only'].includes(entry.compatibility)
        || !['text/html', 'application/pdf', 'text/x-java-properties'].includes(entry.mediaType)
        || !SHA256.test(entry.manifestSha256) || !SHA256.test(entry.sourceSha256)
        || !Number.isSafeInteger(entry.byteCount) || entry.byteCount < 0
        || entry.byteCount > MAX_SOURCE_BYTES
        || !Array.isArray(entry.files) || entry.files.length === 0
        || entry.files.length > MAX_SOURCE_FILES) {
      throw new DocumentationError('a documentation source entry is invalid', 'corrupt-source');
    }
    const files = (entry.files as readonly DocumentationSourceFile[]).map((file) => {
      if (file === null || typeof file !== 'object'
          || typeof file.relativePath !== 'string' || file.relativePath.length === 0
          || file.relativePath.startsWith('/') || file.relativePath.split('/').includes('..')
          || !SHA256.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0
          || file.bytes > MAX_SOURCE_FILE_BYTES
          || !(file.content instanceof Uint8Array)) {
        throw new DocumentationError('a documentation source file is invalid', 'corrupt-source');
      }
      const content = new Uint8Array(file.content);
      if (content.byteLength !== file.bytes || hash(content) !== file.sha256) {
        throw new DocumentationError('opened documentation bytes changed after validation', 'source-mismatch');
      }
      return { ...file, content };
    });
    if (files.reduce((total, file) => total + file.bytes, 0) !== entry.byteCount) {
      throw new DocumentationError('documentation source byte coverage is invalid', 'corrupt-source');
    }
    if (entry.kind === 'installed-tree') {
      const manifestSha256 = hash(canonical(files.map(({ relativePath, sha256, bytes }) => ({
        relativePath, sha256, bytes,
      }))));
      if (manifestSha256 !== entry.manifestSha256 || entry.sourceSha256 !== manifestSha256) {
        throw new DocumentationError('installed documentation tree identity changed', 'source-mismatch');
      }
    } else if (files.length !== 1 || files[0]!.sha256 !== entry.sourceSha256) {
      throw new DocumentationError('cached documentation identity changed', 'source-mismatch');
    }
    return { ...entry, files };
  });
  const unavailableSourceIds = source.unavailableSourceIds.map((sourceId) => {
    if (typeof sourceId !== 'string' || sourceId.length === 0) {
      throw new DocumentationError('an unavailable documentation source ID is invalid', 'corrupt-source');
    }
    return sourceId;
  });
  if (new Set(sources.map((entry) => entry.sourceId)).size !== sources.length
      || new Set(unavailableSourceIds).size !== unavailableSourceIds.length) {
    throw new DocumentationError('documentation source IDs are ambiguous', 'corrupt-source');
  }
  const digest = bundleDigest(source.family, source.productVersion, sources, unavailableSourceIds);
  if (digest !== source.digest.value) {
    throw new DocumentationError('the documentation source digest does not match its bytes', 'source-mismatch');
  }
  return { ...source, sources, unavailableSourceIds };
}

function parseQuery(value: DocumentationQuery): DocumentationQuery {
  if (value === null || typeof value !== 'object'
      || value.schema !== DOCUMENTATION_REQUEST_SCHEMA
      || !['api', 'workflow', 'device'].includes(value.family)
      || !VERSION.test(value.productVersion)
      || !['exact', 'general-workflow-allowed'].includes(value.compatibility)
      || value.source === null || typeof value.source !== 'object'
      || typeof value.query !== 'string'
      || value.query.trim().length === 0
      || value.query.length > MAX_QUERY_CHARACTERS
      || !Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > MAX_RESULTS) {
    throw new DocumentationError('the documentation request is invalid', 'invalid-request');
  }
  if (value.family !== 'workflow' && value.compatibility !== 'exact') {
    throw new DocumentationError(
      'installed API and device requests require exact compatibility', 'invalid-request',
    );
  }
  const source = assertSource(value.source);
  if (source.family !== value.family || source.productVersion !== value.productVersion) {
    throw new DocumentationError('the selected documentation source does not match the request', 'source-mismatch');
  }
  return { ...value, query: value.query.trim(), source };
}

function sqliteVersion(): string {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec("CREATE VIRTUAL TABLE fts5_health USING fts5(value, tokenize='porter unicode61')");
    const row = database.prepare('SELECT sqlite_version() AS version').get() as { version?: unknown };
    if (typeof row.version !== 'string') throw new Error('SQLite did not report its version');
    return row.version;
  } finally {
    database.close();
  }
}

interface ExtractorPlan {
  readonly bySource: ReadonlyMap<string, DocumentationHit['extractor']>;
  readonly guideExtractor: GuideExtractor;
}

async function extractorPlan(
  sources: readonly DocumentationSourceEntry[],
  guideExtractor: GuideExtractor,
  timeoutMs: number,
): Promise<ExtractorPlan> {
  const bySource = new Map<string, DocumentationHit['extractor']>();
  for (const source of sources) {
    if (source.mediaType === 'application/pdf') {
      try {
        bySource.set(source.sourceId, {
          name: guideExtractor.name,
          version: await withGuideDeadline(guideExtractor.version(), timeoutMs),
        });
      } catch (error) {
        throw new DocumentationError(
          `the guide extractor is unavailable: ${error instanceof Error ? error.message : String(error)}`,
          'missing-dependency',
        );
      }
    } else if (source.mediaType === 'text/x-java-properties') {
      bySource.set(source.sourceId, { name: 'java-properties-description', version: '0' });
    } else if (source.kind === 'installed-tree') {
      bySource.set(source.sourceId, { name: 'html-visible-text', version: '0' });
    } else {
      bySource.set(source.sourceId, { name: 'html-heading-sections', version: '0' });
    }
  }
  return { bySource, guideExtractor };
}

async function extractRecords(
  family: DocumentationFamily,
  sources: readonly DocumentationSourceEntry[],
  plan: ExtractorPlan,
  guideTimeoutMs: number,
): Promise<DocumentRecord[]> {
  const records: DocumentRecord[] = [];
  for (const source of sources) {
    try {
      if (family === 'api') records.push(...apiRecords(source));
      else if (family === 'device') records.push(...deviceRecords(source));
      else if (source.mediaType === 'application/pdf') {
        const version = plan.bySource.get(source.sourceId)?.version;
        if (version === undefined) throw new Error('guide extractor version is missing');
        records.push(...await guideRecords(source, plan.guideExtractor, version, guideTimeoutMs));
      } else records.push(...releaseRecords(source));
    } catch (error) {
      if (error instanceof DocumentationError) throw error;
      throw new DocumentationError(
        `source ${source.sourceId} extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof GuideExtractorFailure ? error.code : 'corrupt-source',
      );
    }
  }
  if (records.length === 0) {
    throw new DocumentationError('documentation extraction returned no records', 'corrupt-source');
  }
  if (records.length > MAX_RECORDS
      || records.some((record) => record.title.length + record.content.length > MAX_RECORD_CHARACTERS)) {
    throw new DocumentationError('documentation extraction exceeds the record limit', 'corrupt-source');
  }
  records.sort((left, right) => left.recordId.localeCompare(right.recordId));
  if (new Set(records.map((record) => record.recordId)).size !== records.length) {
    throw new DocumentationError('documentation record IDs are ambiguous', 'corrupt-source');
  }
  return records;
}

function indexIdentity(
  family: DocumentationFamily,
  productVersion: string,
  sources: readonly DocumentationSourceEntry[],
  plan: ExtractorPlan,
  engineVersion: string,
): string {
  return hash(canonical({
    schema: DOCUMENTATION_INDEX_SCHEMA,
    providerVersion: DOCUMENTATION_PROVIDER_VERSION,
    family,
    productVersion,
    engine: 'SQLite FTS5',
    engineVersion,
    tokenizer: INDEX_TOKENIZER,
    titleWeight: INDEX_TITLE_WEIGHT,
    contentWeight: INDEX_CONTENT_WEIGHT,
    sources: sources.map((source) => ({
      sourceId: source.sourceId,
      sourceSha256: source.sourceSha256,
      manifestSha256: source.manifestSha256,
      productVersion: source.productVersion,
      documentVersion: source.documentVersion,
      compatibility: source.compatibility,
      extractor: plan.bySource.get(source.sourceId),
    })),
  }));
}

function indexMetadata(
  identitySha256: string,
  recordCount: number,
  recordsSha256: string,
  searchSha256: string,
): Readonly<Record<string, string>> {
  return {
    schema: DOCUMENTATION_INDEX_SCHEMA,
    identitySha256,
    providerVersion: DOCUMENTATION_PROVIDER_VERSION,
    tokenizer: INDEX_TOKENIZER,
    titleWeight: String(INDEX_TITLE_WEIGHT),
    contentWeight: String(INDEX_CONTENT_WEIGHT),
    recordCount: String(recordCount),
    recordsSha256,
    searchSha256,
  };
}

function storedRecord(record: DocumentRecord) {
  return {
    record_id: record.recordId,
    title: record.title,
    content: record.content,
    source_json: JSON.stringify(record.source),
    locator_json: JSON.stringify(record.locator),
    extractor_json: JSON.stringify(record.extractor),
  };
}

function storedSearch(record: DocumentRecord) {
  return {
    record_id: record.recordId,
    title: searchable(record.title),
    content: searchable(record.content),
  };
}

function databaseDigests(database: DatabaseSync): {
  readonly recordsSha256: string;
  readonly searchSha256: string;
} {
  const recordRows = database.prepare(`
    SELECT record_id, title, content, source_json, locator_json, extractor_json
    FROM records ORDER BY record_id
  `).all();
  const searchRows = database.prepare(`
    SELECT record_id, title, content FROM docs ORDER BY record_id
  `).all();
  return {
    recordsSha256: hash(canonical(recordRows)),
    searchSha256: hash(canonical(searchRows)),
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (missingFile(error)) return false;
    throw error;
  }
}

async function buildIndex(path: string, records: readonly DocumentRecord[], identitySha256: string): Promise<void> {
  const temporary = `${path}.${process.pid}-${Date.now()}.tmp`;
  const database = new DatabaseSync(temporary);
  let closed = false;
  try {
    const storedRecords = records.map(storedRecord);
    const storedSearchRows = records.map(storedSearch);
    database.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
      CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
      CREATE TABLE records(
        record_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source_json TEXT NOT NULL,
        locator_json TEXT NOT NULL,
        extractor_json TEXT NOT NULL
      ) STRICT;
      CREATE VIRTUAL TABLE docs USING fts5(
        record_id UNINDEXED, title, content, tokenize='porter unicode61'
      );
    `);
    const recordInsert = database.prepare(
      'INSERT INTO records(record_id, title, content, source_json, locator_json, extractor_json) '
      + 'VALUES (?, ?, ?, ?, ?, ?)',
    );
    const ftsInsert = database.prepare(
      'INSERT INTO docs(record_id, title, content) VALUES (?, ?, ?)',
    );
    database.exec('BEGIN IMMEDIATE');
    try {
      for (let index = 0; index < records.length; index += 1) {
        const record = storedRecords[index]!;
        const search = storedSearchRows[index]!;
        recordInsert.run(
          record.record_id, record.title, record.content, record.source_json,
          record.locator_json, record.extractor_json,
        );
        ftsInsert.run(search.record_id, search.title, search.content);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    const digests = databaseDigests(database);
    const metadata = database.prepare('INSERT INTO metadata(key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(indexMetadata(
      identitySha256, records.length, digests.recordsSha256, digests.searchSha256,
    ))) {
      metadata.run(key, value);
    }
    database.close();
    closed = true;
    await rename(temporary, path);
  } finally {
    if (!closed) database.close();
    if (await fileExists(temporary)) await unlink(temporary);
  }
}

function validateIndex(database: DatabaseSync, identitySha256: string): number {
  try {
    const metadataStats = database.prepare(`
      SELECT count(*) AS count, coalesce(sum(length(key) + length(value)), 0) AS bytes
      FROM metadata
    `).get() as { count?: unknown; bytes?: unknown };
    if (Number(metadataStats.count) > 16 || Number(metadataStats.bytes) > 64 * 1_024) {
      throw new Error('metadata coverage exceeds its limit');
    }
    const rows = database.prepare('SELECT key, value FROM metadata ORDER BY key').all() as {
      key: unknown; value: unknown;
    }[];
    const observed = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const recordCount = Number(observed.recordCount);
    if (!Number.isSafeInteger(recordCount) || recordCount < 1 || recordCount > MAX_RECORDS) {
      throw new Error('invalid record count');
    }
    const recordStats = database.prepare(`
      SELECT count(*) AS count,
             coalesce(sum(length(record_id) + length(title) + length(content)
               + length(source_json) + length(locator_json) + length(extractor_json)), 0) AS bytes
      FROM records
    `).get() as { count?: unknown; bytes?: unknown };
    const searchStats = database.prepare(`
      SELECT count(*) AS count,
             coalesce(sum(length(record_id) + length(title) + length(content)), 0) AS bytes
      FROM docs
    `).get() as { count?: unknown; bytes?: unknown };
    if (Number(recordStats.count) !== recordCount || Number(searchStats.count) !== recordCount
        || Number(recordStats.bytes) > MAX_INDEX_TEXT_BYTES
        || Number(searchStats.bytes) > MAX_INDEX_TEXT_BYTES) {
      throw new Error('record coverage exceeds its limit');
    }
    const integrity = database.prepare('PRAGMA integrity_check').get() as Record<string, unknown> | undefined;
    if (integrity === undefined || !Object.values(integrity).includes('ok')) {
      throw new Error('SQLite integrity check failed');
    }
    database.exec("INSERT INTO docs(docs) VALUES('integrity-check')");
    const digests = databaseDigests(database);
    const expected = indexMetadata(
      identitySha256, recordCount, digests.recordsSha256, digests.searchSha256,
    );
    if (canonical(observed) !== canonical(expected)) throw new Error('metadata mismatch');
    return recordCount;
  } catch (error) {
    throw new DocumentationError(
      `documentation index is stale or corrupt: ${error instanceof Error ? error.message : String(error)}`,
      'stale-index',
    );
  }
}

interface IndexedRecords {
  readonly database: DatabaseSync;
  readonly identitySha256: string;
  readonly recordCount: number;
  readonly extractionMs: number;
  readonly buildMs: number;
  readonly validationMs: number;
  readonly engineVersion: string;
}

async function openIndex(
  options: DocumentationProviderOptions,
  request: DocumentationQuery,
  sources: readonly DocumentationSourceEntry[],
): Promise<IndexedRecords> {
  await externalRoot(options.indexRoot, options.repositoryRoot, 'the documentation index');
  const engineVersion = sqliteVersion();
  const guideTimeoutMs = effectiveGuideTimeout(options);
  const guideExtractor = options.guideExtractor ?? defaultGuideExtractor(guideTimeoutMs);
  const plan = await extractorPlan(sources, guideExtractor, guideTimeoutMs);
  const identitySha256 = indexIdentity(
    request.family, request.productVersion, sources, plan, engineVersion,
  );
  const directory = join(options.indexRoot, request.productVersion, request.family);
  const path = join(directory, `${identitySha256}.sqlite`);
  await externalRoot(directory, options.repositoryRoot, 'the documentation index directory');
  await mkdir(directory, { recursive: true });
  await externalRoot(directory, options.repositoryRoot, 'the documentation index directory');
  let extractionMs = 0;
  let buildMs = 0;
  if (!await fileExists(path)) {
    let started = performance.now();
    const records = await extractRecords(request.family, sources, plan, guideTimeoutMs);
    extractionMs = performance.now() - started;
    options.onTiming?.({ phase: 'documentation-extraction', elapsedMs: extractionMs });
    started = performance.now();
    await buildIndex(path, records, identitySha256);
    buildMs = performance.now() - started;
    options.onTiming?.({ phase: 'documentation-index-build', elapsedMs: buildMs });
  }
  await externalRoot(path, options.repositoryRoot, 'the documentation index file');
  if ((await stat(path)).size > MAX_INDEX_FILE_BYTES) {
    throw new DocumentationError('documentation index exceeds the byte limit', 'stale-index');
  }
  const database = new DatabaseSync(path);
  const started = performance.now();
  try {
    const recordCount = validateIndex(database, identitySha256);
    const validationMs = performance.now() - started;
    options.onTiming?.({ phase: 'documentation-index-validation', elapsedMs: validationMs });
    return {
      database, identitySha256, recordCount, extractionMs, buildMs, validationMs, engineVersion,
    };
  } catch (error) {
    database.close();
    throw error;
  }
}

function excerpt(content: string, terms: readonly string[]): {
  text: string;
  coverage: DocumentationHit['excerptCoverage'];
} {
  const lower = content.toLowerCase();
  const positions = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  const focus = positions.length === 0 ? 0 : Math.min(...positions);
  const from = Math.max(0, Math.min(focus - 80, content.length - MAX_EXCERPT_CHARACTERS));
  const to = Math.min(content.length, from + MAX_EXCERPT_CHARACTERS);
  return {
    text: content.slice(from, to),
    coverage: { unit: 'characters', from, to, total: content.length, complete: from === 0 && to === content.length },
  };
}

/** Query one verified family through a disposable, identity-bound FTS5 index. */
export async function queryDocumentation(
  options: DocumentationProviderOptions,
  value: DocumentationQuery,
): Promise<DocumentationResult> {
  const request = parseQuery(value);
  const compatibleSources = request.source.sources.filter((source) =>
    request.compatibility === 'general-workflow-allowed' || source.compatibility === 'exact');
  if (compatibleSources.length === 0) {
    throw new DocumentationError(
      `no ${request.productVersion} exact source can support this request`, 'incompatible-source',
    );
  }
  const indexed = await openIndex(options, request, compatibleSources);
  const terms = queryTokens(request.query);
  const queryStarted = performance.now();
  try {
    const rows = terms.length === 0 ? [] : indexed.database.prepare(`
      SELECT records.record_id, records.title, records.content, records.source_json,
             records.locator_json, records.extractor_json,
             bm25(docs, 0.0, ${INDEX_TITLE_WEIGHT}.0, ${INDEX_CONTENT_WEIGHT}.0) AS score
      FROM docs JOIN records ON records.record_id = docs.record_id
      WHERE docs MATCH ?
      ORDER BY score ASC, records.record_id ASC
      LIMIT ?
    `).all(terms.map((term) => `"${term}"`).join(' OR '), request.limit) as {
      record_id: string;
      title: string;
      content: string;
      source_json: string;
      locator_json: string;
      extractor_json: string;
    }[];
    const queryMs = performance.now() - queryStarted;
    options.onTiming?.({ phase: 'documentation-query', elapsedMs: queryMs });
    const hits = rows.map((row, index): DocumentationHit => {
      const selected = excerpt(row.content, terms);
      return {
        recordId: row.record_id,
        title: row.title,
        excerpt: selected.text,
        excerptCoverage: selected.coverage,
        rank: index + 1,
        source: {
          family: request.family,
          ...JSON.parse(row.source_json) as Omit<DocumentationHit['source'], 'family' | 'locator'>,
          locator: JSON.parse(row.locator_json) as DocumentationLocator,
        },
        provider: { name: 'ghostnote-documentation-provider', version: DOCUMENTATION_PROVIDER_VERSION },
        extractor: JSON.parse(row.extractor_json) as DocumentationHit['extractor'],
        index: {
          schema: DOCUMENTATION_INDEX_SCHEMA,
          identitySha256: indexed.identitySha256,
          engine: 'SQLite FTS5',
          engineVersion: indexed.engineVersion,
          tokenizer: INDEX_TOKENIZER,
          titleWeight: INDEX_TITLE_WEIGHT,
          contentWeight: INDEX_CONTENT_WEIGHT,
        },
      };
    });
    const warnings = request.source.unavailableSourceIds.map((sourceId) => ({
      code: 'source-unavailable',
      sourceId,
      message: `The ${sourceId} source was unavailable for this family open.`,
    }));
    return {
      schema: DOCUMENTATION_RESULT_SCHEMA,
      source: {
        family: request.family,
        productVersion: request.productVersion,
        sha256: request.source.digest.value,
        digestDomain: SOURCE_DIGEST_DOMAIN,
      },
      provider: { name: 'ghostnote-documentation-provider', version: DOCUMENTATION_PROVIDER_VERSION },
      coverage: {
        requestedFamily: request.family,
        requestedLimit: request.limit,
        returned: hits.length,
        sourceCount: compatibleSources.length,
        recordCount: indexed.recordCount,
        complete: request.source.unavailableSourceIds.length === 0,
        unavailableSourceIds: request.source.unavailableSourceIds,
        noMatch: hits.length === 0,
      },
      authority: 'bounded-source-excerpts',
      hits,
      warnings,
      timingMs: {
        download: request.source.downloadMs,
        sourceValidation: request.source.validationMs,
        extraction: indexed.extractionMs,
        indexBuild: indexed.buildMs,
        indexValidation: indexed.validationMs,
        query: queryMs,
      },
    };
  } finally {
    indexed.database.close();
  }
}

/** Create the isolated read-only module. Source preparation remains family-local. */
export function documentationModule(
  options: DocumentationProviderOptions,
): WorkstationModule<DocumentationQuery, DocumentationResult> {
  return {
    descriptor: {
      moduleId: DOCUMENTATION_MODULE_ID,
      version: DOCUMENTATION_MODULE_VERSION,
      acceptedSchemas: [DOCUMENTATION_REQUEST_SCHEMA],
      emittedSchemas: [DOCUMENTATION_RESULT_SCHEMA],
      capabilities: [
        'query-api-documentation-v0',
        'query-workflow-documentation-v0',
        'query-device-documentation-v0',
      ],
      dependencyVersions: { node: process.versions.node },
      startupDeadlineMs: 1_000,
      requestDeadlineMs: 30_000,
    },
    start: async (): Promise<ModuleHealth> => ({
      state: 'available',
      capabilities: [
        'query-api-documentation-v0',
        'query-workflow-documentation-v0',
        'query-device-documentation-v0',
      ],
      missingCapabilities: [],
      dependencyVersions: { node: process.versions.node, sqlite: sqliteVersion() },
    }),
    handle: async (request) => {
      if (request.sourceSha256 !== request.payload.source.digest.value) {
        throw new WorkstationModuleError(
          'the module request source digest does not match the documentation source',
          'source-mismatch', DOCUMENTATION_MODULE_ID,
        );
      }
      return {
        schema: WORKSTATION_RESPONSE_SCHEMA,
        requestId: request.requestId,
        sourceSha256: request.sourceSha256,
        outputSchema: DOCUMENTATION_RESULT_SCHEMA,
        payload: await queryDocumentation(options, request.payload),
      };
    },
  };
}
