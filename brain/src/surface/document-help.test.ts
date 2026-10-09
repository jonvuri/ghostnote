/**
 * Document format help (8i6): the templates, the reference tool without a host, the format text of each document
 * input, and the repair of each listed malformed input. Each refusal makes no host call.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { parseSealable, sealProposal } from '../bindings/overlay-seal.js';
import {
  applyPatch, contentHash, dependencyBasis, parse, serialize, type Patch, type StateDocument,
} from '../document/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import {
  ADD_EXAMPLE_ROW, EXAMPLE_REF, MODEL_REFERENCE, OPTIONAL_REFERENCE_SECTIONS, REFERENCE_SCHEMA, REFERENCE_TOOL,
  TIMING_FIXTURE, TIMING_TEMPLATE_NOTE, template, timingTemplate,
} from './document-help.js';
import { AGENT_NATIVE_TOOL_PROFILE, AGENT_NATIVE_TOOLS, callTool } from './tools.js';
import { workspaceOf, type Workspace } from './workspace.js';

type Wire = Record<string, any>;

const SPEC = new URL('../../../spec/ghostnote-document-v1/', import.meta.url);

/** A workspace whose host refuses every call, and the count of the calls. */
function hostless(): { workspace: Workspace; calls: string[] } {
  const calls: string[] = [];
  const fake = new FakeAdapter({ tracks: ['gn-help'], scenes: 2 });
  const adapter = new Proxy(fake, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.push(String(key));
        throw new Error(`no host: ${String(key)}`);
      };
    },
  });
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => { calls.push('ready'); throw new Error('no host'); }, adapter,
    executor: new Executor(adapter, { newId: () => `help-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(),
    documents: new IdentityRegistry(),
  });
  return { workspace, calls };
}

const call = (workspace: Workspace, name: string, args: Wire) =>
  callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Promise<Wire>;

// --- templates and identity ------------------------------------------------------

test('8i6 templates: each template parses in its encoding, and the patch applies to the desired template', () => {
  const identity = JSON.parse(readFileSync(new URL('MODEL-REFERENCE.identity.json', SPEC), 'utf8'));
  assert.equal(MODEL_REFERENCE.revision, identity.referenceRevision);
  assert.equal(MODEL_REFERENCE.sha256, identity.sha256);
  const desired = parse(template('desired', 'fields') as string, 'fields');
  const patch = parse(template('patch', 'fields') as string, 'fields') as Patch;
  assert.deepEqual(parse(JSON.stringify(template('desired', 'json')), 'json'), desired);
  assert.deepEqual(parse(JSON.stringify(template('patch', 'json')), 'json'), patch);
  assert.equal(desired.kind, 'desired');
  assert.equal(patch.base.ref, EXAMPLE_REF);
  assert.equal(patch.base.sha256, contentHash(desired));
  // The reference examples are the source: the desired template is the Core example, byte for byte.
  const source = readFileSync(new URL('MODEL-REFERENCE.md', SPEC), 'utf8');
  assert.ok(source.includes('```fields\n' + template('desired', 'fields')));
  const added = parse(`${template('patch', 'fields')}${ADD_EXAMPLE_ROW}\n`, 'fields') as Patch;
  const result = applyPatch(desired as StateDocument, added);
  assert.deepEqual(result.document.events.map((event) => [event.id, event.pitch, event.at, event.duration]),
    [['n1', 62, '0', '1'], ['n2', 64, '1', '1/2']]);
});

// --- get_document_reference ------------------------------------------------------

