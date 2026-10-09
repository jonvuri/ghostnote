/**
 * Seal the explicit overlay claims of an edit proposal (8i4, D45).
 *
 * R22 needs a dependency basis on each current claim. The model reference tells
 * the author to use the supplied utility; in `agent-native-v1` the edit tool is
 * that utility. The input rule is a host rule, not a grammar change:
 *
 *   - A current claim without `basis` (an `OVERLAY_PUT`, or an `OVERLAY` of a
 *     desired document) is an explicit claim. The tool computes its basis
 *     against the proposed state after the note changes of the same call.
 *   - A supplied basis on an explicit claim must match that state. A mismatch
 *     refuses with R22 and the expected basis in `detail`.
 *   - A retained claim (a desired claim equal to the stored claim) and a stale
 *     claim are never sealed. The codec lifecycle and its R22 check stay.
 *
 * The basis omits the basis of each overlay dependency (R22), so the order of
 * sealing does not change a value. The seal still goes in dependency order and
 * checks the references of each claim first (R21).
 */
import {
  DocumentError, applyPatch, contentHash, validate,
  type Document, type Encoding, type Overlay, type StateDocument,
} from '../document/index.js';
import { readFields } from '../document/fields.js';
import { canonicalJson, cloneJson, decodeInput, readJson } from '../document/json.js';
import { basisFromIndex, checkReferences, indexState, overlayOrder } from '../document/semantic.js';

/** The overlay claims that the tool must seal. Empty for a proposal with no claim to seal. */
export interface SealRequest {
  /** IDs of current claims sent without basis. */
  readonly omitted: ReadonlySet<string>;
  /** IDs of claims sent as current. In a desired document the parse saw them as stale, so it did not check R22. */
  readonly current: ReadonlySet<string>;
}

export const NO_SEAL: SealRequest = { omitted: new Set(), current: new Set() };

/** A placeholder that only the parse sees. The seal replaces it or the proposal refuses. */
const PLACEHOLDER = '0'.repeat(64);

export class SealRefusal extends Error {
  constructor(message: string, readonly detail: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = 'SealRefusal';
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Mark the claims to seal in the raw value, before the codec validates it. */
function prepare(value: unknown): SealRequest {
  if (!isObject(value)) return NO_SEAL;
  const claims = value['kind'] === 'patch' ? value['overlayPut'] : value['kind'] === 'desired' ? value['overlays'] : undefined;
  if (!Array.isArray(claims)) return NO_SEAL;
  const omitted = new Set<string>();
  const current = new Set<string>();
  for (const claim of claims) {
    if (!isObject(claim) || claim['state'] !== 'current' || typeof claim['id'] !== 'string') continue;
    if (!Object.hasOwn(claim, 'basis')) {
      claim['basis'] = PLACEHOLDER;
      omitted.add(claim['id']);
    }
    current.add(claim['id']);
    if (value['kind'] === 'desired') claim['state'] = 'stale';
  }
  return { omitted, current };
}

/**
 * The codec `parse`, with the R22 basis optional on each current claim. The result has a placeholder basis on each
 * omitted claim, and a desired document has its current claims as stale: pass both to `sealProposal`.
 */
export function parseSealable(input: string, encoding: Encoding): { document: Document; seal: SealRequest } {
  const text = decodeInput(input);
  if (encoding !== 'fields' && encoding !== 'json') throw new DocumentError('R29', '$encoding', 'unknown encoding');
  const source = encoding === 'fields' ? readFields(text) : readJson(text);
  const seal = prepare(source.value);
  try {
    return { document: validate(source.value), seal };
  } catch (error) {
    if (!(error instanceof DocumentError) || error.line !== undefined) throw error;
    // As `parse`: name the line of the nearest path that the source located.
    let path = error.path;
    while (!source.locations.has(path) && path !== '$') path = path.replace(/(?:\.[^.[\]]+|\[\d+\])$/, '');
    const reason = error.message.slice(error.message.indexOf(': ') + 2);
    if (encoding === 'fields') {
      const located = (source.locations as Map<string, { line: number; column: number }>);
      throw new DocumentError(error.rule, error.path, reason, located.get(path) ?? located.get('$'));
    }
    const offset = (source.locations as Map<string, number>).get(path) ?? 0;
    const prefix = text.slice(0, offset);
    throw new DocumentError(error.rule, error.path, reason,
      { line: prefix.split('\n').length, column: offset - prefix.lastIndexOf('\n') });
  }
}

/** The state after the event and clip changes of a patch. Overlays are not applied. */
function patchedNotes(base: StateDocument, patch: Extract<Document, { kind: 'patch' }>): StateDocument {
  const bare = { ...base, overlays: [] } as StateDocument;
  return applyPatch(bare, { ...patch, base: { sha256: contentHash(bare) }, overlayPut: [], overlayRemove: [] }).document;
}

/**
 * Seal the explicit claims of a parsed proposal. `base` is the full normalized base of a guarded edit; it is
 * undefined for a replacement, which has no stored claim. Returns a copy with every placeholder replaced and each
 * desired claim at its sent state; the copy is not validated again.
 */
export function sealProposal(proposal: Document, request: SealRequest, base: StateDocument | undefined): Document {
  if (request.omitted.size === 0 && request.current.size === 0) return proposal;
  const sealed = cloneJson(proposal) as Document;
  let claims: Overlay[];
  let state: StateDocument;
  if (sealed.kind === 'patch') {
    // A replacement takes only a desired document; its own check refuses a patch.
    if (base === undefined) return proposal;
    claims = sealed.overlayPut;
    const put = new Set(claims.map((claim) => claim.id));
    const removed = new Set(sealed.overlayRemove);
    const kept = base.overlays.filter((claim) => !put.has(claim.id) && !removed.has(claim.id));
    state = { ...patchedNotes(base, sealed), overlays: [...kept, ...claims] };
  } else {
    if (sealed.kind !== 'desired') return proposal;
    for (const claim of sealed.overlays) if (request.current.has(claim.id)) claim.state = 'current';
    const stored = new Map((base?.overlays ?? []).map((claim) => [claim.id, canonicalJson(claim)]));
    claims = sealed.overlays.filter((claim) => request.omitted.has(claim.id)
      || stored.get(claim.id) !== canonicalJson(claim));
    state = sealed;
  }
  const explicit = new Set(claims.map((claim) => claim.id));
  const index = indexState(state);
  const field = sealed.kind === 'patch' ? 'overlayPut' : 'overlays';
  const positions = new Map((sealed.kind === 'patch' ? sealed.overlayPut : sealed.overlays).map((claim, at) => [claim.id, at]));
  for (const claim of overlayOrder(state.overlays)) {
    if (!explicit.has(claim.id) || claim.state !== 'current') continue;
    const path = `$.${field}[${positions.get(claim.id)}]`;
    checkReferences(index, claim, path);
    const expected = basisFromIndex(index, claim);
    if (request.omitted.has(claim.id)) {
      claim.basis = expected;
    } else if (claim.basis !== expected) {
      throw new SealRefusal(`The basis of claim ${claim.id} does not match its dependencies after this edit. `
        + 'Check its depends list, or omit basis: the tool computes it.', {
        rule: 'R22', path: `${path}.basis`, overlay: claim.id, expectedBasis: expected });
    }
  }
  // The codec validates the sealed proposal again when it applies it (`applyPatchTo`, `applyDesiredTo`).
  return sealed;
}
