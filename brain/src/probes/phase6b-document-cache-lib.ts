import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export type DocumentCompatibility = 'exact' | 'general-workflow-only';

export interface OfficialDocumentRequest {
  readonly sourceId: string;
  readonly productVersion: string;
  readonly documentVersion: string;
  readonly compatibility: DocumentCompatibility;
  readonly sourceUrl: string;
  readonly mediaType: 'text/html' | 'application/pdf';
  readonly minimumBytes: number;
  readonly requiredText?: string;
}

export interface CachedDocumentManifest extends OfficialDocumentRequest {
  readonly schemaVersion: 1;
  readonly resolvedUrl: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly fileName: string;
}

export interface CachedDocument {
  readonly manifest: CachedDocumentManifest;
  readonly manifestSha256: string;
  readonly path: string;
  readonly bytes: Uint8Array;
}

interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly url: string;
  readonly headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type DocumentFetch = (url: string) => Promise<FetchResponse>;

const VERSION = /^\d+\.\d+(?:\.\d+)?$/;
const SOURCE_ID = /^[a-z0-9][a-z0-9-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_MANIFEST_BYTES = 64 * 1_024;
const OFFICIAL_HOSTS = new Set([
  'www.bitwig.com',
  'downloads.bitwig.com',
  'downloads-secure.bitwig.com',
]);

function checkRequest(request: OfficialDocumentRequest): void {
  if (!SOURCE_ID.test(request.sourceId)) throw new Error('invalid document source id');
  if (!VERSION.test(request.productVersion)) throw new Error('invalid product version');
  if (!VERSION.test(request.documentVersion)) throw new Error('invalid document version');
  if (request.compatibility !== 'exact' && request.compatibility !== 'general-workflow-only') {
    throw new Error('invalid document compatibility');
  }
  if (request.mediaType !== 'text/html' && request.mediaType !== 'application/pdf') {
    throw new Error('invalid document media type');
  }
  if (!Number.isSafeInteger(request.minimumBytes) || request.minimumBytes < 1) {
    throw new Error('invalid minimum document size');
  }
  if (request.requiredText !== undefined
      && (typeof request.requiredText !== 'string' || request.requiredText.length === 0)) {
    throw new Error('invalid document version marker');
  }
  if (request.compatibility === 'exact' && request.productVersion !== request.documentVersion) {
    throw new Error('an exact document must match the product version');
  }
  checkOfficialUrl(request.sourceUrl);
}

function checkOfficialUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !OFFICIAL_HOSTS.has(url.hostname)) {
    throw new Error(`untrusted document URL: ${url.origin}`);
  }
  return url;
}

function publicResolvedUrl(value: string): string {
  const url = checkOfficialUrl(value);
  return `${url.origin}${url.pathname}`;
}

function manifestPath(cacheRoot: string, request: OfficialDocumentRequest): string {
  return join(cacheRoot, request.productVersion, request.sourceId, 'manifest.json');
}

function documentPath(cacheRoot: string, manifest: CachedDocumentManifest): string {
  return join(cacheRoot, manifest.productVersion, manifest.sourceId, manifest.fileName);
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseManifest(raw: Uint8Array): CachedDocumentManifest {
  const parsed = JSON.parse(new TextDecoder().decode(raw)) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('cached document manifest is invalid');
  }
  const value = parsed as Partial<CachedDocumentManifest>;
  if (value.schemaVersion !== 1
      || typeof value.sourceId !== 'string'
      || typeof value.productVersion !== 'string'
      || typeof value.documentVersion !== 'string'
      || (value.compatibility !== 'exact' && value.compatibility !== 'general-workflow-only')
      || typeof value.sourceUrl !== 'string'
      || (value.mediaType !== 'text/html' && value.mediaType !== 'application/pdf')
      || typeof value.minimumBytes !== 'number' || !Number.isSafeInteger(value.minimumBytes)
      || value.minimumBytes < 1
      || (value.requiredText !== undefined
        && (typeof value.requiredText !== 'string' || value.requiredText.length === 0))
      || typeof value.resolvedUrl !== 'string'
      || typeof value.sha256 !== 'string'
      || typeof value.bytes !== 'number' || !Number.isSafeInteger(value.bytes) || value.bytes < 1
      || typeof value.fileName !== 'string') {
    throw new Error('cached document manifest is invalid');
  }
  return value as CachedDocumentManifest;
}

function checkDocumentBytes(bytes: Uint8Array, request: OfficialDocumentRequest): void {
  if (request.mediaType === 'application/pdf') {
    if (new TextDecoder('ascii').decode(bytes.subarray(0, 5)) !== '%PDF-') {
      throw new Error('cached document is not a PDF');
    }
  } else if (request.requiredText !== undefined) {
    const text = new TextDecoder().decode(bytes);
    if (!text.includes(request.requiredText)) {
      throw new Error('cached document version marker is missing');
    }
  }
}

function sameRequest(manifest: CachedDocumentManifest, request: OfficialDocumentRequest): boolean {
  return manifest.schemaVersion === 1
    && manifest.sourceId === request.sourceId
    && manifest.productVersion === request.productVersion
    && manifest.documentVersion === request.documentVersion
    && manifest.compatibility === request.compatibility
    && manifest.sourceUrl === request.sourceUrl
    && manifest.mediaType === request.mediaType
    && manifest.minimumBytes === request.minimumBytes
    && manifest.requiredText === request.requiredText;
}

