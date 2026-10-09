/**
 * Ghostnote Document 1.0 format help for `agent-native-v1` (8i6).
 *
 * One source: `MODEL-REFERENCE.md` and its identity file. This module selects
 * the reference sections, derives the templates from the reference examples,
 * and checks each template with the codec when it loads. The descriptions,
 * `get_document_reference`, and the repair guidance of a refused document
 * input use these values only.
 *
 * Help is pure: it makes no host call and needs no connection, clip, or base.
 * It gives no permission to edit and no interpretation of live content.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { z } from 'zod';

import {
  DocumentError, applyPatch, contentHash, modelReference, parse, serialize,
  type Document, type Encoding, type Overlay, type Patch, type StateDocument,
} from '../document/index.js';
import { canonicalJson } from '../document/json.js';
import { parseSealable, sealProposal } from '../bindings/overlay-seal.js';
import { AGENT_NATIVE_TOOL_PROFILE, failureResult, type ReadResult } from './agent-native-result.js';
import type { ToolSpec } from './tools.js';

export const REFERENCE_SCHEMA = 'ghostnote-document-reference/1';
export const REFERENCE_TOOL = 'get_document_reference';

const byId = (a: Overlay, b: Overlay) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// --- the maintained reference --------------------------------------------------

const SPEC = new URL('../../../spec/ghostnote-document-v1/', import.meta.url);
const REFERENCE_SOURCE = readFileSync(new URL('MODEL-REFERENCE.md', SPEC), 'utf8');
const REFERENCE_IDENTITY = JSON.parse(readFileSync(new URL('MODEL-REFERENCE.identity.json', SPEC), 'utf8')) as {
  formatVersion: string; referenceRevision: number; sha256: string;
};
if (createHash('sha256').update(REFERENCE_SOURCE, 'utf8').digest('hex') !== REFERENCE_IDENTITY.sha256) {
  throw new Error('MODEL-REFERENCE.md does not match its identity file; run npm run document:artifacts');
}

/** The reference identity that the read and the reference tool name. */
export const MODEL_REFERENCE = Object.freeze({
  format: `ghostnote-document/${REFERENCE_IDENTITY.formatVersion}`,
  revision: REFERENCE_IDENTITY.referenceRevision,
  sha256: REFERENCE_IDENTITY.sha256,
});

export const OPTIONAL_REFERENCE_SECTIONS = ['Patch', 'Timing overlays', 'Groups', 'Meter and tempo'] as const;
export type OptionalSection = typeof OPTIONAL_REFERENCE_SECTIONS[number];

