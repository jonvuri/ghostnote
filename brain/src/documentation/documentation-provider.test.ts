import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, truncate, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  DOCUMENTATION_MODULE_ID, DOCUMENTATION_REQUEST_SCHEMA, DocumentationError,
  documentationModule, openDocumentationSource, queryDocumentation,
  type DocumentationProviderOptions, type DocumentationQuery,
  type DocumentationSourceOptions, type GuideExtractor,
} from './documentation-provider.js';
import {
  cacheOfficialDocument, exactReleaseNotes, generalGuide53, type DocumentFetch,
  type OfficialDocumentRequest,
} from '../probes/phase6b-document-cache-lib.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WorkstationModuleError, WorkstationModuleRegistry,
} from '../workstation/index.js';

interface Fixture {
  readonly root: string;
  readonly appRoot: string;
  readonly cacheRoot: string;
  readonly indexRoot: string;
  readonly repositoryRoot: string;
  readonly releaseRequest: OfficialDocumentRequest;
  readonly guideRequest: OfficialDocumentRequest;
  readonly sourceOptions: DocumentationSourceOptions;
  readonly providerOptions: DocumentationProviderOptions;
}

function response(body: string, url: string, mediaType: string): DocumentFetch {
  return async () => ({
    ok: true,
    status: 200,
    url,
    headers: { get: (name) => name.toLowerCase() === 'content-type' ? mediaType : null },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  });
}

const guideExtractor: GuideExtractor = {
  name: 'fixture-pdf-text',
  version: async () => '1',
  extract: async (bytes) => {
    assert.match(new TextDecoder().decode(bytes), /GUIDE53/);
    return 'Master recordings are stored in the project recordings directory.\f'
      + 'General workflow for selecting a launcher clip.';
  },
};

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'ghostnote-7c-'));
  const appRoot = join(root, 'Bitwig Studio.app');
  const cacheRoot = join(root, 'cache');
  const indexRoot = join(root, 'indexes');
  const repositoryRoot = join(root, 'repository');
  const apiRoot = join(
    appRoot, 'Contents', 'Resources', 'Documentation', 'control-surface', 'api', 'com', 'bitwig',
    'extension', 'controller', 'api',
  );
  const localization = join(appRoot, 'Contents', 'Resources', 'localization');
  await Promise.all([
    mkdir(apiRoot, { recursive: true }),
    mkdir(localization, { recursive: true }),
    mkdir(repositoryRoot, { recursive: true }),
  ]);
  await writeFile(
    join(appRoot, 'Contents', 'Info.plist'),
    '<plist><key>CFBundleShortVersionString</key><string>6.0.6</string></plist>',
  );
  await writeFile(join(apiRoot, 'MasterRecorder.html'), `
    <html><head><title>MasterRecorder</title><style>hidden</style></head><body>
    <h1>MasterRecorder</h1><p>Controls the project master recording.</p>
    <p>start starts recording, stop stops recording, isActive reports active state,
    and duration reports milliseconds.</p><p>API version 25</p></body></html>
  `);
  await writeFile(join(apiRoot, 'Transport.html'), `
    <html><body><h1>Transport</h1><p>Controls playback.</p><p>API version 25</p></body></html>
  `);
  await writeFile(
    join(localization, 'Device-descriptions-resources.properties'),
    'device.de-esser.name=De-Esser\ndevice.de-esser.description=Reduces harsh ess sounds in vocals.\n'
      + 'device.dynamics.name=Dynamics\ndevice.dynamics.description=Compression and expansion with sidechain.\n',
  );
  await writeFile(
    join(localization, 'Modulator-descriptions-resources.properties'),
    'modulator.lfo.name=LFO\nmodulator.lfo.description=Cycles a modulation signal.\n',
  );
  await writeFile(
    join(localization, 'Module-descriptions-resources.properties'),
    'module.by_scale.name=By Scale\nmodule.by_scale.description=Moves a signal to the nearest project key pitch.\n',
  );

  const releaseRequest = { ...exactReleaseNotes('6.0.6'), minimumBytes: 1 };
  const guideRequest = { ...generalGuide53('6.0.6'), minimumBytes: 1 };
  await cacheOfficialDocument(
    cacheRoot,
    releaseRequest,
    response(
      '<h1>Changes in Bitwig Studio 6.0.6</h1><p>Alias clips share musical content edits.</p>'
      + '<h2>Key Signature Support</h2><p>The project tonic and scale define its key.</p>',
      'https://downloads-secure.bitwig.com/6.0.6/release-notes.html',
      'text/html',
    ),
  );
  await cacheOfficialDocument(
    cacheRoot,
    guideRequest,
    response(
      '%PDF-GUIDE53',
      guideRequest.sourceUrl,
      'application/pdf',
    ),
  );
  const sourceOptions = {
    bitwigAppRoot: appRoot,
    cacheRoot,
    repositoryRoot,
    releaseNotesRequest: releaseRequest,
    guideRequest,
  };
  const providerOptions = { indexRoot, repositoryRoot, guideExtractor };
  return {
    root, appRoot, cacheRoot, indexRoot, repositoryRoot,
    releaseRequest, guideRequest, sourceOptions, providerOptions,
  };
}

