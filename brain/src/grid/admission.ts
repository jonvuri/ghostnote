/**
 * The product Grid admission gate (9b.7, D52).
 *
 * The Grid path uses obfuscated Bitwig symbols. A build is admitted for native Grid writes only after the
 * consent-gated doctor passed on its exact jar fingerprint (SHA-256, byte size, modification time) and wrote an
 * accepted cache record (E316 on 6.0.6, E342 on 6.1.4). This module reads that cache. It never writes it: the
 * research driver on the probe profile is the only writer, and one pass per fingerprint is the rule.
 *
 * ⚠ Every product Grid write path must call `requireGridWriteAdmission` before its first host call. The
 * `agent-native-v1` profile has no Grid write tool yet; `check_grid_support` reports this gate so an agent can
 * learn the standing before it asks for Grid work. The jar is hashed locally: the brain and Bitwig run on the
 * same machine (the bridge is loopback), and the host version from the handshake is compared with the record.
 * That cross-check does not prove that the running host loaded this jar; a second install with the same version
 * is a stated limit.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const GRID_ADMISSION_VERSION = 'grid-admission-v1';
/** The jar of the default macOS install. `GHOSTNOTE_BITWIG_JAR` overrides it. */
export const DEFAULT_BITWIG_JAR = '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar';
/** The research cache directory. `GHOSTNOTE_GRID_DOCTOR_CACHE` overrides it. */
export const DEFAULT_CACHE_DIRECTORY = join(import.meta.dirname, '../../../.local/grid-doctor');
/**
 * The fixed doctor scope: the 69 resolver roles and the seven document Undo roles (E316, E342). An accepted record
 * must cover every one of them; a count alone would admit a record of unrelated names.
 */
export const DOCTOR_ROLES: readonly string[] = [
  'associate-edit', 'associated-edit', 'begin', 'boolean-command', 'cable-source-getter', 'cable-source-setter',
  'child-count', 'child-read', 'class-id', 'close', 'connected-state', 'connection', 'context',
  'current-document-edit', 'current-journal-edit', 'descriptor', 'display-key', 'display-map', 'disposal',
  'disposed-flag', 'document', 'document-manager', 'document-undo-enabled', 'domain-extent', 'enabled-field',
  'engine-state', 'filter-instance', 'focus', 'focus-target', 'frame-stack', 'height', 'hidden-count',
  'inactive-state', 'initialization-helper', 'insert-body', 'insert-label', 'instance-uuid', 'instant-edits',
  'journal-active', 'journal-map', 'journal-recording-edit', 'journal-replay-head', 'lock-count', 'lock-set',
  'long-edits', 'managed-id', 'manager', 'members', 'module-delete', 'module-factory', 'module-parent',
  'module-parent-2', 'name', 'native-value-setter', 'owned-children', 'owner', 'properties', 'property-id',
  'recording', 'registered-lookup', 'remote-helper', 'remove-mapping', 'replay-flag', 'replaying-flag',
  'restore-mapping', 'scalar-read', 'selected-modules', 'selection-state', 'serialization-filter',
  'target-domain', 'undo-available', 'undo-command', 'undo-head', 'width', 'x', 'y',
];
export const DOCTOR_ROLE_COUNT = DOCTOR_ROLES.length;
const MAX_JAR_BYTES = 64 * 1024 * 1024;
const MAX_RECORD_BYTES = 1024 * 1024;

export interface JarFingerprint {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  /** Nanoseconds as text: the value exceeds a safe integer. */
  readonly mtimeNs: string;
  /** `sha256:bytes:mtimeNs`, the key of the doctor records. */
  readonly fingerprint: string;
  /** SHA-256 of the fingerprint text: the cache file stem. */
  readonly key: string;
}

export interface AcceptedCacheSummary {
  readonly file: string;
  readonly completed: string;
  readonly hostVersion: string;
  readonly selectorSha256: string;
  readonly guardsSha256: string | null;
  readonly marker: string | null;
  readonly cases: number;
  readonly roles: number;
  readonly evidence: string | null;
}

export type GridAdmissionRefusal =
  | 'jar-unreadable' | 'no-cached-pass' | 'cache-unreadable' | 'cache-invalid' | 'host-version-differs';