/** The maintained reference split into its `## ` sections, without the title block. */
const SECTIONS: ReadonlyMap<string, string> = new Map(REFERENCE_SOURCE.split(/(?=^## )/m).slice(1)
  .map((piece) => [piece.split('\n')[0]!.slice(3), piece.trimEnd()]));

/** The Core section, as the read tool description carries it. */
export const CORE_REFERENCE = SECTIONS.get('Core')!;

/** The optional sections that `read_launcher_clip` returns with a read. */
export function selectedReference(sections: readonly OptionalSection[]): string {
  return [...new Set(sections)].map((name) => SECTIONS.get(name)!).join('\n\n') + '\n';
}

// --- templates -----------------------------------------------------------------

/**
 * The example ref of the patch template. It has the ref shape, so a copied template refuses with code
 * expired-ref and writes nothing.
 */
export const EXAMPLE_REF = 'gnb1.from-read';

/** The fenced FIELDS examples of one reference section, in source order. Each one parses (checked at load). */
function examplesOf(section: string): Document[] {
  return [...SECTIONS.get(section)!.matchAll(/```fields\n([\s\S]*?)```/g)].map((match) => parse(match[1]!, 'fields'));
}
const [CORE_EXAMPLE, PATCH_EXAMPLE, TIMING_EXAMPLE] = (['Core', 'Patch', 'Timing overlays'] as const).map((section) => {
  const examples = examplesOf(section);
  if (examples.length !== 1) throw new Error(`MODEL-REFERENCE.md must hold one example in ${section}`);
  return examples[0]!;
}) as [Document, Document, StateDocument];
if (CORE_EXAMPLE.kind !== 'desired' || CORE_EXAMPLE.base !== undefined || CORE_EXAMPLE.clips.length !== 1) {
  throw new Error('the Core example must be a one-clip desired document without BASE');
}
if (PATCH_EXAMPLE.kind !== 'patch' || PATCH_EXAMPLE.base.sha256 !== contentHash(CORE_EXAMPLE)) {
  throw new Error('the Patch example must patch the Core example');
}
if (TIMING_EXAMPLE.kind !== 'desired' || TIMING_EXAMPLE.overlays.some((claim) => claim.state !== 'current')) {
  throw new Error('the Timing overlays example must be a desired document with current claims');
}

/**
 * The templates, from the reference examples. The desired template is the Core example. The patch template is
 * the Patch example with the example ref: a live edit needs BASE with the sha256 and the ref of a read.
 */
const TEMPLATE_DOCUMENTS: Readonly<Record<TemplateKind, Document>> = {
  desired: CORE_EXAMPLE,
  patch: { ...PATCH_EXAMPLE, base: { ...(PATCH_EXAMPLE as Patch).base, ref: EXAMPLE_REF } } as Patch,
};
export type TemplateKind = 'desired' | 'patch';

/** One template in one encoding: FIELDS text, or the canonical JSON object. Each one parses (checked at load). */
export function template(kind: TemplateKind, encoding: Encoding): string | Record<string, unknown> {
  return encoding === 'fields' ? TEMPLATES[kind].fields : structuredClone(TEMPLATES[kind].json);
}
const TEMPLATES = Object.fromEntries((['desired', 'patch'] as const).map((kind) => {
  const fields = serialize(TEMPLATE_DOCUMENTS[kind], 'fields');
  const json = serialize(TEMPLATE_DOCUMENTS[kind], 'json');
  for (const [text, encoding] of [[fields, 'fields'], [json, 'json']] as const) {
    if (parse(text, encoding).kind !== kind) throw new Error(`the ${kind} template does not parse as ${encoding}`);
  }
  return [kind, { fields, json: JSON.parse(json) as Record<string, unknown> }];
})) as Record<TemplateKind, { fields: string; json: Record<string, unknown> }>;

/** One ADD row for the edit description. It parses in the patch template; a test applies it to the Core example. */
export const ADD_EXAMPLE_ROW = 'ADD n2 part 1 1/2 64 100 1 false';
if (parse(TEMPLATES.patch.fields + ADD_EXAMPLE_ROW + '\n', 'fields').kind !== 'patch') {
  throw new Error('the ADD example row does not parse');
}

// --- timing templates ------------------------------------------------------------

/** The notes of the Timing overlays example without its claims: the fixture of the timing templates. */
export const TIMING_FIXTURE = { ...TIMING_EXAMPLE, overlays: [] } as StateDocument;

export type TimingTemplateKind = 'known' | 'unknown';

/**
 * The timing template of one mode: a patch that puts one nominal claim and its groove claim of the Timing overlays
 * example on the fixture, in the host input form (no basis). known: the groove with sourceAt and sourceDuration.
 * unknown: the groove without them.
 */
function timingPatch(kind: TimingTemplateKind): Patch {
  const claims = TIMING_EXAMPLE.overlays;
  const groove = claims.find((claim) => claim.type === 'groove' && ('sourceAt' in claim.data) === (kind === 'known'))!;
  const nominal = claims.find((claim) => claim.id === (groove.data as { nominal: string }).nominal)!;
  return {
    format: 'ghostnote-document', version: '1.0', kind: 'patch',
    base: { sha256: contentHash(TIMING_FIXTURE), ref: EXAMPLE_REF },
    add: [], remove: [], update: [], clipUpdate: [], overlayPut: [nominal, groove], overlayRemove: [],
  } as Patch;
}

/** One timing template in one encoding, without the basis of each put claim. */
function timingTemplateText(kind: TimingTemplateKind, encoding: Encoding): string {
  const text = serialize(timingPatch(kind), encoding);
  return text.replace(/"basis":"[0-9a-f]{64}",/g, '');
}
const TIMING_TEMPLATES = Object.fromEntries((['known', 'unknown'] as const).map((kind) => {
  const fields = timingTemplateText(kind, 'fields');
  const json = JSON.parse(timingTemplateText(kind, 'json')) as Record<string, unknown>;
  for (const [text, encoding] of [[fields, 'fields'], [JSON.stringify(json), 'json']] as const) {
    if (/"basis"/.test(text)) throw new Error(`the ${kind} timing template has a basis`);
    const { document, seal } = parseSealable(text, encoding);
    const applied = applyPatch(TIMING_FIXTURE, sealProposal(document, seal, TIMING_FIXTURE) as Patch).document;
    if (canonicalJson(applied.overlays) !== canonicalJson(timingPatch(kind).overlayPut.slice().sort(byId))) {
      throw new Error(`the ${kind} timing template does not seal to the Timing overlays example (${encoding})`);
    }
  }
  return [kind, { fields, json }];
})) as Record<TimingTemplateKind, { fields: string; json: Record<string, unknown> }>;

/** One timing template: FIELDS text, or the canonical JSON object. */
export function timingTemplate(kind: TimingTemplateKind, encoding: Encoding): string | Record<string, unknown> {
  return encoding === 'fields' ? TIMING_TEMPLATES[kind].fields : structuredClone(TIMING_TEMPLATES[kind].json);
}

/** The host input rule beside the timing templates. The portable format requires a basis on every claim. */
export const TIMING_TEMPLATE_NOTE = 'Each patch puts a nominal claim and its groove claim on one note of the '
  + 'Timing overlays example (BASE is that example without OVERLAY rows). known: authored timing with known '
  + 'source values (n1). unknown: an observation with unresolved residuals (n2). For a live clip, copy BASE from a '
  + 'fresh read_launcher_clip and the event IDs from its document. In a new clip, put the same claims in OVERLAY '
  + 'rows of the add_launcher_clip document. Host input rule of add_launcher_clip and edit_launcher_clip, not of '
  + 'the portable format: a current claim that the call states (OVERLAY_PUT, or a new or changed OVERLAY) can '
  + 'omit basis; the tool computes it after the note changes of the call. A supplied basis must match, or the call '
  + 'refuses with R22 and detail.expectedBasis. A retained or stale claim keeps its prior basis; a stale claim '
  + 'must state it. The portable format requires basis on every overlay; each returned document has it.';

// --- description text ----------------------------------------------------------

/** The format statement at the start of each document input description. */
export const FORMAT_STATEMENT = 'The document is Ghostnote Document 1.0: Ghostnote\'s own format, not MIDI, '
  + 'MusicXML, or a free note list. FIELDS text is the default encoding; format json takes the same schema as a '
  + `JSON object. ${REFERENCE_TOOL} returns the rules and templates with no Bitwig call.`;

/**
 * When to request Timing overlays (8i10). It names timing feel by its musical terms: in the 8i10 trials, agents
 * requested only the sections that a description named, and never Timing overlays (E259).
 */
export const TIMING_FEEL_ROUTE = 'Timing feel (swing, groove, pocket, or notes ahead of or behind the beat): to '
  + 'make, keep, clean, or revise it, first request the Timing overlays section (read_launcher_clip reference, or '
  + `${REFERENCE_TOOL} sections). It has the analysis method; nominal and groove claims keep the rhythm and its `
  + 'offsets apart for a later change.';

/** The parameter text of a document input. */
export const documentParameter = (kind: string): string => `${kind} in Ghostnote Document 1.0: FIELDS text (default), `
  + 'or the same schema as a JSON object or JSON text when format is json. Beat values are exact integers or '
  + 'fractions such as 1/2 (JSON strings), not decimals. Velocity is an integer 0..127. '
  + `${REFERENCE_TOOL} has the rules and templates.`;

/** The minimal desired example of add_launcher_clip. */
export const DESIRED_EXAMPLE_TEXT = 'Minimal valid document (one 4-beat clip, one note):\n'
  + TEMPLATES.desired.fields
  + 'Each EVENT row has one value for each FIELDS name: id, clip ID, at and duration in beats as exact integers or '
  + 'fractions (1/2, not 0.5), pitch (MIDI note number; Bitwig shows 60 as C3), velocity (integer 0..127), '
  + 'channel (1..16), mute. COVERAGE must state complete state: fields "all", all 16 channels, '
  + 'from 0 to the clip length, status complete. Do not copy the COVERAGE of a read: it lists only the observed '
  + 'fields.';

/** The minimal patch example of edit_launcher_clip. */
export const PATCH_EXAMPLE_TEXT = 'Minimal valid patch:\n'
  + TEMPLATES.patch.fields
  + 'BASE is authority.base of a fresh read_launcher_clip of this clip (sha256 and ref, as JSON); the clip ID and '
  + `the event IDs come from data.document of that read. ADD has the EVENT row form and a new ID: ${ADD_EXAMPLE_ROW}. `
  + 'REMOVE names an event ID. UPDATE takes an event ID and a JSON object of fields. pitch is a MIDI note number; '
  + 'Bitwig shows 60 as C3. read_launcher_clip with '
  + 'reference ["Patch"] returns the Patch rules with the base.';

// --- repair guidance -----------------------------------------------------------

export interface Repair {
  readonly case: RepairCase;
  readonly correction: string;
  readonly reference: { readonly tool: string; readonly sections: readonly string[] };
  readonly found?: string;
  readonly template?: string | Record<string, unknown>;
}
export type RepairCase =
  | 'record-keyword' | 'record-order' | 'missing-fields' | 'row-width' | 'header' | 'encoding-mismatch'
  | 'exact-timing' | 'integer-value' | 'json-syntax' | 'json-envelope' | 'missing-coverage' | 'desired-coverage'
  | 'document-kind' | ClaimRepairCase;
export type ClaimRepairCase =
  | 'overlay-depends' | 'dependency-entry' | 'dependency-minimum' | 'overlay-envelope' | 'overlay-data' | 'groove-timing'
  | 'duplicate-claim';

const RECORDS = new Set(['DOC', 'META', 'BASE', 'EXTENSIONS', 'CLIP', 'COVERAGE', 'FIELDS', 'EVENT', 'ADD', 'REMOVE',
  'UPDATE', 'CLIP_UPDATE', 'OVERLAY', 'OVERLAY_PUT', 'OVERLAY_REMOVE']);
const TIMING_FIELDS = new Set(['at', 'duration', 'length', 'from', 'to']);

/** The document kind that a tool takes: add takes a desired document; edit takes a patch or a desired one. */
export type DocumentUse = 'add' | 'edit';

/** The kind that the input declares, without a full parse. Undefined when no kind is visible. */
function declaredKind(text: string, encoding: Encoding): string | undefined {
  if (encoding === 'fields') return /^[ \t]*DOC[ \t]+\S+[ \t]+\S+[ \t]+(snapshot|desired|patch)\b/m.exec(text)?.[1];
  return /"kind"\s*:\s*"(snapshot|desired|patch)"/.exec(text)?.[1];
}

function templateFor(use: DocumentUse, text: string, encoding: Encoding) {
  const kind: TemplateKind = use === 'edit' && declaredKind(text, encoding) !== 'desired' ? 'patch' : 'desired';
  return { kind, document: template(kind, encoding) };
}

/** The first word of one input line, at most 32 characters. Nothing else of the input is returned. */
function firstWord(text: string, line: number | undefined): string | undefined {
  if (line === undefined) return undefined;
  const word = text.split(/\r?\n/)[line - 1]?.trim().split(/[\s{]/)[0];
  return word === undefined || word.length === 0 ? undefined : word.slice(0, 32);
}

/**
 * The known correction for one codec refusal of a document input, or nothing when no known correction applies.
 * It keeps the refusal: it does not change the input, guess a value, or accept the document.
 */
export function repairOf(error: DocumentError, text: string, encoding: Encoding, use: DocumentUse): Repair | undefined {
  const core = (sections: string[] = []) => ({ tool: REFERENCE_TOOL, sections: ['Core', ...sections] });
  const sections = use === 'edit' && declaredKind(text, encoding) !== 'desired' ? ['Patch'] : [];
  const reason = error.message.slice(error.message.indexOf(': ') + 2);
  const start = text.trimStart();
  const withTemplate = (repair: Omit<Repair, 'template' | 'reference'>): Repair => {
    const chosen = templateFor(use, text, encoding);
    return { ...repair, reference: core(chosen.kind === 'patch' ? ['Patch'] : []), template: chosen.document };
  };

  if (encoding === 'fields' && (start.startsWith('{') || start.startsWith('['))) return encodingRepair('fields');
  if (encoding === 'json' && /^DOC\s/.test(start)) return encodingRepair('json');
  if (error.rule === 'R10' && reason === 'expected DOC format version kind') {
    return withTemplate({ case: 'header', correction: start.startsWith('`')
      ? 'Remove the code fence. The first nonblank line is the DOC record.'
      : `The first nonblank line is DOC ghostnote-document 1.0 ${use === 'add' ? 'desired' : 'patch (or desired)'}.` });
  }
  if (encoding === 'fields' && error.rule === 'R01' && reason === 'unknown or repeated record') {
    const found = firstWord(text, error.line);
    if (found !== undefined && !RECORDS.has(found)) {
      return { case: 'record-keyword', found, reference: core(sections), correction: 'Each line starts with a record '
        + 'keyword. A note row starts with EVENT in a desired document and with ADD in a patch, then one value for '
        + 'each FIELDS name. NOTE and bare rows are not records.' };
    }
    return { case: 'record-order', ...(found === undefined ? {} : { found }), reference: core(sections),
      correction: 'DOC comes first. META, BASE, EXTENSIONS, and FIELDS occur at most once. CLIP and COVERAGE come '
        + 'before FIELDS; EVENT, ADD, REMOVE, UPDATE, and the overlay records come after it.' };
  }
  if (error.rule === 'R10' && /FIELDS binding/.test(reason)) {
    return withTemplate({ case: 'missing-fields', correction: 'Write one FIELDS binding after CLIP and COVERAGE and '
      + 'before the first row: FIELDS id clip at duration pitch velocity channel mute.' });
  }
  if (error.rule === 'R10' && /row slots/.test(reason)) {
    return { case: 'row-width', reference: core(sections), correction: 'Each row has exactly one value for each '
      + 'FIELDS name, in the FIELDS order (8 values for id clip at duration pitch velocity channel mute). Write '
      + 'other event fields after WITH as one JSON object.' };
  }
  if (error.rule === 'R05' && TIMING_FIELDS.has(error.field)) {
    return { case: 'exact-timing', reference: core(), correction: `${error.field} is an exact beat value: an `
      + 'integer or a fraction such as 1/2 or 3/4, as a JSON string in JSON records ("1/2"). Decimals such as 0.5 '
      + 'are refused, not rounded. One beat is a quarter note.' };
  }
  if (error.rule === 'R04' && reason === 'expected integer') {
    return { case: 'integer-value', reference: core(), correction: `${error.field} is an integer. Pitch and `
      + 'velocity are 0..127 (velocity is not 0..1); channel is 1..16.' };
  }
  if (encoding === 'json' && error.rule === 'R11') {
    return withTemplate({ case: 'json-syntax', correction: 'The input is not strict JSON. Send one JSON object '
      + 'with the Ghostnote document schema, as in the template.' });
  }
  if (encoding === 'json' && error.path.split('.').length === 2
      && (/required field is missing/.test(reason) || ['$.format', '$.version'].includes(error.path))) {
    return withTemplate({ case: 'json-envelope', correction: 'JSON is the same Ghostnote schema, not a free note '
      + 'object: format "ghostnote-document", version "1.0", kind, clips, coverage, events, and overlays; a patch '
      + 'has base and all six change arrays (add, remove, update, clipUpdate, overlayPut, overlayRemove), also '
      + 'when empty.' });
  }
  if (error.rule === 'R03' && /^missing coverage for /.test(reason)) {
    return withTemplate({ case: 'missing-coverage', correction: 'Each CLIP needs one COVERAGE record before '
      + 'FIELDS. A desired document states complete coverage: fields "all", all 16 channels, from 0 to the clip '
      + 'length, status complete.' });
  }
  if (error.rule === 'R03' && /^\$\.coverage\[\d+\](\.fields)?$/.test(error.path)
      && /desired coverage must contain complete state|missing required coverage field/.test(reason)) {
    return withTemplate({ case: 'desired-coverage', correction: 'A desired document is complete state. Its '
      + 'COVERAGE has fields "all", all 16 channels, from "0" to the clip length, and status complete. The COVERAGE '
      + 'of a read is snapshot coverage: it lists only the observed fields. Do not copy it into a desired document.' });
  }
  return claimRepair(error.rule, error.path, reason);
}

// --- claim repair --------------------------------------------------------------

const DEPENDS_FORM = 'depends has four arrays, all required, also when empty: events and clips hold {"id","fields"} '
  + 'objects; overlays and membership hold IDs. Example: {"events":[{"id":"n1","fields":["at","clip","duration"]}],'
  + '"clips":[],"overlays":["nom1"],"membership":[]}.';
const CLAIM = /^\$\.(?:overlays|overlayPut)\[\d+\]/;

/**
 * The known correction for a refused overlay claim (8i9), from the codec rule, path, and reason only. The codec
 * reports a structure fault at the parse. It reports a timing equation (R15, R16) and a duplicate current claim (R13,
 * R14; 8i11) when the claim meets its event: at the apply of an edit, or at the creation check of an add. Undefined
 * when no known correction applies.
 */
function claimRepair(rule: string, path: string, reason: string): Repair | undefined {
  const reference = { tool: REFERENCE_TOOL, sections: ['Core', 'Timing overlays'] };
  const repair = (kind: ClaimRepairCase, correction: string): Repair => ({ case: kind, reference, correction });
  if (rule === 'R15' || rule === 'R16') {
    return repair('groove-timing', 'Known source (sourceAt and sourceDuration present): atDelta and durationDelta '
      + 'are values; sourceAt = nominal.at + phase + template + cross + local + unassigned; event.at = sourceAt + '
      + 'atDelta; sourceDuration = nominal.duration + durationIntent + durationUnassigned; event.duration = '
      + 'sourceDuration + durationDelta; resolved intent has zero unassigned terms. Unknown source (no sourceAt or '
      + 'sourceDuration): atDelta and durationDelta are null, intent is unresolved, phase, template, cross, local, '
      + 'and durationIntent are 0, unassigned = event.at - nominal.at, and durationUnassigned = event.duration - '
      + 'nominal.duration. Measured provenance has unresolved intent and zero intentional terms. With a known '
      + 'source, event.at is the floor of sourceAt to the 1/512-beat cell, so atDelta = event.at - sourceAt is in '
      + '(-1/512, 0]; claim values can be finer than a cell.');
  }
  const duplicate = /^duplicate current claim: (nominal|groove) claims (\S+) and (\S+) of event (\S+)$/.exec(reason);
  if ((rule === 'R13' || rule === 'R14') && duplicate !== null) {
    const [, type, first, second, event] = duplicate;
    return repair('duplicate-claim', `Event ${event} has two current ${type} claims: ${first} and ${second}. An `
      + 'event has one current claim of each type. A claim stays current when the edit does not move its note. To '
      + 'replace it, put the new claim under the existing ID (OVERLAY_PUT replaces the claim with that ID), or remove '
      + 'the existing claim with OVERLAY_REMOVE in the same patch. Use new IDs only for notes that the same edit '
      + 'moves: their earlier claims become stale.');
  }
  if (rule === 'R22' || rule === 'R28' || !CLAIM.test(path)) return undefined;
  const tail = path.replace(CLAIM, '');
  if (/^\.depends(?:\.(?:events|clips|overlays|membership))?$/.test(tail)
      && /required field is missing|expected/.test(reason)) {
    return repair('overlay-depends', DEPENDS_FORM);
  }
  if ((/^\.depends\.(?:events|clips)\[\d+\](?:\.(?:id|fields))?$/.test(tail)
      || /^\.depends\.(?:overlays|membership)\[\d+\]$/.test(tail)) && /required field is missing|expected/.test(reason)) {
    return repair('dependency-entry', DEPENDS_FORM);
  }
  if (rule === 'R21' && /^missing .*dependency/.test(reason)) {
    return repair('dependency-minimum', 'A nominal claim depends on the at, clip, and duration fields of its event. '
      + 'A groove claim depends on the same fields and names its nominal claim ID in depends.overlays. '
      + DEPENDS_FORM);
  }
  if ((/^\.(?:id|type|state|provenance|basis)$/.test(tail) || /^\.provenance\.(?:kind|source|method)$/.test(tail))
      && /required field is missing|expected|unknown/.test(reason)) {
    return repair('overlay-envelope', 'Each OVERLAY and OVERLAY_PUT is one JSON object with id, type, state '
      + '(current or stale), provenance, depends, and data. provenance is {"kind","source","method"}: kind is '
      + 'declared, measured, or inferred; source and method are nonempty text.');
  }
  if (/^\.data(?:\.[A-Za-z]+)?$/.test(tail) && /required field is missing|unknown field|expected object/.test(reason)) {
    return repair('overlay-data', 'Nominal data: event, at, duration, and division (at is a multiple of division). '
      + 'Groove data: event, nominal, intent, phase, template, cross, local, unassigned, durationIntent, '
      + 'durationUnassigned, atDelta, and durationDelta; also sourceAt and sourceDuration when the source timing is '
      + 'known. Timing values are exact fractions as JSON strings.');
  }
  return undefined;
}

/** The known correction for a claim refusal of the planner or the creation check: a codec rule and its path. */
export function claimRepairOf(refusal: { readonly message: string; readonly detail: Readonly<Record<string, unknown>> }) {
  const { rule, path } = refusal.detail;
  if (typeof rule !== 'string' || typeof path !== 'string') return undefined;
  const reason = refusal.message.includes(': ') ? refusal.message.slice(refusal.message.indexOf(': ') + 2) : refusal.message;
  return claimRepair(rule, path, reason);
}

/** The repair when the input is in the other encoding than format states. */
export function encodingRepair(stated: Encoding): Repair {
  return {
    case: 'encoding-mismatch',
    reference: { tool: REFERENCE_TOOL, sections: ['Core'] },
    correction: stated === 'fields'
      ? 'The input is JSON, but format is fields. Send format json with a Ghostnote JSON document, or send FIELDS text.'
      : 'The input is FIELDS text, but format is json. Omit format (fields is the default), or send the JSON encoding.',
  };
}

/** The repair when the parsed kind is not one that the tool takes. */
export function kindRepair(use: DocumentUse, encoding: Encoding, text: string): Repair {
  const chosen = templateFor(use, text, encoding);
  return {
    case: 'document-kind',
    reference: { tool: REFERENCE_TOOL, sections: ['Core', ...(chosen.kind === 'patch' ? ['Patch'] : [])] },
    correction: use === 'add'
      ? 'add_launcher_clip takes one desired document without BASE: DOC ghostnote-document 1.0 desired, one CLIP, '
        + 'complete COVERAGE, FIELDS, and EVENT rows.'
      : 'edit_launcher_clip takes a patch (sparse changes on BASE) or a desired document (complete new state). A '
        + 'snapshot from a read is not an edit; change only what the edit needs in a patch.',
    template: chosen.document,
  };
}

// --- get_document_reference ----------------------------------------------------

const referenceInput = z.object({
  sections: z.array(z.enum(OPTIONAL_REFERENCE_SECTIONS)).max(4).optional().describe(
    'Optional sections to add to Core: Patch, Timing overlays, Groups, Meter and tempo. Patch also adds the patch '
    + 'template; Timing overlays adds the timing-feel method and the timing templates.',
  ),
  format: z.enum(['fields', 'json']).default('fields').describe(
    'Template encoding: fields (FIELDS text, default) or json (the same schema as a JSON object).',
  ),
}).strict();
type ReferenceInput = z.infer<typeof referenceInput>;

const REFERENCE_DESCRIPTION = `Profile ${AGENT_NATIVE_TOOL_PROFILE}. Return the Ghostnote Document 1.0 format `
  + 'reference and valid templates. Ghostnote Document 1.0 is Ghostnote\'s own note format: read_launcher_clip '
  + 'returns it, and add_launcher_clip and edit_launcher_clip accept it. This call reads no Bitwig state. It works '
  + 'without a connection and without a clip, and returns no base, no IDs, and no permission to edit.\n'
  + 'The Core section is always in data.reference; sections adds Patch, Timing overlays, Groups, or Meter and '
  + 'tempo. data has the format, the reference revision and sha256, and templates.desired: a complete one-clip '
  + 'desired document for add_launcher_clip. With Patch, templates.patch is a patch for edit_launcher_clip: its '
  + 'BASE and IDs show the form only; copy them from a fresh read_launcher_clip of the target clip. With Timing '
  + 'overlays, templates.timing has known and unknown: patches that put a nominal and a groove claim, and a note '
  + 'with the basis rule of the host tools. format json returns the templates as JSON objects of the same schema.';

function getDocumentReference(args: ReferenceInput): unknown {
  try {
    const encoding: Encoding = args.format ?? 'fields';
    const optional = [...new Set(args.sections ?? [])];
    const patch = optional.includes('Patch');
    const timing = optional.includes('Timing overlays');
    const result: ReadResult<Record<string, unknown>> = {
      schema: REFERENCE_SCHEMA,
      source: { host: 'ghostnote', read: 'maintained-reference' },
      target: { sections: ['Core', ...optional] },
      coverage: { status: 'complete' },
      authority: { kind: 'reference-only' },
      data: {
        format: MODEL_REFERENCE.format,
        revision: MODEL_REFERENCE.revision,
        sha256: MODEL_REFERENCE.sha256,
        encoding,
        reference: modelReference(REFERENCE_SOURCE, optional),
        templates: {
          desired: template('desired', encoding),
          ...(patch ? { patch: template('patch', encoding) } : {}),
          ...(timing ? { timing: {
            note: TIMING_TEMPLATE_NOTE,
            known: timingTemplate('known', encoding),
            unknown: timingTemplate('unknown', encoding),
          } } : {}),
        },
      },
      warnings: [],
    };
    return result;
  } catch (error) {
    return failureResult(REFERENCE_SCHEMA, 'input', error);
  }
}

export const getDocumentReferenceTool: ToolSpec = {
  name: REFERENCE_TOOL,
  kind: 'read',
  title: 'Get the Ghostnote document format reference',
  description: REFERENCE_DESCRIPTION,
  inputSchema: referenceInput.shape,
  inputValidator: referenceInput,
  emits: [],
  resultContract: {
    schema: REFERENCE_SCHEMA,
    profile: AGENT_NATIVE_TOOL_PROFILE,
    envelope: ['schema', 'source', 'target', 'coverage', 'authority', 'data', 'warnings'],
    failure: ['schema', 'failure.code', 'failure.stage', 'failure.effects', 'message'],
    templates: ['desired', 'patch with Patch', 'timing with Timing overlays'],
    reference: MODEL_REFERENCE,
  },
  run: async (_workspace, input) => getDocumentReference(input as ReferenceInput),
};