function query(
  source: Awaited<ReturnType<typeof openDocumentationSource>>,
  text: string,
  compatibility: DocumentationQuery['compatibility'] = 'exact',
): DocumentationQuery {
  return {
    schema: DOCUMENTATION_REQUEST_SCHEMA,
    source,
    family: source.family,
    productVersion: source.productVersion,
    compatibility,
    query: text,
    limit: 5,
  };
}

test('7c-S14/S17: routed FTS5 returns complete cited API and device records', async () => {
  const setup = await fixture();
  try {
    const api = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'api' },
    );
    const registry = new WorkstationModuleRegistry();
    registry.register(documentationModule(setup.providerOptions));
    assert.equal(registry.discover()[0]?.state, 'uninitialized');
    const payload = query(api, 'Which object starts and stops master recording?');
    const first = await registry.request<DocumentationQuery, Awaited<ReturnType<typeof queryDocumentation>>>(
      DOCUMENTATION_MODULE_ID,
      {
        schema: WORKSTATION_REQUEST_SCHEMA,
        requestId: 'api-cold',
        inputSchema: DOCUMENTATION_REQUEST_SCHEMA,
        sourceSha256: api.digest.value,
        payload,
      },
    );
    assert.equal(first.payload.hits[0]?.title, 'MasterRecorder');
    assert.equal(first.payload.hits[0]?.source.productVersion, '6.0.6');
    assert.equal(first.payload.hits[0]?.source.documentVersion, 'API 25');
    assert.equal(first.payload.hits[0]?.source.compatibility, 'exact');
    assert.equal(first.payload.hits[0]?.source.locator.kind, 'installed-path');
    assert.equal(first.payload.hits[0]?.extractor.name, 'html-visible-text');
    assert.equal(first.payload.hits[0]?.rank, 1);
    assert.equal(first.payload.hits[0]?.index.tokenizer, 'porter unicode61');
    assert.equal(first.payload.coverage.complete, true);
    assert.ok(first.payload.timingMs.indexBuild >= 0);
    assert.equal(registry.discover()[0]?.state, 'available');

    const warm = await registry.request<DocumentationQuery, Awaited<ReturnType<typeof queryDocumentation>>>(
      DOCUMENTATION_MODULE_ID,
      {
        schema: WORKSTATION_REQUEST_SCHEMA,
        requestId: 'api-warm',
        inputSchema: DOCUMENTATION_REQUEST_SCHEMA,
        sourceSha256: api.digest.value,
        payload,
      },
    );
    assert.equal(warm.payload.timingMs.extraction, 0);
    assert.equal(warm.payload.timingMs.indexBuild, 0);
    assert.deepEqual(warm.payload.hits.map((hit) => hit.recordId), first.payload.hits.map((hit) => hit.recordId));

    const device = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'device' },
    );
    const deviceResult = await queryDocumentation(
      setup.providerOptions, query(device, 'Which effect reduces harsh ess sounds in vocals?'),
    );
    assert.equal(deviceResult.hits[0]?.source.locator.value, 'device.de-esser');
    assert.equal(deviceResult.hits[0]?.source.locator.kind, 'property-key');

    const workflow = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'workflow' },
    );
    const workflowResult = await queryDocumentation(
      setup.providerOptions,
      query(workflow, 'Where are master recordings stored?', 'general-workflow-allowed'),
    );
    assert.equal(workflowResult.hits[0]?.source.sourceId, 'user-guide-5-3-en');
    assert.equal(workflowResult.hits[0]?.source.documentVersion, '5.3');
    assert.equal(workflowResult.hits[0]?.source.compatibility, 'general-workflow-only');
    assert.equal(workflowResult.hits[0]?.source.locator.kind, 'pdf-page');
    assert.equal(workflowResult.hits[0]?.extractor.name, 'fixture-pdf-text');
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('7c-S14: exact claims refuse a 5.3-only source and no-match stays available', async () => {
  const setup = await fixture();
  try {
    await unlink(join(setup.cacheRoot, '6.0.6', 'release-notes', 'manifest.json'));
    const workflow = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'workflow' },
    );
    await assert.rejects(
      queryDocumentation(setup.providerOptions, query(workflow, 'new version behavior', 'exact')),
      (error) => error instanceof DocumentationError && error.code === 'incompatible-source',
    );

    const api = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'api' },
    );
    const none = await queryDocumentation(setup.providerOptions, query(api, 'xyzzynothing'));
    assert.deepEqual(none.hits, []);
    assert.equal(none.coverage.noMatch, true);
    assert.equal(none.coverage.complete, true);
    assert.equal(none.source.sha256, api.digest.value);
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('7c-R3: extraction consumes verified bytes and a later corrupt open refuses', async () => {
  const setup = await fixture();
  try {
    const workflow = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'workflow' },
    );
    const release = workflow.sources.find((source) => source.sourceId === 'release-notes')!;
    const path = join(setup.cacheRoot, '6.0.6', 'release-notes', release.files[0]!.relativePath);
    await writeFile(path, 'corrupt after the verified open');

    const result = await queryDocumentation(
      setup.providerOptions, query(workflow, 'Alias clips share musical content edits'),
    );
    assert.equal(result.hits[0]?.source.sourceId, 'release-notes');
    await assert.rejects(
      openDocumentationSource(setup.sourceOptions, { productVersion: '6.0.6', family: 'workflow' }),
      (error) => error instanceof DocumentationError && error.code === 'corrupt-source',
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('7c-S14: stale metadata, records, search rows, FTS data, and size fail closed', async () => {
  const setup = await fixture();
  try {
    const api = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'api' },
    );
    const first = await queryDocumentation(setup.providerOptions, query(api, 'master recording active'));
    const identity = first.hits[0]!.index.identitySha256;
    const path = join(setup.indexRoot, '6.0.6', 'api', `${identity}.sqlite`);
    const database = new DatabaseSync(path);
    database.prepare("UPDATE metadata SET value = 'changed' WHERE key = 'tokenizer'").run();
    database.close();
    await assert.rejects(
      queryDocumentation(setup.providerOptions, query(api, 'master recording active')),
      (error) => error instanceof DocumentationError && error.code === 'stale-index',
    );

    await unlink(path);
    await queryDocumentation(setup.providerOptions, query(api, 'master recording active'));
    const changedRecord = new DatabaseSync(path);
    changedRecord.prepare("UPDATE records SET content = 'changed' WHERE record_id LIKE '%MasterRecorder.html'").run();
    changedRecord.close();
    await assert.rejects(
      queryDocumentation(setup.providerOptions, query(api, 'master recording active')),
      (error) => error instanceof DocumentationError && error.code === 'stale-index',
    );

    await unlink(path);
    await queryDocumentation(setup.providerOptions, query(api, 'master recording active'));
    const changedSearch = new DatabaseSync(path);
    changedSearch.prepare("UPDATE docs SET content = 'changed' WHERE rowid = 1").run();
    changedSearch.close();
    await assert.rejects(
      queryDocumentation(setup.providerOptions, query(api, 'master recording active')),
      (error) => error instanceof DocumentationError && error.code === 'stale-index',
    );

    await unlink(path);
    await queryDocumentation(setup.providerOptions, query(api, 'master recording active'));
    const changedFts = new DatabaseSync(path);
    changedFts.prepare(`
      UPDATE docs_data SET block = zeroblob(length(block))
      WHERE id = (SELECT max(id) FROM docs_data)
    `).run();
    changedFts.close();
    await assert.rejects(
      queryDocumentation(setup.providerOptions, query(api, 'master recording active')),
      (error) => error instanceof DocumentationError && error.code === 'stale-index',
    );

    await truncate(path, 512 * 1_024 * 1_024 + 1);
    await assert.rejects(
      queryDocumentation(setup.providerOptions, query(api, 'master recording active')),
      (error) => error instanceof DocumentationError && error.code === 'stale-index',
    );

    await rm(join(setup.appRoot, 'Contents', 'Resources', 'Documentation'), { recursive: true });
    await assert.rejects(
      openDocumentationSource(setup.sourceOptions, { productVersion: '6.0.6', family: 'api' }),
      (error) => error instanceof DocumentationError && error.code === 'source-unavailable',
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('7c-S17: missing PDF extraction does not disable installed API lookup', async () => {
  const setup = await fixture();
  const missingExtractor: GuideExtractor = {
    name: 'missing-pdf-extractor',
    version: async () => { throw new Error('fixture extractor is absent'); },
    extract: async () => assert.fail('the missing extractor must not run'),
  };
  const providerOptions = { ...setup.providerOptions, guideExtractor: missingExtractor };
  try {
    const workflow = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'workflow' },
    );
    await assert.rejects(
      queryDocumentation(providerOptions, query(workflow, 'master recordings directory', 'general-workflow-allowed')),
      (error) => error instanceof DocumentationError && error.code === 'missing-dependency',
    );

    const api = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'api' },
    );
    const registry = new WorkstationModuleRegistry();
    registry.register(documentationModule(providerOptions));
    const result = await registry.request<DocumentationQuery, Awaited<ReturnType<typeof queryDocumentation>>>(
      DOCUMENTATION_MODULE_ID,
      {
        schema: WORKSTATION_REQUEST_SCHEMA,
        requestId: 'api-without-pdf',
        inputSchema: DOCUMENTATION_REQUEST_SCHEMA,
        sourceSha256: api.digest.value,
        payload: query(api, 'master recording duration milliseconds'),
      },
    );
    assert.equal(result.payload.hits[0]?.title, 'MasterRecorder');
    assert.equal(registry.discover()[0]?.state, 'available');
    await assert.rejects(
      registry.request(
        DOCUMENTATION_MODULE_ID,
        {
          schema: WORKSTATION_REQUEST_SCHEMA,
          requestId: 'mismatched-source',
          inputSchema: DOCUMENTATION_REQUEST_SCHEMA,
          sourceSha256: 'f'.repeat(64),
          payload: query(api, 'master recording'),
        },
      ),
      (error) => error instanceof WorkstationModuleError && error.code === 'source-mismatch',
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('7c boundary keeps caches and indexes outside the repository', async () => {
  const setup = await fixture();
  try {
    await assert.rejects(
      openDocumentationSource(
        { ...setup.sourceOptions, cacheRoot: join(setup.repositoryRoot, 'cache') },
        { productVersion: '6.0.6', family: 'api' },
      ),
      (error) => error instanceof DocumentationError && error.code === 'invalid-request',
    );
    const api = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'api' },
    );
    await assert.rejects(
      queryDocumentation(
        { ...setup.providerOptions, indexRoot: join(setup.repositoryRoot, 'index') },
        query(api, 'master recording'),
      ),
      (error) => error instanceof DocumentationError && error.code === 'invalid-request',
    );
    const linkedRepository = join(setup.root, 'linked-repository');
    await symlink(setup.repositoryRoot, linkedRepository);
    await assert.rejects(
      queryDocumentation(
        { ...setup.providerOptions, indexRoot: join(linkedRepository, 'index') },
        query(api, 'master recording'),
      ),
      (error) => error instanceof DocumentationError && error.code === 'invalid-request',
    );

    const descendantIndexRoot = join(setup.root, 'descendant-index');
    await mkdir(descendantIndexRoot);
    await symlink(setup.repositoryRoot, join(descendantIndexRoot, '6.0.6'));
    await assert.rejects(
      queryDocumentation(
        { ...setup.providerOptions, indexRoot: descendantIndexRoot },
        query(api, 'master recording'),
      ),
      (error) => error instanceof DocumentationError && error.code === 'invalid-request',
    );

    const descendantCacheRoot = join(setup.root, 'descendant-cache');
    await mkdir(descendantCacheRoot);
    await symlink(setup.repositoryRoot, join(descendantCacheRoot, '6.0.6'));
    await assert.rejects(
      openDocumentationSource(
        { ...setup.sourceOptions, cacheRoot: descendantCacheRoot },
        { productVersion: '6.0.6', family: 'workflow' },
      ),
      (error) => error instanceof DocumentationError && error.code === 'invalid-request',
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('7c-R3: extractor identity changes rebuild and a hung guide request fails closed', async () => {
  const setup = await fixture();
  try {
    const workflow = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'workflow' },
    );
    const request = query(workflow, 'Where are master recordings stored?', 'general-workflow-allowed');
    const first = await queryDocumentation(setup.providerOptions, request);
    const changedExtractor: GuideExtractor = {
      ...guideExtractor,
      version: async () => '2',
    };
    const changed = await queryDocumentation(
      { ...setup.providerOptions, guideExtractor: changedExtractor }, request,
    );
    assert.notEqual(
      changed.hits[0]?.index.identitySha256,
      first.hits[0]?.index.identitySha256,
    );
    assert.equal(changed.hits[0]?.extractor.version, '2');

    const hungExtractor: GuideExtractor = {
      name: 'hung-guide',
      version: async () => '1',
      extract: async () => new Promise<string>(() => {}),
    };
    await assert.rejects(
      queryDocumentation(
        { ...setup.providerOptions, guideExtractor: hungExtractor, guideTimeoutMs: 5 }, request,
      ),
      (error) => error instanceof DocumentationError && error.code === 'corrupt-source',
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('7c guide extraction rejection is a corrupt source, not a missing dependency', async () => {
  const setup = await fixture();
  const rejectingExtractor: GuideExtractor = {
    name: 'rejecting-guide',
    version: async () => '1',
    extract: async () => { throw new Error('the PDF content is malformed'); },
  };
  try {
    const workflow = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'workflow' },
    );
    await assert.rejects(
      queryDocumentation(
        { ...setup.providerOptions, guideExtractor: rejectingExtractor },
        query(workflow, 'master recordings directory', 'general-workflow-allowed'),
      ),
      (error) => error instanceof DocumentationError && error.code === 'corrupt-source',
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('7c source scan refuses aggregate size before reading installed bytes', async () => {
  const setup = await fixture();
  try {
    const huge = join(
      setup.appRoot, 'Contents', 'Resources', 'Documentation', 'control-surface', 'api',
      'com', 'bitwig', 'extension', 'controller', 'api', 'Huge.html',
    );
    await writeFile(huge, '');
    await truncate(huge, 96 * 1_024 * 1_024 + 1);
    await assert.rejects(
      openDocumentationSource(setup.sourceOptions, { productVersion: '6.0.6', family: 'api' }),
      (error) => error instanceof DocumentationError && error.code === 'corrupt-source',
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('7c request preflight refuses repeated supplied files before copying them', async () => {
  const setup = await fixture();
  try {
    const api = await openDocumentationSource(
      setup.sourceOptions, { productVersion: '6.0.6', family: 'api' },
    );
    const entry = api.sources[0]!;
    const file = entry.files[0]!;
    const repeatedSource = {
      ...api,
      sources: [{
        ...entry,
        byteCount: file.bytes * 4_097,
        files: Array.from({ length: 4_097 }, () => file),
      }],
    };
    await assert.rejects(
      queryDocumentation(
        setup.providerOptions,
        { ...query(api, 'master recording'), source: repeatedSource },
      ),
      (error) => error instanceof DocumentationError && error.code === 'corrupt-source',
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});