export type GridAdmission =
  | { readonly verdict: 'admitted'; readonly jar: JarFingerprint; readonly hostVersion: string | null;
      readonly cache: AcceptedCacheSummary }
  | { readonly verdict: 'refused'; readonly reason: GridAdmissionRefusal; readonly detail: string;
      readonly jar: JarFingerprint | null; readonly hostVersion: string | null; readonly file: string | null };

export interface GridAdmissionOptions {
  /** The jar of the running host. Defaults to `GHOSTNOTE_BITWIG_JAR`, then the default install. */
  readonly jarPath?: string;
  /** Defaults to `GHOSTNOTE_GRID_DOCTOR_CACHE`, then the research cache. */
  readonly cacheDirectory?: string;
  /** The host version from the handshake. `null` when the adapter has no host (the fake). */
  readonly hostVersion?: string | null;
}

type Wire = Record<string, unknown>;
const memo = new Map<string, JarFingerprint>();

export const resolveJarPath = (jarPath?: string): string =>
  jarPath ?? process.env['GHOSTNOTE_BITWIG_JAR'] ?? DEFAULT_BITWIG_JAR;
export const resolveCacheDirectory = (directory?: string): string =>
  directory ?? process.env['GHOSTNOTE_GRID_DOCTOR_CACHE'] ?? DEFAULT_CACHE_DIRECTORY;

/** Hash one jar. The hash is kept for the same path, size, and modification time; a changed file is rehashed. */
export function fingerprintJar(path: string): JarFingerprint {
  const real = realpathSync(path);
  const stat = statSync(real, { bigint: true });
  if (!stat.isFile()) throw new Error(`not a file: ${real}`);
  if (stat.size > BigInt(MAX_JAR_BYTES)) throw new Error(`jar over ${MAX_JAR_BYTES} bytes: ${real}`);
  const identity = `${real}:${stat.size}:${stat.mtimeNs}`;
  const cached = memo.get(identity);
  if (cached !== undefined) return cached;
  const sha256 = createHash('sha256').update(readFileSync(real)).digest('hex');
  const fingerprint = `${sha256}:${stat.size}:${stat.mtimeNs}`;
  const result: JarFingerprint = { path: real, sha256, bytes: Number(stat.size), mtimeNs: String(stat.mtimeNs),
    fingerprint, key: createHash('sha256').update(fingerprint).digest('hex') };
  memo.set(identity, result);
  return result;
}

/** The file of the accepted record for one fingerprint, as the research driver names it. */
export const acceptedCacheFile = (directory: string, jar: JarFingerprint): string =>
  join(directory, `${jar.key}.accepted.json`);

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/**
 * Check one accepted record against the fingerprint and the host version. Returns the failing condition, or the
 * summary. Every condition is a fact the driver recorded at the end of a complete pass (E316, E342).
 */
export function validateAcceptedRecord(
  record: unknown, file: string, jar: JarFingerprint, hostVersion: string | null,
): { readonly problem: string } | { readonly cache: AcceptedCacheSummary } {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) return { problem: 'not an object' };
  const r = record as Wire;
  if (r['verdict'] !== 'accepted') return { problem: `verdict is ${JSON.stringify(r['verdict'])}, not accepted` };
  if (r['writeAuthority'] === true) return { problem: 'the record claims write authority; the driver never does' };
  if (r['fingerprint'] !== jar.fingerprint) return { problem: 'the record fingerprint differs from the jar' };
  if (!text(r['hostVersion'])) return { problem: 'hostVersion is missing' };
  if (hostVersion !== null && r['hostVersion'] !== hostVersion) {
    return { problem: `the record is for host ${r['hostVersion']}; the connected host is ${hostVersion}` };
  }
  if (r['baselineVerified'] !== true) return { problem: 'baselineVerified is not true' };
  if (!text(r['completed']) || !text(r['selectorSha256'])) return { problem: 'completed or selectorSha256 is missing' };
  const cases = r['roles'];
  if (!Array.isArray(cases) || cases.length === 0) return { problem: 'no doctor cases' };
  const roles = new Set<string>();
  for (const item of cases) {
    const c = item as Wire;
    if (c['verdict'] !== 'passed' || c['pairedReadback'] !== true) {
      return { problem: `case ${JSON.stringify(c['case'])} did not pass with paired readback` };
    }
    if (!Array.isArray(c['roles']) || c['roles'].length === 0) return { problem: `case ${JSON.stringify(c['case'])} lists no roles` };
    for (const role of c['roles']) {
      if (!text(role)) return { problem: 'a role is not a name' };
      roles.add(role);
    }
  }
  const missing = DOCTOR_ROLES.filter((role) => !roles.has(role));
  if (missing.length > 0) {
    return { problem: `${roles.size} roles passed; the fixed scope misses ${missing.length}: ${missing.slice(0, 5).join(', ')}`
      + (missing.length > 5 ? ', …' : '') };
  }
  const teardown = r['teardown'];
  if (teardown === null || typeof teardown !== 'object') return { problem: 'teardown is missing' };
  const t = teardown as Wire;
  if (t['released'] !== true || t['locked'] !== false || t['nativeUnfinished'] === true
      || (typeof t['failure'] === 'string' && t['failure'].length > 0)) {
    return { problem: 'teardown is not released, is locked, is unfinished, or records a failure' };
  }
  return { cache: {
    file, completed: r['completed'], hostVersion: r['hostVersion'], selectorSha256: r['selectorSha256'],
    guardsSha256: text(r['guardsSha256']) ? r['guardsSha256'] : null, marker: text(r['marker']) ? r['marker'] : null,
    cases: cases.length, roles: roles.size, evidence: text(r['evidence']) ? r['evidence'] : null,
  } };
}