/** Read a cached official document and refuse stale or corrupt content. */
export async function readCachedDocument(
  cacheRoot: string,
  request: OfficialDocumentRequest,
  maximumBytes = Number.MAX_SAFE_INTEGER,
  validatePath?: (path: string) => Promise<void>,
): Promise<CachedDocument> {
  checkRequest(request);
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < request.minimumBytes) {
    throw new Error('invalid maximum document size');
  }
  const requestedManifestPath = manifestPath(cacheRoot, request);
  await validatePath?.(requestedManifestPath);
  if ((await stat(requestedManifestPath)).size > MAX_MANIFEST_BYTES) {
    throw new Error('cached document manifest is too large');
  }
  const raw = await readFile(requestedManifestPath);
  const manifest = parseManifest(raw);
  if (!sameRequest(manifest, request)) throw new Error('cached document metadata does not match the request');
  const extension = manifest.mediaType === 'application/pdf' ? 'pdf' : 'html';
  if (!SHA256.test(manifest.sha256)
    || manifest.fileName !== `${manifest.sha256}.${extension}`
    || manifest.bytes < request.minimumBytes
    || manifest.bytes > maximumBytes
    || publicResolvedUrl(manifest.resolvedUrl) !== manifest.resolvedUrl) {
    throw new Error('cached document manifest is invalid');
  }
  const path = documentPath(cacheRoot, manifest);
  await validatePath?.(path);
  const first = await stat(path, { bigint: true });
  if (first.size !== BigInt(manifest.bytes) || first.size > BigInt(maximumBytes)) {
    throw new Error('cached document physical size does not match the manifest');
  }
  const bytes = await readFile(path);
  const second = await stat(path, { bigint: true });
  if (first.size !== second.size || first.mtimeNs !== second.mtimeNs) {
    throw new Error('cached document changed while reading');
  }
  if (bytes.byteLength !== manifest.bytes || sha256(bytes) !== manifest.sha256) {
    throw new Error('cached document hash does not match the manifest');
  }
  checkDocumentBytes(bytes, request);
  return {
    manifest,
    manifestSha256: sha256(raw),
    path,
    bytes: new Uint8Array(bytes),
  };
}

/** Download, validate, and atomically cache one official Bitwig document. */
export async function cacheOfficialDocument(
  cacheRoot: string,
  request: OfficialDocumentRequest,
  fetchDocument: DocumentFetch = (url) => fetch(url),
): Promise<CachedDocument> {
  checkRequest(request);
  const response = await fetchDocument(request.sourceUrl);
  if (!response.ok) throw new Error(`document download failed with HTTP ${response.status}`);
  const resolvedUrl = publicResolvedUrl(response.url || request.sourceUrl);
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim();
  if (mediaType !== request.mediaType) {
    throw new Error(`unexpected document media type: ${mediaType ?? 'missing'}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < request.minimumBytes) throw new Error('document is smaller than expected');
  try {
    checkDocumentBytes(bytes, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace('cached document', 'downloaded document'));
  }

  const hash = sha256(bytes);
  const extension = request.mediaType === 'application/pdf' ? 'pdf' : 'html';
  const fileName = `${hash}.${extension}`;
  const manifest: CachedDocumentManifest = {
    schemaVersion: 1,
    ...request,
    resolvedUrl,
    sha256: hash,
    bytes: bytes.byteLength,
    fileName,
  };
  const finalManifestPath = manifestPath(cacheRoot, request);
  const directory = dirname(finalManifestPath);
  const finalDocumentPath = join(directory, fileName);
  const nonce = `${process.pid}-${Date.now()}`;
  const temporaryDocumentPath = join(directory, `.${basename(finalDocumentPath)}.${nonce}.tmp`);
  const temporaryManifestPath = join(directory, `.manifest.${nonce}.tmp`);
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryDocumentPath, bytes, { flag: 'wx' });
  await writeFile(temporaryManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await rename(temporaryDocumentPath, finalDocumentPath);
  await rename(temporaryManifestPath, finalManifestPath);
  return readCachedDocument(cacheRoot, request);
}

/** Read the installed Bitwig version from its application property list. */
export function installedVersion(infoPlist: string): string {
  const match = infoPlist.match(
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
  );
  if (match?.[1] === undefined || !VERSION.test(match[1])) {
    throw new Error('cannot read the installed Bitwig version');
  }
  return match[1];
}

export function exactReleaseNotes(productVersion: string): OfficialDocumentRequest {
  return {
    sourceId: 'release-notes',
    productVersion,
    documentVersion: productVersion,
    compatibility: 'exact',
    sourceUrl: `https://www.bitwig.com/dl/Bitwig%20Studio/${productVersion}/release_notes/`,
    mediaType: 'text/html',
    minimumBytes: 10_000,
    requiredText: `Changes in Bitwig Studio ${productVersion}`,
  };
}

export function generalGuide53(productVersion: string): OfficialDocumentRequest {
  return {
    sourceId: 'user-guide-5-3-en',
    productVersion,
    documentVersion: '5.3',
    compatibility: 'general-workflow-only',
    sourceUrl: 'https://downloads.bitwig.com/documentation/5.3/Bitwig%20Studio%20User%20Guide%20English.pdf',
    mediaType: 'application/pdf',
    minimumBytes: 1_000_000,
  };
}