test('8i6 reference: Core and the desired template, with no host call and no live authority', async () => {
  const { workspace, calls } = hostless();
  const result = await call(workspace, REFERENCE_TOOL, {});
  assert.equal(result['failure'], undefined, JSON.stringify(result).slice(0, 400));
  assert.equal(result['schema'], REFERENCE_SCHEMA);
  assert.deepEqual(calls, []);
  const data = result['data'];
  assert.equal(data.format, 'ghostnote-document/1.0');
  assert.equal(data.revision, MODEL_REFERENCE.revision);
  assert.equal(data.sha256, MODEL_REFERENCE.sha256);
  assert.match(data.reference, /\n## Core\n/);
  assert.doesNotMatch(data.reference, /## Patch/);
  assert.deepEqual(Object.keys(data.templates), ['desired']);
  assert.equal(parse(data.templates.desired, 'fields').kind, 'desired');
  assert.deepEqual(result['authority'], { kind: 'reference-only' });
  assert.equal(JSON.stringify(result).includes('"ref"'), false, 'no base ref');
});

test('8i6 reference: every section and JSON templates; the largest request stays near the reference size', async () => {
  const { workspace, calls } = hostless();
  const result = await call(workspace, REFERENCE_TOOL, { sections: [...OPTIONAL_REFERENCE_SECTIONS], format: 'json' });
  assert.deepEqual(calls, []);
  const data = result['data'];
  for (const section of ['Core', ...OPTIONAL_REFERENCE_SECTIONS]) assert.match(data.reference, new RegExp(`\n## ${section}\n`));
  assert.deepEqual(result['target'], { sections: ['Core', ...OPTIONAL_REFERENCE_SECTIONS] });
  assert.equal(parse(JSON.stringify(data.templates.desired), 'json').kind, 'desired');
  assert.equal(parse(JSON.stringify(data.templates.patch), 'json').kind, 'patch');
  const reference = readFileSync(new URL('MODEL-REFERENCE.md', SPEC), 'utf8');
  // The JSON escaping of the reference, the four templates, and the timing note (8i9) add about 4.8 KB.
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < Buffer.byteLength(reference) + 6_144);
});

// --- descriptions ----------------------------------------------------------------

const spec = (name: string) => AGENT_NATIVE_TOOLS.find((item) => item.name === name)!;

test('8i6 descriptions: each document consumer names the custom format and the reference tool', () => {
  const consumers = AGENT_NATIVE_TOOLS.filter((item) => 'document' in item.inputSchema).map((item) => item.name);
  assert.deepEqual(consumers.sort(), ['add_launcher_clip', 'edit_launcher_clip']);
  for (const name of [...consumers, 'read_launcher_clip', 'check_launcher_clips']) {
    assert.match(spec(name).description, /Ghostnote Document 1\.0/, name);
    assert.match(spec(name).description, new RegExp(REFERENCE_TOOL), name);
  }
  for (const name of consumers) {
    const text = String((spec(name).inputSchema['document'] as { description?: string }).description);
    assert.match(text, /Ghostnote Document 1\.0/, name);
    assert.match(text, new RegExp(REFERENCE_TOOL), name);
    assert.match(spec(name).description, /Ghostnote's own format/, name);
  }
});

test('8i6 descriptions: the add and edit examples are valid documents of the kind each tool takes', () => {
  const block = (description: string) => {
    const from = description.split('\n').findIndex((line) => line.startsWith('DOC '));
    const rows = description.split('\n').slice(from);
    return rows.slice(0, rows.findIndex((line) => !/^(DOC|BASE|CLIP|COVERAGE|FIELDS|EVENT|UPDATE) [\w{"]/.test(line)
      || line.startsWith('BASE is'))).join('\n') + '\n';
  };
  const desired = parse(block(spec('add_launcher_clip').description), 'fields');
  assert.equal(desired.kind, 'desired');
  assert.equal(desired.base, undefined);
  assert.match(spec('add_launcher_clip').description, /"fields":"all"/);
  const patch = parse(block(spec('edit_launcher_clip').description), 'fields') as Patch;
  assert.equal(patch.kind, 'patch');
  assert.equal(patch.base.ref, EXAMPLE_REF);
  assert.match(spec('edit_launcher_clip').description, /BASE is authority\.base of a fresh read_launcher_clip/);
  assert.ok(spec('edit_launcher_clip').description.includes(ADD_EXAMPLE_ROW));
});

// --- repair ----------------------------------------------------------------------

const H = 'DOC ghostnote-document 1.0 desired';
const CLIP = 'CLIP {"id":"part","length":"4"}';
const COVERAGE = 'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"part","fields":"all",'
  + '"from":"0","status":"complete","to":"4"}';
const SNAPSHOT_COVERAGE = 'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"part","fields":'
  + '["id","clip","at","duration","pitch","velocity","channel","mute","releaseVelocity","expression","chance",'
  + '"occurrence","recurrence"],"from":"0","status":"complete","to":"4"}';
const FIELDS = 'FIELDS id clip at duration pitch velocity channel mute';
const ROW = 'EVENT n1 part 0 1 60 100 1 false';
const lines = (...items: string[]) => items.join('\n');

/** The listed malformed inputs (8i6 work item 3), each with its rule and repair case. */
const MALFORMED: readonly { name: string; document: string | Wire; format?: 'json'; rule: string; repair: string;
  template?: boolean }[] = [
  { name: 'NOTE row', document: lines(H, CLIP, COVERAGE, FIELDS, 'NOTE n1 part 0 1 60 100 1 false'),
    rule: 'R01', repair: 'record-keyword' },
  { name: 'bare row', document: lines(H, CLIP, COVERAGE, FIELDS, 'n1 part 0 1 60 100 1 false'),
    rule: 'R01', repair: 'record-keyword' },
  { name: 'missing FIELDS', document: lines(H, CLIP, COVERAGE, ROW), rule: 'R10', repair: 'missing-fields',
    template: true },
  { name: 'decimal timing', document: lines(H, CLIP, COVERAGE, FIELDS, 'EVENT n1 part 0.5 1 60 100 1 false'),
    rule: 'R05', repair: 'exact-timing' },
  { name: 'noninteger velocity', document: lines(H, CLIP, COVERAGE, FIELDS, 'EVENT n1 part 0 1 60 0.8 1 false'),
    rule: 'R04', repair: 'integer-value' },
  { name: 'free JSON note object', document: { notes: [{ pitch: 60, start: 0, duration: 1, velocity: 100 }] },
    format: 'json', rule: 'R01', repair: 'json-envelope', template: true },
  { name: 'JSON without coverage', document: { format: 'ghostnote-document', version: '1.0', kind: 'desired',
    clips: [{ id: 'part', length: '4' }], events: [] }, format: 'json', rule: 'R02', repair: 'json-envelope',
    template: true },
  { name: 'invalid JSON text', document: '{"format": "ghostnote-document",', format: 'json', rule: 'R11',
    repair: 'json-syntax', template: true },
  { name: 'missing coverage', document: lines(H, CLIP, FIELDS, ROW), rule: 'R03', repair: 'missing-coverage',
    template: true },
  { name: 'snapshot coverage as desired', document: lines(H, CLIP, SNAPSHOT_COVERAGE, FIELDS, ROW), rule: 'R03',
    repair: 'desired-coverage', template: true },
  { name: 'code fence', document: '```\n' + lines(H, CLIP, COVERAGE, FIELDS, ROW) + '\n```', rule: 'R10',
    repair: 'header', template: true },
  { name: 'FIELDS sent as json', document: lines(H, CLIP, COVERAGE, FIELDS, ROW), format: 'json', rule: 'R11',
    repair: 'encoding-mismatch' },
];

for (const tool of ['add_launcher_clip', 'edit_launcher_clip'] as const) {
  for (const item of MALFORMED) {
    test(`8i6 repair: ${tool}, ${item.name}: a bounded correction, the rule and location, no host call`, async () => {
      const { workspace, calls } = hostless();
      const result = await call(workspace, tool, {
        trackId: 'gn-help', row: 0, document: item.document, ...(item.format === undefined ? {} : { format: item.format }),
      });
      const text = JSON.stringify(result);
      assert.deepEqual(calls, [], `${item.name}: ${text.slice(0, 300)}`);
      assert.equal(result['failure']?.code, 'invalid-input', text.slice(0, 300));
      assert.equal(result['failure'].stage, 'input');
      assert.deepEqual(result['failure'].effects, []);
      const detail = result['detail'];
      assert.equal(detail.rule, item.rule, text.slice(0, 300));
      assert.equal(typeof detail.path, 'string');
      assert.equal(typeof detail.line, 'number');
      assert.equal(typeof detail.column, 'number');
      const repair = detail.repair;
      assert.equal(repair?.case, item.repair, text.slice(0, 400));
      assert.equal(repair.reference.tool, REFERENCE_TOOL);
      assert.equal(repair.reference.sections[0], 'Core');
      assert.equal(repair.template !== undefined, item.template === true, item.name);
      if (repair.template !== undefined) {
        const encoding = item.format ?? 'fields';
        const parsed = parse(typeof repair.template === 'string' ? repair.template : JSON.stringify(repair.template),
          encoding);
        // edit returns the patch template unless the input declares a desired document.
        const declared = /desired/.test(typeof item.document === 'string' ? item.document : JSON.stringify(item.document));
        assert.equal(parsed.kind, tool === 'add_launcher_clip' || declared ? 'desired' : 'patch', item.name);
      }
      // Bounded: constant text and the template; no copy of the input.
      assert.ok(Buffer.byteLength(JSON.stringify(repair)) < 2_048, item.name);
      const input = typeof item.document === 'string' ? item.document : JSON.stringify(item.document);
      const own = JSON.stringify({ ...result, detail: { ...detail, repair: { ...repair, template: undefined } } });
      for (const line of input.split('\n').filter((row) => row.length > 12)) {
        assert.equal(own.includes(line), false, `${item.name}: the result copies an input line`);
      }
    });
  }
}

test('8i6 repair: an edit desired document keeps the desired template; NOTE returns only its keyword', async () => {
  const { workspace } = hostless();
  const result = await call(workspace, 'edit_launcher_clip', {
    trackId: 'gn-help', row: 0, document: lines(H, CLIP, FIELDS, ROW) });
  assert.equal(result['detail'].repair.case, 'missing-coverage');
  assert.equal(parse(result['detail'].repair.template, 'fields').kind, 'desired');
  const note = await call(workspace, 'add_launcher_clip', {
    trackId: 'gn-help', row: 0, document: lines(H, CLIP, COVERAGE, FIELDS, 'NOTE n1 part 0 1 60 100 1 false') });
  assert.equal(note['detail'].repair.found, 'NOTE');
});

test('8i6 repair: a snapshot to edit and a patch to add name the kind that each tool takes', async () => {
  const { workspace, calls } = hostless();
  const snapshot = lines('DOC ghostnote-document 1.0 snapshot', CLIP, SNAPSHOT_COVERAGE, FIELDS, ROW);
  const edit = await call(workspace, 'edit_launcher_clip', { trackId: 'gn-help', row: 0, document: snapshot });
  assert.equal(edit['failure'].code, 'invalid-input');
  assert.equal(edit['detail'].repair.case, 'document-kind');
  assert.equal(parse(edit['detail'].repair.template, 'fields').kind, 'patch');
  const add = await call(workspace, 'add_launcher_clip', { trackId: 'gn-help', row: 0,
    document: template('patch', 'fields') });
  assert.equal(add['failure'].code, 'invalid-input');
  assert.equal(add['detail'].repair.case, 'document-kind');
  assert.equal(parse(add['detail'].repair.template, 'fields').kind, 'desired');
  assert.deepEqual(calls, []);
});

test('8i6 repair: a rule with no known correction keeps the plain refusal', async () => {
  const { workspace } = hostless();
  const result = await call(workspace, 'add_launcher_clip', { trackId: 'gn-help', row: 0,
    document: lines(H, CLIP, COVERAGE, FIELDS, ROW, 'EVENT n1 part 1 1 62 100 1 false') });
  assert.equal(result['failure'].code, 'invalid-input');
  assert.equal(result['detail'].rule, 'R04');
  assert.equal(result['detail'].repair, undefined);
});

// --- timing templates and claim repair (8i9) --------------------------------------

/** The Timing overlays example of the maintained reference. */
function timingExample(): StateDocument {
  const section = readFileSync(new URL('MODEL-REFERENCE.md', SPEC), 'utf8').split(/(?=^## )/m)
    .find((piece) => piece.startsWith('## Timing overlays\n'))!;
  return parse(/```fields\n([\s\S]*?)```/.exec(section)![1]!, 'fields') as StateDocument;
}

test('8i9 timing example: complete envelopes in both encodings; each groove depends on its nominal', () => {
  const example = timingExample();
  assert.deepEqual(parse(serialize(example, 'json'), 'json'), example);
  for (const claim of example.overlays) {
    assert.deepEqual(Object.keys(claim.depends).sort(), ['clips', 'events', 'membership', 'overlays'], claim.id);
    assert.deepEqual(claim.depends.events.map((item) => [item.id, ...item.fields]),
      [[(claim.data as { event: string }).event, 'at', 'clip', 'duration']], claim.id);
    assert.equal(claim.basis, dependencyBasis(example, claim), claim.id);
    if (claim.type === 'groove') assert.deepEqual(claim.depends.overlays, [(claim.data as { nominal: string }).nominal]);
  }
  const grooves = example.overlays.filter((claim) => claim.type === 'groove').map((claim) => claim.data as Wire);
  assert.deepEqual(grooves.map((data) => [data.event, 'sourceAt' in data, data.intent, data.atDelta]),
    [['n1', true, 'resolved', '0'], ['n2', false, 'unresolved', null]]);
  assert.deepEqual(TIMING_FIXTURE.overlays, []);
  assert.deepEqual(TIMING_FIXTURE.events, example.events);
});

for (const kind of ['known', 'unknown'] as const) {
  for (const encoding of ['fields', 'json'] as const) {
    test(`8i9 timing template ${kind} (${encoding}): no basis; it seals and applies to its fixture as the example`, () => {
      const value = timingTemplate(kind, encoding);
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      assert.doesNotMatch(text, /"basis"/);
      if (encoding === 'json') {
        for (const key of ['add', 'remove', 'update', 'clipUpdate', 'overlayPut', 'overlayRemove']) {
          assert.ok(Array.isArray((value as Wire)[key]), key);
        }
      }
      const { document, seal } = parseSealable(text, encoding);
      assert.equal(document.kind, 'patch');
      assert.equal((document as Patch).base.ref, EXAMPLE_REF);
      assert.equal((document as Patch).base.sha256, contentHash(TIMING_FIXTURE));
      const applied = applyPatch(TIMING_FIXTURE, sealProposal(document, seal, TIMING_FIXTURE) as Patch).document;
      const event = kind === 'known' ? 'n1' : 'n2';
      assert.deepEqual(applied.overlays, timingExample().overlays.filter((claim) => (claim.data as Wire).event === event));
      // The returned document is a valid portable document in both encodings.
      for (const out of ['fields', 'json'] as const) assert.deepEqual(parse(serialize(applied, out), out), applied);
    });
  }
}

test('8i9 reference: Timing overlays returns the timing templates and the host basis rule; Core does not', async () => {
  const { workspace, calls } = hostless();
  const core = await call(workspace, REFERENCE_TOOL, { sections: ['Patch'] });
  assert.deepEqual(Object.keys(core['data'].templates), ['desired', 'patch']);
  assert.doesNotMatch(core['data'].reference, /OVERLAY/);
  const timing = await call(workspace, REFERENCE_TOOL, { sections: ['Timing overlays'], format: 'json' });
  assert.deepEqual(calls, []);
  const templates = timing['data'].templates;
  assert.deepEqual(Object.keys(templates), ['desired', 'timing']);
  assert.deepEqual(Object.keys(templates.timing), ['note', 'known', 'unknown']);
  assert.equal(templates.timing.note, TIMING_TEMPLATE_NOTE);
  assert.match(TIMING_TEMPLATE_NOTE, /not of the portable format/);
  assert.match(TIMING_TEMPLATE_NOTE, /R22 and detail\.expectedBasis/);
  assert.match(TIMING_TEMPLATE_NOTE, /stale claim must state it/);
  assert.deepEqual(templates.timing.known, timingTemplate('known', 'json'));
  assert.match(timing['data'].reference, /```fields\nDOC ghostnote-document 1\.0 desired\n[\s\S]*OVERLAY \{"basis"/);
});

const fixtureHead = (kind: 'desired' | 'patch') => kind === 'desired'
  ? lines(H, CLIP, COVERAGE, FIELDS, 'EVENT n1 part 17/32 3/16 60 100 1 false', 'EVENT n2 part 129/128 15/32 64 90 1 false')
  : lines('DOC ghostnote-document 1.0 patch',
    `BASE ${JSON.stringify({ ref: 'gnb1.AAAAAAAAAAAA', sha256: contentHash(TIMING_FIXTURE) })}`, FIELDS);

/** The claims of the known timing template, with basis, as JSON objects. */
const knownClaims = (): Wire[] => (JSON.parse(JSON.stringify(timingTemplate('known', 'json'))) as Wire)['overlayPut'];

/** The listed malformed claims (8i9 work item 5), each with its rule and repair case. */
const MALFORMED_CLAIMS: readonly { name: string; change: (nominal: Wire, groove: Wire) => void; rule: string;
  repair: string }[] = [
  { name: 'no membership array', change: (n) => { delete n.depends.membership; }, rule: 'R12', repair: 'overlay-depends' },
  { name: 'no depends', change: (n) => { delete n.depends; }, rule: 'R12', repair: 'overlay-depends' },
  { name: 'event dependency as an ID', change: (n) => { n.depends.events = ['n1']; }, rule: 'R21', repair: 'dependency-entry' },
  { name: 'event dependency without fields', change: (n) => { n.depends.events = [{ id: 'n1' }]; }, rule: 'R21',
    repair: 'dependency-entry' },
  { name: 'overlay dependency as an object', change: (_, g) => { g.depends.overlays = [{ id: 'nom1' }]; }, rule: 'R01',
    repair: 'dependency-entry' },
  { name: 'membership as an object', change: (n) => { n.depends.membership = [{ id: 'part' }]; }, rule: 'R01',
    repair: 'dependency-entry' },
  { name: 'groove without its nominal dependency', change: (_, g) => { g.depends.overlays = []; }, rule: 'R21',
    repair: 'dependency-minimum' },
  { name: 'nominal without the duration dependency', change: (n) => { n.depends.events[0].fields = ['at', 'clip']; },
    rule: 'R21', repair: 'dependency-minimum' },
  { name: 'no provenance', change: (n) => { delete n.provenance; }, rule: 'R12', repair: 'overlay-envelope' },
  { name: 'provenance as text', change: (n) => { n.provenance = 'declared'; }, rule: 'R12', repair: 'overlay-envelope' },
  { name: 'no data', change: (n) => { delete n.data; }, rule: 'R12', repair: 'overlay-data' },
  { name: 'nominal without division', change: (n) => { delete n.data.division; }, rule: 'R13', repair: 'overlay-data' },
];

for (const tool of ['add_launcher_clip', 'edit_launcher_clip'] as const) {
  for (const item of MALFORMED_CLAIMS) {
    test(`8i9 claim repair: ${tool}, ${item.name}: the rule and location, a bounded correction, no host call`, async () => {
      const { workspace, calls } = hostless();
      const [groove, nominal] = knownClaims();
      item.change(nominal!, groove!);
      const record = tool === 'add_launcher_clip' ? 'OVERLAY' : 'OVERLAY_PUT';
      const document = lines(fixtureHead(tool === 'add_launcher_clip' ? 'desired' : 'patch'),
        `${record} ${JSON.stringify(nominal)}`, `${record} ${JSON.stringify(groove)}`) + '\n';
      const result = await call(workspace, tool, { trackId: 'gn-help', row: 0, document });
      const text = JSON.stringify(result);
      assert.deepEqual(calls, [], text.slice(0, 300));
      assert.equal(result['failure']?.code, 'invalid-input', text.slice(0, 300));
      assert.equal(result['failure'].stage, 'input');
      assert.deepEqual(result['failure'].effects, []);
      const detail = result['detail'];
      assert.equal(detail.rule, item.rule, text.slice(0, 400));
      assert.match(detail.path, /^\$\.(overlays|overlayPut)\[\d\]/);
      assert.equal(typeof detail.line, 'number');
      assert.equal(detail.repair?.case, item.repair, text.slice(0, 400));
      assert.deepEqual(detail.repair.reference, { tool: REFERENCE_TOOL, sections: ['Core', 'Timing overlays'] });
      assert.ok(Buffer.byteLength(JSON.stringify(detail.repair)) < 2_048, item.name);
      assert.equal(JSON.stringify(detail.repair).includes('authored-late-template'), false, 'no copy of the input');
    });
  }
}

test('8i9 claim repair: known-source and unknown-source timing faults name the equations; no host call on add', async () => {
  const { workspace, calls } = hostless();
  const mixed = knownClaims();
  delete mixed[0]!.data.sourceAt;
  delete mixed[0]!.data.sourceDuration;
  const unequal = knownClaims();
  unequal[0]!.data.sourceAt = '1/2';
  for (const [claims, rule] of [[mixed, 'R16'], [unequal, 'R15']] as const) {
    const result = await call(workspace, 'add_launcher_clip', { trackId: 'gn-help', row: 0,
      document: lines(fixtureHead('desired'), ...claims.map((claim) => `OVERLAY ${JSON.stringify(claim)}`)) + '\n' });
    assert.equal(result['failure']?.code, 'invalid-input', JSON.stringify(result).slice(0, 300));
    assert.equal(result['detail'].rule, rule);
    assert.equal(result['detail'].repair?.case, 'groove-timing');
    assert.ok(Buffer.byteLength(JSON.stringify(result['detail'].repair)) < 2_048);
  }
  assert.deepEqual(calls, []);
});