/** Read the gate without a host call. The host version comes from the caller's handshake. */
export function readGridAdmission(options: GridAdmissionOptions = {}): GridAdmission {
  const hostVersion = options.hostVersion ?? null;
  const jarPath = resolveJarPath(options.jarPath);
  let jar: JarFingerprint;
  try {
    jar = fingerprintJar(jarPath);
  } catch (error) {
    return { verdict: 'refused', reason: 'jar-unreadable', jar: null, hostVersion, file: null,
      detail: `${jarPath}: ${error instanceof Error ? error.message : String(error)}` };
  }
  const file = acceptedCacheFile(resolveCacheDirectory(options.cacheDirectory), jar);
  if (!existsSync(file)) {
    return { verdict: 'refused', reason: 'no-cached-pass', jar, hostVersion, file,
      detail: `no accepted doctor record for fingerprint ${jar.fingerprint}` };
  }
  let record: unknown;
  try {
    if (statSync(file).size > MAX_RECORD_BYTES) throw new Error(`record over ${MAX_RECORD_BYTES} bytes`);
    record = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { verdict: 'refused', reason: 'cache-unreadable', jar, hostVersion, file,
      detail: error instanceof Error ? error.message : String(error) };
  }
  const checked = validateAcceptedRecord(record, file, jar, hostVersion);
  if ('problem' in checked) {
    const versionProblem = checked.problem.startsWith('the record is for host');
    return { verdict: 'refused', reason: versionProblem ? 'host-version-differs' : 'cache-invalid', jar, hostVersion,
      file, detail: checked.problem };
  }
  return { verdict: 'admitted', jar, hostVersion, cache: checked.cache };
}

export class GridAdmissionRefusedError extends Error {
  constructor(readonly admission: Extract<GridAdmission, { verdict: 'refused' }>) {
    super(`grid write refused (${admission.reason}): ${admission.detail}`);
    this.name = 'GridAdmissionRefusedError';
  }
}

/** The gate of every product Grid write. It throws before any host call when no accepted pass exists. */
export function requireGridWriteAdmission(options: GridAdmissionOptions = {}): Extract<GridAdmission, { verdict: 'admitted' }> {
  const admission = readGridAdmission(options);
  if (admission.verdict === 'refused') throw new GridAdmissionRefusedError(admission);
  return admission;
}

/** What an operator must do to admit a build. Stated directly (D53); the product does not run the doctor. */
export function admissionNextStep(admission: GridAdmission): string {
  if (admission.verdict === 'admitted') return 'Native Grid writes are admitted on this build.';
  switch (admission.reason) {
    case 'jar-unreadable':
      return 'Set GHOSTNOTE_BITWIG_JAR to the bitwig.jar of the running Bitwig install, then check again.';
    case 'host-version-differs':
      return 'The connected Bitwig is not the install at the jar path. Set GHOSTNOTE_BITWIG_JAR to its bitwig.jar.';
    default:
      return 'Run the offline upgrade check (grid_doctor.upgrade), then one consent-gated doctor pass on the probe '
        + 'profile for this fingerprint. The operator saves first and approves the scratch test (D52, D53).';
  }
}
