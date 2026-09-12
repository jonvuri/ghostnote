/** Phase 6b: cache exact release notes and the declared 5.3 guide fallback. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  cacheOfficialDocument,
  exactReleaseNotes,
  generalGuide53,
  installedVersion,
  readCachedDocument,
  type OfficialDocumentRequest,
} from './phase6b-document-cache-lib.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const appRoot = argument('--bitwig-app-root');
const cacheRoot = argument('--cache-root');
if (appRoot === undefined || cacheRoot === undefined) {
  throw new Error('usage: phase6b-document-cache --bitwig-app-root PATH --cache-root PATH [--offline]');
}

const version = installedVersion(await readFile(join(appRoot, 'Contents', 'Info.plist'), 'utf8'));
const requests: readonly OfficialDocumentRequest[] = [
  exactReleaseNotes(version),
  generalGuide53(version),
];
const offline = process.argv.includes('--offline');
const results = [];
for (const request of requests) {
  const started = performance.now();
  const result = offline
    ? await readCachedDocument(cacheRoot, request)
    : await cacheOfficialDocument(cacheRoot, request);
  results.push({
    sourceId: result.manifest.sourceId,
    productVersion: result.manifest.productVersion,
    documentVersion: result.manifest.documentVersion,
    compatibility: result.manifest.compatibility,
    sourceUrl: result.manifest.sourceUrl,
    resolvedUrl: result.manifest.resolvedUrl,
    bytes: result.manifest.bytes,
    sha256: result.manifest.sha256,
    elapsedMs: Math.round((performance.now() - started) * 10) / 10,
  });
}

console.log(JSON.stringify({ mode: offline ? 'offline' : 'download', results }, null, 2));
