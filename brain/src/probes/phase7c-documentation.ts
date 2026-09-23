/** Phase 7c module-only dogfood for version-bound offline documentation. */
import {
  DOCUMENTATION_MODULE_ID, DOCUMENTATION_REQUEST_SCHEMA, documentationModule,
  openDocumentationSource, type DocumentationCompatibilityRequirement,
  type DocumentationFamily, type DocumentationQuery, type DocumentationResult,
  type DocumentationSourceMode,
} from '../documentation/index.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WorkstationModuleRegistry,
} from '../workstation/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
}

const family = required('--family') as DocumentationFamily;
if (!['api', 'workflow', 'device'].includes(family)) {
  throw new Error('--family must be api, workflow, or device');
}
const compatibility = (argument('--compatibility') ?? 'exact') as DocumentationCompatibilityRequirement;
if (!['exact', 'general-workflow-allowed'].includes(compatibility)) {
  throw new Error('--compatibility must be exact or general-workflow-allowed');
}
const productVersion = required('--product-version');
const repositoryRoot = required('--repository-root');
const sourceMode = (argument('--source-mode') ?? 'automatic') as DocumentationSourceMode;
if (!['automatic', 'offline'].includes(sourceMode)) {
  throw new Error('--source-mode must be automatic or offline');
}
const sourceStarted = performance.now();
const source = await openDocumentationSource({
  bitwigAppRoot: required('--bitwig-app-root'),
  cacheRoot: required('--cache-root'),
  repositoryRoot,
  mode: sourceMode,
}, { productVersion, family });
const sourceOpenMs = performance.now() - sourceStarted;
const query: DocumentationQuery = {
  schema: DOCUMENTATION_REQUEST_SCHEMA,
  source,
  family,
  productVersion,
  compatibility,
  query: required('--query'),
  limit: Number(argument('--limit') ?? '5'),
};
const timingEvents: { phase: string; elapsedMs: number }[] = [];
const registry = new WorkstationModuleRegistry();
registry.register(documentationModule({
  indexRoot: required('--index-root'),
  repositoryRoot,
  onTiming: (event) => timingEvents.push(event),
}));

const run = async (requestId: string): Promise<{
  readonly elapsedMs: number;
  readonly result: DocumentationResult;
  readonly phases: readonly { phase: string; elapsedMs: number }[];
}> => {
  const started = performance.now();
  const response = await registry.request<DocumentationQuery, DocumentationResult>(
    DOCUMENTATION_MODULE_ID,
    {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId,
      inputSchema: DOCUMENTATION_REQUEST_SCHEMA,
      sourceSha256: source.digest.value,
      payload: query,
    },
  );
  return {
    elapsedMs: performance.now() - started,
    result: response.payload,
    phases: timingEvents.splice(0),
  };
};

const cold = await run('phase7c-documentation-cold');
const warm = await run('phase7c-documentation-warm');
if (JSON.stringify(cold.result.hits.map((hit) => hit.recordId))
    !== JSON.stringify(warm.result.hits.map((hit) => hit.recordId))) {
  throw new Error('cold and warm documentation rankings differ');
}

console.log(JSON.stringify({
  schema: 'ghostnote-phase7c-run-v0',
  mode: 'module-only',
  permissions: sourceMode === 'automatic'
    ? ['read installed documentation', 'read and populate verified cache', 'network for a missing guide', 'no project write']
    : ['read installed documentation', 'read verified offline cache', 'no network', 'no project write'],
  enabledModules: registry.discover(),
  input: {
    family,
    productVersion,
    compatibility,
    sourceMode,
    query: query.query,
    limit: query.limit,
  },
  source: {
    sha256: source.digest.value,
    digestDomain: source.digest.domain,
    sources: source.sources.map((item) => ({
      sourceId: item.sourceId,
      productVersion: item.productVersion,
      documentVersion: item.documentVersion,
      compatibility: item.compatibility,
      manifestSha256: item.manifestSha256,
      sourceSha256: item.sourceSha256,
      bytes: item.byteCount,
      files: item.files.length,
    })),
    unavailableSourceIds: source.unavailableSourceIds,
  },
  timingMs: {
    sourceOpen: sourceOpenMs,
    download: source.downloadMs,
    sourceValidation: source.validationMs,
    cold: cold.elapsedMs,
    warm: warm.elapsedMs,
  },
  coldPhases: cold.phases,
  warmPhases: warm.phases,
  coldResult: cold.result,
  warmResult: warm.result,
  effects: 'none',
}, null, 2));
