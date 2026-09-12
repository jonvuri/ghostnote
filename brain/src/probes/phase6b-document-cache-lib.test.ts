import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  cacheOfficialDocument,
  exactReleaseNotes,
  generalGuide53,
  installedVersion,
  readCachedDocument,
  type DocumentFetch,
} from './phase6b-document-cache-lib.js';

function response(body: string, url: string, mediaType = 'text/html'): DocumentFetch {
  return async () => ({
    ok: true,
    status: 200,
    url,
    headers: { get: (name) => name.toLowerCase() === 'content-type' ? mediaType : null },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  });
}

test('6b cache binds exact content to the requested product version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ghostnote-6b-cache-'));
  try {
    const request = { ...exactReleaseNotes('6.0.6'), minimumBytes: 10 };
    const body = '<h1>Changes in Bitwig Studio 6.0.6</h1>';
    const cached = await cacheOfficialDocument(
      root,
      request,
      response(body, 'https://downloads-secure.bitwig.com/6.0.6/Release-Notes-6.0.6.html?token=secret'),
    );

    assert.equal(cached.manifest.compatibility, 'exact');
    assert.equal(cached.manifest.documentVersion, '6.0.6');
    assert.equal(
      cached.manifest.resolvedUrl,
      'https://downloads-secure.bitwig.com/6.0.6/Release-Notes-6.0.6.html',
    );
    assert.equal((await readFile(cached.path, 'utf8')), body);
    assert.deepEqual(await readCachedDocument(root, request), cached);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('6b cache refuses version marker, host, and hash failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ghostnote-6b-cache-'));
  const request = { ...exactReleaseNotes('6.0.6'), minimumBytes: 1 };
  try {
    await assert.rejects(
      cacheOfficialDocument(
        root,
        request,
        response('wrong version', 'https://downloads-secure.bitwig.com/6.0.6/Release-Notes-6.0.6.html'),
      ),
      /version marker/,
    );
    await assert.rejects(
      cacheOfficialDocument(
        root,
        request,
        response('Changes in Bitwig Studio 6.0.6', 'https://example.com/document.html'),
      ),
      /untrusted document URL/,
    );
    await assert.rejects(
      cacheOfficialDocument(
        root,
        { ...request, minimumBytes: 100 },
        response(
          'Changes in Bitwig Studio 6.0.6',
          'https://downloads-secure.bitwig.com/6.0.6/Release-Notes-6.0.6.html',
        ),
      ),
      /smaller than expected/,
    );
    await assert.rejects(
      cacheOfficialDocument(
        root,
        request,
        response(
          'Changes in Bitwig Studio 6.0.6',
          'https://downloads-secure.bitwig.com/6.0.6/Release-Notes-6.0.6.html',
          'application/pdf',
        ),
      ),
      /media type/,
    );
    const cached = await cacheOfficialDocument(
      root,
      request,
      response(
        'Changes in Bitwig Studio 6.0.6',
        'https://downloads-secure.bitwig.com/6.0.6/Release-Notes-6.0.6.html',
      ),
    );
    await assert.rejects(
      readCachedDocument(root, {
        ...request,
        sourceUrl: 'https://www.bitwig.com/dl/Bitwig%20Studio/6.0.5/release_notes/',
      }),
      /metadata/,
    );
    const manifestPath = join(root, '6.0.6', 'release-notes', 'manifest.json');
    await writeFile(manifestPath, JSON.stringify({ ...cached.manifest, fileName: '../../outside.html' }));
    await assert.rejects(readCachedDocument(root, request), /manifest is invalid/);
    await writeFile(manifestPath, JSON.stringify(cached.manifest));
    await writeFile(cached.path, 'corrupt');
    await assert.rejects(readCachedDocument(root, request), /hash/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('6b legacy guide cannot claim exact product compatibility', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ghostnote-6b-cache-'));
  const guide = generalGuide53('6.0.6');
  try {
    assert.equal(guide.documentVersion, '5.3');
    assert.equal(guide.compatibility, 'general-workflow-only');
    await assert.rejects(
      cacheOfficialDocument(
        root,
        { ...guide, compatibility: 'exact', minimumBytes: 1 },
        response('%PDF-test', guide.sourceUrl, 'application/pdf'),
      ),
      /exact document must match/,
    );
    await assert.rejects(
      cacheOfficialDocument(
        root,
        { ...guide, minimumBytes: 1 },
        response('not a PDF', guide.sourceUrl, 'application/pdf'),
      ),
      /not a PDF/,
    );
    assert.equal(
      installedVersion(
        '<key>CFBundleShortVersionString</key>\n<string>6.0.6</string>',
      ),
      '6.0.6',
    );
    assert.throws(() => installedVersion('<plist/>'), /cannot read/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
