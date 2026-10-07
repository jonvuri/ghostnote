import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse, serialize, validate, contentHash, applyPatch, applyDesired, sealOverlays, dependencyBasis, normalizeTiming, importNotes, observeCells, ImportCollisionError, DocumentError, EVENT_DEFAULTS, EVENT_FIELDS, BINDING, LIMITS, type StateDocument, type Patch, type Document, type Overlay } from './index.js';
import { canonicalJson, readJson } from './json.js';
import { boundedInteger, rational, spelling, cmp, sum } from './rational.js';
import { schema } from './schema-data.js';
const root = new URL('../../../', import.meta.url);
const file = (path: string) => readFileSync(new URL(path, root), 'utf8');
const fixture = (name: string) => parse(file(`spec/ghostnote-document-v1/examples/${name}.json`), 'json') as any;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const fresh = (): StateDocument => ({ format: 'ghostnote-document', version: '1.0', kind: 'desired', clips: [{ id: 'part', length: '4' }], coverage: [{ clip: 'part', from: '0', to: '4', channels: Array.from({ length: 16 }, (_, i) => i + 1), fields: 'all', status: 'complete' }], events: [{ id: 'n1', clip: 'part', at: '0', duration: '1', pitch: 60, velocity: 100 }], overlays: [] });
const patch = (base: StateDocument): Patch => ({ format: 'ghostnote-document', version: '1.0', kind: 'patch', base: { sha256: contentHash(base) }, add: [], remove: [], update: [], clipUpdate: [], overlayPut: [], overlayRemove: [] });
function agree(input: Document): Document {
    const d = validate(input), j = serialize(d, 'json'), f = serialize(d, 'fields');
    assert.deepEqual(parse(j, 'json'), parse(f, 'fields'));
    assert.equal(serialize(parse(f, 'fields'), 'json'), j);
    assert.equal(serialize(parse(j, 'json'), 'fields'), f);
    assert.equal(contentHash(parse(j, 'json')), contentHash(parse(f, 'fields')));
    assert.equal(serialize(parse(j, 'json'), 'json'), j);
    assert.equal(serialize(parse(f, 'fields'), 'fields'), f);
    return d;
}
function rejects(fn: () => unknown, rule?: string, path?: string) {
    assert.throws(fn, (e: any) => {
        assert.ok(e instanceof DocumentError, e?.stack);
        if (rule)
            assert.equal(e.rule, rule);
        if (path)
            assert.ok(e.path.includes(path), e.path);
        return true;
    });
}
function bad(mut: (d: any) => void, rule?: string, name = 'invalid') {
    test(name, () => {
        const d = fresh();
        mut(d);
        rejects(() => parse(JSON.stringify(d), 'json'), rule);
    });
}
function nominal(doc: StateDocument, at = '1/3', division = '1/3'): StateDocument {
    doc.overlays = [{ id: 'nom', type: 'nominal', state: 'current', basis: '0'.repeat(64), provenance: { kind: 'declared', source: 'fixture', method: 'author' }, depends: { events: [{ id: 'n1', fields: ['clip', 'at', 'duration'] }], clips: [], overlays: [], membership: [] }, data: { event: 'n1', at, duration: '1/6', division } }];
    return sealOverlays(doc);
}
const expected = JSON.parse(file('spec/ghostnote-document-v1/examples/expected.json'));
for (const [name, expect] of Object.entries(expected.documents) as [
    string,
    {
        sha256: string;
    }
][])
    test(`C26 C27 golden ${name}`, () => {
        const j = parse(file(`spec/ghostnote-document-v1/examples/${name}.json`), 'json'), f = parse(file(`spec/ghostnote-document-v1/examples/${name}.fields`), 'fields');
        assert.deepEqual(j, f);
        agree(j);
        assert.equal(contentHash(j), expect.sha256);
        assert.equal(serialize(j, 'fields'), file(`spec/ghostnote-document-v1/examples/${name}.fields`));
        assert.equal(serialize(j, 'json'), file(`spec/ghostnote-document-v1/conformance/v1/canonical/${name}.json`));
    });
for (const version of ['1', '1.0.0', '1.1', '2.0'])
    bad(d => d.version = version, 'R01', `C01 version ${version}`);
bad(d => d.format = 'other', 'R01', 'C01 format');
for (const id of ['1bad', 'bad space', 'a'.repeat(129), 'é'])
    bad(d => d.events[0].id = id, id.length > 128 ? 'R28' : 'R01', `C01 ID ${id.slice(0, 12)}`);
for (const field of ['sourceSha256', 'track', 'ownHash', 'pattern', 'audio', 'sysex', 'expressionCurves'])
    bad(d => d[field] = {}, 'R01', `C01 C29 unsupported ${field}`);
test('C01 extension inert data and required behavior', () => {
    const d = fresh();
    d.extensions = { 'vendor:tag': { number: 0.1, timing: '0.3333', list: [2, 1] } };
    const n = agree(d);
    assert.notEqual(contentHash(n), contentHash(fresh()));
    rejects(() => validate(d, { requiredExtensions: ['vendor:tag'] }), 'R01');
    d.extensions = { 'bad': 1 };
    rejects(() => validate(d), 'R01');
});
test('C01 IDs case and separate namespaces', () => {
    const d = fresh();
    d.clips[0].id = 'n1';
    d.coverage[0].clip = 'n1';
    d.events[0].clip = 'n1';
    d.events.push({ ...d.events[0], id: 'N1', at: '1' });
    agree(d);
});
for (const key of ['clips', 'coverage', 'events', 'overlays'])
    bad(d => delete d[key], 'R02', `C02 missing ${key}`);
bad(d => d.kind = 'song', 'R02', 'C02 kind');
bad(d => {
    d.kind = 'snapshot';
    d.base = { sha256: '0'.repeat(64) };
}, 'R02', 'C02 snapshot base');
test('C02 kinds metadata and base domains', () => {
    const d = fresh(), h = contentHash(d);
    agree(d);
    d.meta = {};
    assert.equal(contentHash(d), h);
    d.extensions = {};
    assert.equal(contentHash(d), h);
    d.meta = { title: '' };
    assert.notEqual(contentHash(d), h);
    delete d.meta;
    d.kind = 'snapshot';
    assert.notEqual(contentHash(d), h);
    d.kind = 'desired';
    d.base = { sha256: h, ref: 'external' };
    agree(d);
    assert.notEqual(contentHash(d), h);
    const p = patch(fresh());
    agree(p);
    delete (p as any).base;
    rejects(() => validate(p), 'R08');
});
test('C02 multiple clips single event namespace', () => {
    const d = fresh();
    d.clips.push({ id: 'second', length: '2' });
    d.coverage.push({ ...clone(d.coverage[0]), clip: 'second', to: '2' });
    d.events.push({ ...d.events[0], id: 'n2', clip: 'second' });
    agree(d);
});
for (const name of ['empty', 'empty-clip', 'partial', 'unknown-source'])
    test(`C03 ${name}`, () => {
        agree(fixture(name));
    });
test('C03 unavailable differs from empty and requires reason', () => {
    const d = fresh();
    d.kind = 'snapshot';
    d.events = [];
    d.coverage[0].status = 'unavailable';
    d.coverage[0].reason = 'unobservable';
    agree(d);
    const h = contentHash(d);
    d.coverage[0].status = 'complete';
    assert.notEqual(contentHash(d), h);
    d.coverage[0].status = 'partial';
    delete d.coverage[0].reason;
    rejects(() => validate(d), 'R03');
});
for (const [label, mut] of Object.entries({ outside: (d: any): void => {
        d.events[0].at = '4';
    }, channel: (d: any) => {
        d.kind = 'snapshot';
        d.coverage[0].channels = [2];
    }, unknown: (d: any) => {
        d.kind = 'snapshot';
        d.coverage[0].fields = [...BINDING];
        d.events[0].expression = clone(EVENT_DEFAULTS.expression);
    }, coverage: (d: any) => d.coverage = [], duplicate: (d: any) => d.coverage.push(clone(d.coverage[0])), range: (d: any) => d.clips[0].loop = { from: '3', to: '2' }, end: (d: any) => d.clips[0].playRange = { from: '0', to: '5' }, incomplete: (d: any) => d.coverage[0].fields = [...BINDING] }))
    bad(mut, 'R03', `C03 ${label}`);
test('C03 long duration preserved and covered defaults', () => {
    const d = fresh();
    d.events[0].duration = '8';
    agree(d);
    d.kind = 'snapshot';
    d.coverage[0].fields = [...BINDING];
    const n = agree(d) as StateDocument;
    assert.equal(n.events[0].duration, '8');
    assert.equal(n.events[0].expression, undefined);
    d.events[0].mute = false;
    assert.equal(contentHash(d), contentHash(n));
});
for (const [field, bounds] of Object.entries({ pitch: [0, 127], velocity: [0, 127], channel: [1, 16], releaseVelocity: [0, 1] }))
    for (const value of bounds)
        test(`C04 boundary ${field} ${value}`, () => {
            const d = fresh();
            (d.events[0] as any)[field] = value;
            agree(d);
        });
for (const [field, value] of Object.entries({ pitch: 128, velocity: -1, channel: 0, releaseVelocity: 1.1, mute: 1, articulation: '', expression: { pressure: 0.3 }, chance: { enabled: false }, occurrence: { enabled: false, condition: '' }, recurrence: { enabled: false, length: 2, mask: 4 }, repeat: { enabled: false, count: 129, curve: 0, velocityCurve: 0, velocityEnd: 1 } }))
    bad(d => d.events[0][field] = value, field === 'articulation' || field === 'occurrence' || field === 'expression' || field === 'chance' || field === 'repeat' ? 'R04' : 'R04', `C04 invalid ${field}`);
test('C04 all properties disabled controls pressure overlap adjacency', () => {
    const d = fixture('complete');
    agree(d);
    assert.equal(d.events[0].expression.pressure, 0.6);
    const a = fresh();
    a.events.push({ ...a.events[0], id: 'n2', at: '1/2' }, { ...a.events[0], id: 'n3', at: '3/2' }, { ...a.events[0], id: 'n4', channel: 2 }, { ...a.events[0], id: 'n5', pitch: 61 });
    agree(a);
    assert.equal(a.events[0].duration, '1');
});
bad(d => d.events.push({ ...d.events[0], id: 'other', at: '0/7' }), 'R04', 'C04 reduced address collision');
bad(d => d.events.push({ ...d.events[0], at: '1' }), 'R04', 'C04 duplicate ID');
bad(d => d.events[0].recurrence = { enabled: false, length: 64, mask: 9007199254740992 }, 'R04', 'C04 mask safe bound');
test('C04 recurrence 53 and 64 high bits', () => {
    for (const length of [53, 64]) {
        const d = fresh();
        d.events[0].recurrence = { enabled: false, length, mask: 9007199254740991 };
        agree(d);
    }
});
for (const timing of ['1.0', '1e0', 1, '01', '+1', '1/-2', '1/0', '1 /2'])
    bad(d => d.events[0].at = timing, 'R05', `C05 timing ${timing}`);
test('C05 reductions and large exact values', () => {
    let d = nominal(fresh(), '2/6', '1/3');
    d.overlays[0].data = (d.overlays[0] as any).data;
    assert.equal(((agree(d) as StateDocument).overlays[0].data as any).at, '1/3');
    d = nominal(fresh(), '-0', '1/5');
    agree(d);
    const a = fresh();
    a.events[0].at = '170/512';
    a.events[0].duration = '2/2';
    a.clips[0].length = '2';
    a.coverage[0].to = '2';
    const n = agree(a) as StateDocument;
    assert.equal(n.events[0].at, '85/256');
    assert.equal(n.events[0].duration, '1');
    const big = '9'.repeat(96);
    assert.equal(spelling(rational(`${big}/${big}`)), '1');
    assert.equal(cmp(`${big}/2`, `${big}/3`), 1);
});
for (const value of ['0', '-1', '1/1024', '1/3'])
    bad(d => d.events[0].duration = value, value === '0' || value === '-1' ? 'R05' : 'R06', `C06 duration ${value}`);
bad(d => d.events[0].at = '1/3', 'R06', 'C06 full offgrid');
test('C06 add/update offgrid reject and nominal divisions survive', () => {
    const b = fresh();
    for (const key of ['add', 'update'] as const) {
        const p = patch(b);
        if (key === 'add')
            p.add = [{ ...b.events[0], id: 'added', at: '1/3' }];
        else
            p.update = [{ id: 'n1', set: { at: '1/3' } }];
        rejects(() => validate(p), 'R06');
    }
    for (const division of ['1/3', '1/5', '1/7'])
        agree(nominal(fresh(), division, division));
});
const timingCases = [['1/3', '1/6', '85/256', '85/512', '-1/768', '-1/1536'], ['0', '1/1024', '0', '1/512', '0', '1/1024'], ['0', '1/2048', '0', '1/512', '0', '3/2048'], ['0', '3/1024', '0', '1/256', '0', '1/1024'], ['1/512', '1/512', '1/512', '1/512', '0', '0'], ['1/513', '1/1025', '0', '1/512', '-1/513', '513/524800'], ['1/511', '1/1023', '1/512', '1/512', '-1/261632', '511/523776']];
for (const [at, duration, a, d, ad, dd] of timingCases)
    test(`C07 normalization ${at} ${duration}`, () => {
        const n = normalizeTiming(at, duration);
        assert.equal(n.at, a);
        assert.equal(n.duration, d);
        assert.equal(n.atDelta, ad);
        assert.equal(n.durationDelta, dd);
        const twice = normalizeTiming(n.at, n.duration);
        assert.equal(twice.at, n.at);
        assert.equal(twice.duration, n.duration);
        assert.equal(twice.atDelta, '0');
        assert.equal(twice.durationDelta, '0');
        assert.equal(n.minimumDurationPromotion, duration === '1/2048' || duration === '1/1025');
    });
test('C07 binary64 exact values adjacent cell signed zero and endpoints', () => {
    const n = normalizeTiming(0.1, 0.1);
    assert.equal(n.sourceAt, '3602879701896397/36028797018963968');
    assert.equal(n.at, '51/512');
    assert.equal(normalizeTiming(-0, 1).sourceAt, '0');
    const b = new DataView(new ArrayBuffer(8));
    b.setFloat64(0, 1 / 512);
    const cell = b.getBigUint64(0);
    b.setBigUint64(0, cell - 1n);
    assert.equal(normalizeTiming(b.getFloat64(0), 1).at, '0');
    b.setBigUint64(0, cell + 1n);
    assert.equal(normalizeTiming(b.getFloat64(0), 1).at, '1/512');
    const point = normalizeTiming('1/3', '1/6');
    assert.equal(point.at, '85/256');
    assert.equal(sumForTest(point.at, point.duration), '255/512');
    assert.notEqual(sumForTest(point.at, point.duration), '1/2');
});
function sumForTest(a: string, b: string) {
    return sum(a, b);
}
for (const value of [NaN, Infinity, -Infinity, -0.1])
    test(`C07 bad host onset ${value}`, () => rejects(() => normalizeTiming(value, 1), 'R07'));
for (const value of [0, -1, NaN, Infinity])
    test(`C07 bad duration ${value}`, () => rejects(() => normalizeTiming(0, value), 'R07'));
test('C07 import report collisions and pre-collapsed cells', () => {
    const b = fresh().events[0];
    let report: any;
    assert.throws(() => importNotes([{ ...b, id: 'a', at: '1/1024' }, { ...b, id: 'b', at: '1/2048' }]), (e: any) => {
        assert.ok(e instanceof ImportCollisionError);
        report = e.report;
        return true;
    });
    assert.deepEqual(report.collisionGroups[0].ids, ['a', 'b']);
    assert.equal(report.notes.length, 2);
    const cells = observeCells([{ id: 'survivor', cell: 85n, duration: '1/6' }]);
    assert.equal(cells.collisionCount, null);
    assert.equal(cells.sourceIdsRecovered, false);
    assert.equal(cells.notes[0].at, '85/512');
    assert.equal(cells.notes[0].sourceAt, null);
});
test('C07 import introduced and removed overlap reports', () => {
    const b = fresh().events[0];
    const introduced = importNotes([{ ...b, id: 'a', at: '0', duration: '1/2048' }, { ...b, id: 'b', at: '1/1024', duration: '1/512', pitch: 61 }]);
    assert.ok(introduced.report.notes[0].minimumDurationPromotion);
    assert.ok(introduced.report.changedOverlaps.some(v => !v.before && v.after));
    const removed = importNotes([{ ...b, id: 'a', at: '0', duration: '5/2048' }, { ...b, id: 'b', at: '1/512', duration: '1/512' }]);
    assert.deepEqual(removed.report.changedOverlaps.map(v => [v.before, v.after]), [[true, false]]);
});
test('C08 no-op full add and required arrays', () => {
    const b = fresh(), p = patch(b);
    agree(p);
    p.add = [{ id: 'a', clip: 'part', at: '2', duration: '1', pitch: 61, velocity: 80 }];
    agree(p);
    const r = applyPatch(b, p);
    assert.equal(r.document.events.length, 2);
    for (const field of ['id', 'clip', 'at', 'duration', 'pitch', 'velocity']) {
        const bad = clone(p);
        delete (bad.add[0] as any)[field];
        rejects(() => validate(bad), 'R04');
    }
    for (const array of ['add', 'remove', 'update', 'clipUpdate', 'overlayPut', 'overlayRemove']) {
        const bad = clone(p);
        delete (bad as any)[array];
        rejects(() => validate(bad), 'R08');
    }
});
for (const field of ['id', 'clip'])
    test(`C08 immutable ${field}`, () => {
        const p = patch(fresh());
        p.update = [{ id: 'n1', set: { [field]: 'other' } } as any];
        rejects(() => validate(p), 'R01');
    });
test('C08 annotations remain on proposal and full-state arrays reject', () => {
    const b = fresh(), p = patch(b);
    b.meta = { title: 'base' };
    p.base.sha256 = contentHash(b);
    p.meta = { title: 'proposal' };
    p.extensions = { 'vendor:tag': 1 };
    agree(p);
    assert.deepEqual(clone(applyPatch(b, p).document.meta), { title: 'base' });
    assert.equal(applyPatch(b, p).document.extensions, undefined);
    (p as any).clips = [];
    rejects(() => validate(p), 'R01');
});
test('C09 golden apply atomic result and no-op report', () => {
    const b = fixture('complete'), p = fixture('patch'), r = applyPatch(b, p);
    assert.deepEqual(r.document, fixture('patch-result'));
    assert.deepEqual(r.report.added, ['n4']);
    assert.deepEqual(r.report.removed, ['n3']);
    assert.ok(r.report.clearedDefaults.some(v => v.id === 'n1' && v.fields.includes('expression')));
    assert.equal(contentHash(applyPatch(b, fixture('no-op')).document), contentHash(b));
    assert.deepEqual(applyPatch(b, fixture('no-op')).report, { added: [], removed: [], changedFields: [], clipFields: [], clearedDefaults: [], overlayChanges: [] });
    assert.equal(b.events[0].pitch, 60);
});
test('C09 preservation null reset every optional event field and clip range', () => {
    const complete = fixture('complete') as StateDocument;
    complete.overlays = [];
    for (const field of Object.keys(EVENT_DEFAULTS)) {
        const b = clone(complete), p = patch(b);
        p.update = [{ id: 'n1', set: { [field]: null } }];
        const r = applyPatch(b, p);
        assert.equal((r.document.events.find(e => e.id === 'n1') as any)[field], undefined);
        agree(r.document);
    }
    const b = fresh();
    b.clips[0].name = 'name';
    b.clips[0].loop = { from: '0', to: '4' };
    b.clips[0].playRange = { from: '1', to: '3' };
    const p = patch(b);
    p.clipUpdate = [{ id: 'part', set: { name: null, loop: null, playRange: null } }];
    const r = applyPatch(b, p);
    assert.deepEqual(clone(r.document.clips[0]), { id: 'part', length: '4' });
    const p2 = patch(complete);
    p2.update = [{ id: 'n1', set: { velocity: 70 } }];
    const preserved = applyPatch(complete, p2).document.events.find(e => e.id === 'n1')!;
    assert.deepEqual(preserved.expression, complete.events[0].expression);
});
for (const field of ['at', 'duration', 'pitch', 'velocity'])
    test(`C09 required reset ${field}`, () => {
        const p = patch(fresh());
        p.update = [{ id: 'n1', set: { [field]: null } } as any];
        rejects(() => validate(p));
    });
for (const mode of ['remove', 'update', 'add', 'overlayRemove'] as const)
    test(`C09 missing/existing ${mode}`, () => {
        const b = fresh(), p = patch(b);
        if (mode === 'add')
            p.add = [clone(b.events[0])];
        if (mode === 'remove')
            p.remove = ['missing'];
        if (mode === 'update')
            p.update = [{ id: 'missing', set: { pitch: 61 } }];
        if (mode === 'overlayRemove')
            p.overlayRemove = ['missing'];
        rejects(() => applyPatch(b, p), 'R09');
    });
test('C09 guard partial bases conflicts and final state clip length', () => {
    const b = fresh(), p = patch(b);
    p.base.sha256 = '0'.repeat(64);
    rejects(() => applyPatch(b, p), 'R09');
    const partial = fixture('partial');
    rejects(() => applyPatch(partial, patch(partial)), 'R09');
    const x = patch(b);
    x.update = [{ id: 'n1', set: { velocity: 100 } }];
    assert.equal(applyPatch(b, x).report.changedFields.length, 0);
    x.remove = ['n1'];
    rejects(() => validate(x), 'R09');
    x.remove = [];
    x.update.push(clone(x.update[0]));
    rejects(() => validate(x), 'R09');
    const final = patch(b);
    final.clipUpdate = [{ id: 'part', set: { length: '0' } }];
    rejects(() => applyPatch(b, final), 'R03');
    final.remove = ['n1'];
    const empty = applyPatch(b, final).document;
    assert.equal(empty.events.length, 0);
    assert.equal(empty.clips[0].length, '0');
});
test('C09 desired clears omitted properties inventories and guards', () => {
    const b = fixture('complete') as StateDocument, d = clone(b);
    d.base = { sha256: contentHash(b) };
    d.events = [{ id: 'n1', clip: 'part', at: '1', duration: '1', pitch: 60, velocity: 100 }];
    d.overlays = [];
    const r = applyDesired(b, d);
    assert.equal(r.document.base, undefined);
    assert.equal(r.document.events[0].expression, undefined);
    assert.equal(r.document.events.length, 1);
    assert.equal(r.document.overlays.length, 0);
    agree(r.document);
});
test('C10 permuted binding all slots WITH reserved ID and balanced JSON', () => {
    const d = fresh();
    d.events[0] = { ...d.events[0], ...clone(EVENT_DEFAULTS), articulation: 'phrase with \\ escaped " and \n text', expression: { ...EVENT_DEFAULTS.expression, pressure: 0.7 } };
    d.events[0].id = 'WITH';
    const binding = [...EVENT_FIELDS].reverse(), e = d.events[0] as any;
    const fields = serialize(validate(d), 'fields').split('\n');
    fields.splice(fields.findIndex(l => l.startsWith('FIELDS')), 2, 'FIELDS ' + binding.join(' '), 'EVENT ' + binding.map(k => JSON.stringify(e[k])).join(' '));
    const text = fields.join('\n');
    assert.equal(contentHash(parse(text, 'fields')), contentHash(d));
    const simple = serialize(fresh(), 'fields');
    assert.deepEqual(parse(simple.replace('100 1 false', '100 _ _'), 'fields'), parse(simple, 'fields'));
});
const fieldBase = () => serialize(fresh(), 'fields');
for (const [label, mut] of Object.entries({ binding: (s: string) => s.replace(/^FIELDS.*\n/m, ''), required: (s: string) => s.replace('duration pitch', 'pitch'), width: (s: string) => s.replace('100 1 false', '100 1 false 7'), underwidth: (s: string) => s.replace('100 1 false', '100'), conflict: (s: string) => s.replace('100 1 false', '100 _ false WITH {"channel":1}'), emptyRequired: (s: string) => s.replace('n1 part 0', '_ part 0'), repeat: (s: string) => s + 'FIELDS id clip at duration pitch velocity\n', envelope: (s: string) => s + 'META {}\n', wrongKind: (s: string) => s.replace('EVENT', 'ADD') }))
    test(`C10 invalid ${label}`, () => rejects(() => parse(mut(fieldBase()), 'fields'), 'R10'));
test('C10 forward overlay references body interleaving', () => {
    const d = fixture('unknown-source');
    const lines = serialize(d, 'fields').trimEnd().split('\n'), start = lines.findIndex((l: string) => l.startsWith('FIELDS')) + 1;
    lines.splice(start, lines.length - start, ...lines.slice(start).reverse());
    assert.equal(contentHash(parse(lines.join('\n'), 'fields')), contentHash(d));
});
test('C11 accepted layout scalar Unicode and no normalization', () => {
    const f = fieldBase();
    assert.equal(contentHash(parse('\n\t' + f.trimEnd().split('\n').join(' \t\r\n  ') + ' \t', 'fields')), contentHash(fresh()));
    const d = fresh();
    d.meta = { title: 'é 🎵' };
    assert.equal(contentHash(parse(JSON.stringify(d).replace('é', '\\u00e9'), 'json')), contentHash(d));
    const h = contentHash(d);
    d.meta.title = 'e\u0301 🎵';
    assert.notEqual(contentHash(d), h);
});
for (const [label, text, enc] of [['BOM', '\ufeff' + fieldBase(), 'fields'], ['fence', '```\n' + fieldBase(), 'fields'], ['comment', fieldBase() + '# comment', 'fields'], ['header', fieldBase() + 'DOC ghostnote-document 1.0 desired', 'fields'], ['extra', fieldBase() + 'hello', 'fields'], ['comma', '{"format":"ghostnote-document",}', 'json'], ['duplicate', '{"format":"a","format":"b"}', 'json'], ['surrogate', '"\\ud800"', 'json'], ['overflow', '1e999', 'json']] as const)
    test(`C11 reject ${label}`, () => rejects(() => parse(text, enc), label === 'header' || label === 'comment' || label === 'extra' ? 'R01' : label === 'fence' ? 'R10' : label === 'overflow' ? 'R29' : 'R11'));
test('C11 invalid UTF8 and native nonJSON reject', () => {
    rejects(() => parse(new Uint8Array([0xc0, 0xaf]), 'json'), 'R11');
    const d: any = fresh();
    d.meta = { title: '\ud800' };
    rejects(() => validate(d), 'R11');
    d.meta = undefined;
    rejects(() => validate(d), 'R29');
});
for (const kind of ['declared', 'measured', 'inferred'] as const)
    test(`C12 provenance ${kind}`, () => {
        const d = nominal(fresh());
        d.overlays[0].provenance.kind = kind;
        agree(sealOverlays(d));
    });
for (const value of [0, 1])
    test(`C12 confidence ${value}`, () => {
        const d = nominal(fresh());
        d.overlays[0].provenance.confidence = value;
        agree(sealOverlays(d));
    });
for (const field of ['state', 'provenance', 'basis', 'depends'])
    test(`C12 missing ${field}`, () => {
        const d = nominal(fresh());
        delete (d.overlays[0] as any)[field];
        rejects(() => validate(d), 'R12');
    });
test('C12 bad confidence and stable revised IDs', () => {
    const d = nominal(fresh());
    d.overlays[0].provenance.confidence = 1.1;
    rejects(() => validate(d), 'R12');
    delete d.overlays[0].provenance.confidence;
    const p = patch(d), next = clone(d.overlays[0]);
    next.provenance.method = 'reaffirm';
    p.overlayPut = [next];
    assert.equal(applyPatch(d, p).document.overlays[0].id, 'nom');
});
test('C13 nominal lattice dependency uniqueness and removal', () => {
    const d = nominal(fresh());
    const invalid = clone(d);
    (invalid.overlays[0] as any).data.at = '1/4';
    rejects(() => sealOverlays(invalid), 'R13');
    invalid.overlays[0] = clone(d.overlays[0]);
    invalid.overlays[0].depends.events[0].fields = ['at'];
    rejects(() => validate(invalid), 'R21');
    const duplicate = clone(d);
    duplicate.overlays.push({ ...clone(d.overlays[0]), id: 'nom2' });
    rejects(() => sealOverlays(duplicate), 'R13');
    const p = patch(d);
    p.overlayRemove = ['nom'];
    assert.deepEqual(applyPatch(d, p).document.events, d.events);
});
function unknown(): StateDocument {
    const d = fixture('unknown-source');
    d.events = d.events.filter((e: any) => e.id === 'n2');
    d.overlays = d.overlays.filter((o: any) => o.id === 'nominal2' || o.id === 'groove2');
    return d;
}
function groove(d: StateDocument): any {
    return d.overlays.find(o => o.type === 'groove')!;
}
test('C14 optional groove template swing shape and anchor', () => {
    const d = fixture('complete') as StateDocument;
    const g = groove(d);
    g.data.templateRef = 'swing name';
    g.data.swing = [17, 15];
    g.data.shape = { kind: 'span', width: '1/8' };
    g.data.anchor = 'n3';
    g.depends.events.push({ id: 'n3', fields: ['clip', 'at'] });
    agree(sealOverlays(d));
    g.data.shape = { kind: 'point' };
    agree(sealOverlays(d));
    g.data.swing = [1, 0];
    rejects(() => sealOverlays(d));
});
test('C14 groove bad pair width anchor and duplicate', () => {
    const d = fixture('complete') as StateDocument;
    const g = groove(d);
    delete g.data.sourceDuration;
    rejects(() => validate(d), 'R14');
    const u = unknown();
    groove(u).data.shape = { kind: 'span', width: '0' };
    rejects(() => validate(u), 'R05');
    const dup = unknown();
    dup.overlays.push({ ...clone(groove(dup)), id: 'duplicate' });
    rejects(() => sealOverlays(dup), 'R14');
});
test('C14 C15 groove transfer writes target nominal realized plane', () => {
    const d = fixture('complete') as StateDocument;
    const source: any = d.overlays.find(o => o.type === 'groove' && o.data.event === 'n1');
    const target = source.data;
    const n = fresh();
    n.events[0].at = '33/64';
    n.events[0].duration = '1/4';
    const nominalOverlay: any = clone(d.overlays.find(o => o.type === 'nominal' && o.data.event === 'n1'));
    nominalOverlay.id = 'targetNom';
    nominalOverlay.data.at = '1/2';
    nominalOverlay.data.duration = '1/4';
    nominalOverlay.data.division = '1/4';
    const copied: any = clone(source);
    copied.id = 'targetGroove';
    copied.data.nominal = 'targetNom';
    copied.data.sourceAt = '33/64';
    copied.depends.overlays = ['targetNom'];
    n.overlays = [nominalOverlay, copied];
    const result = sealOverlays(n);
    agree(result);
    assert.equal(groove(result).data.template, target.template);
    assert.equal(result.events[0].at, '33/64');
});
for (const field of ['sourceAt', 'atDelta', 'sourceDuration', 'durationDelta'])
    test(`C15 mismatched ${field}`, () => {
        const d = fixture('complete');
        const g = groove(d);
        g.data[field] = '1/512';
        rejects(() => sealOverlays(d), 'R15');
    });
test('C15 signed components measured authority and resolved residuals', () => {
    const d = fixture('complete');
    const g: any = d.overlays.find((o: any) => o.type === 'groove' && o.data.event === 'n1');
    g.data.phase = '-1/64';
    g.data.local = '1/64';
    g.provenance.kind = 'inferred';
    agree(sealOverlays(d));
    g.data.unassigned = '1/64';
    rejects(() => sealOverlays(d), 'R15');
    g.data.unassigned = '0';
    g.provenance.kind = 'measured';
    rejects(() => sealOverlays(d), 'R15');
});
for (const [field, value] of Object.entries({ atDelta: '0', intent: 'resolved', phase: '1/512', unassigned: '0', durationUnassigned: '0' }))
    test(`C16 unknown source ${field}`, () => {
        const d = unknown();
        groove(d).data[field] = value;
        rejects(() => sealOverlays(d), 'R16');
    });
function group(type: 'harmony' | 'role' | 'motif' | 'region', doc = fresh(), members = ['n1']): StateDocument {
    const data: any = { clip: 'part', events: members };
    if (type === 'harmony') {
        data.from = '0';
        data.to = '2';
        data.chord = 'C strange opaque';
    }
    else {
        data.label = type;
        if (type === 'region') {
            data.from = '0';
            data.to = '2';
        }
        else
            data.articulation = 'legato interpretation';
    }
    doc.overlays = [{ id: type, type, state: 'current', provenance: { kind: 'declared', source: 'fixture', method: 'author' }, basis: '0'.repeat(64), depends: { events: members.map(id => ({ id, fields: type === 'region' ? ['clip', 'at'] : ['clip', 'pitch', 'at', 'duration'] })), clips: [{ id: 'part', fields: ['length'] }], membership: ['part'], overlays: [] }, data } as Overlay];
    return sealOverlays(doc);
}
for (const type of ['harmony', 'role', 'motif', 'region'] as const)
    test(`C17 C18 C20 ${type} current groups membership lifecycle`, () => {
        const d = group(type), before = contentHash(d);
        agree(d);
        const empty = group(type, fresh(), []);
        agree(empty);
        const p = patch(d);
        p.add = [{ ...d.events[0], id: 'new', at: '3' }];
        const r = applyPatch(d, p);
        assert.equal(r.document.overlays[0].state, 'stale');
        assert.deepEqual((r.document.overlays[0].data as any).events, ['n1']);
        assert.notEqual(contentHash(r.document), before);
        assert.equal(r.document.events[0].articulation, undefined);
        const bad = clone(d);
        (bad.overlays[0].data as any).clip = 'missing';
        rejects(() => sealOverlays(bad), 'R21');
        const missing = clone(d);
        missing.overlays[0].depends.membership = [];
        rejects(() => sealOverlays(missing), 'R21');
    });
test('C17 harmony chord/key/both labels and bad span', () => {
    for (const labels of [{ chord: 'C' }, { key: 'C major' }, { chord: 'C', key: 'C' }]) {
        const d = group('harmony');
        d.overlays[0].data = { clip: 'part', from: '0', to: '2', events: ['n1'], ...labels } as any;
        agree(sealOverlays(d));
    }
    const bad = group('harmony');
    (bad.overlays[0].data as any).from = '1';
    rejects(() => sealOverlays(bad), 'R17');
});
test('C18 role motif opaque labels do not expand notes', () => {
    for (const type of ['role', 'motif'] as const) {
        const d = group(type);
        (d.overlays[0].data as any).label = 'bass or melody';
        const before = clone(d.events);
        agree(sealOverlays(d));
        assert.deepEqual(clone(d.events), before);
    }
});
function context(type: 'meter' | 'tempo', at = '0', doc = fresh()): StateDocument {
    const clip = doc.clips[0].id;
    doc.overlays = [{ id: type, type, state: 'current', basis: '0'.repeat(64), provenance: { kind: 'declared', source: 'fixture', method: 'author' }, depends: { events: [], clips: [{ id: clip, fields: ['length'] }], overlays: [], membership: [] }, data: type === 'meter' ? { clip, at, numerator: 4, denominator: 4 } : { clip, at, bpm: 120 } } as Overlay];
    return sealOverlays(doc);
}
for (const denominator of [1, 2, 4, 8, 16, 32, 64])
    test(`C19 meter denominator ${denominator}`, () => {
        const d = context('meter');
        (d.overlays[0].data as any).denominator = denominator;
        (d.overlays[0].data as any).numerator = denominator === 8 ? 7 : 4;
        agree(sealOverlays(d));
    });
for (const [field, value] of [['numerator', 0], ['numerator', 65], ['denominator', 3]] as const)
    test(`C19 invalid meter ${field} ${value}`, () => {
        const d = context('meter');
        (d.overlays[0].data as any)[field] = value;
        rejects(() => sealOverlays(d), 'R19');
    });
for (const bpm of [0.001, 1000])
    test(`C19 BPM ${bpm}`, () => {
        const d = context('tempo');
        (d.overlays[0].data as any).bpm = bpm;
        agree(sealOverlays(d));
    });
for (const bpm of [0, -1, 1001])
    test(`C19 invalid BPM ${bpm}`, () => {
        const d = context('tempo');
        (d.overlays[0].data as any).bpm = bpm;
        rejects(() => sealOverlays(d), 'R19');
    });
test('C19 points at empty clip zero late context and uniqueness', () => {
    for (const type of ['meter', 'tempo'] as const) {
        agree(context(type, '0', fixture('empty-clip')));
        const d = context(type, '1');
        d.overlays.push({ ...clone(d.overlays[0]), id: 'later', data: { ...d.overlays[0].data, at: '2' } } as Overlay);
        agree(sealOverlays(d));
        d.overlays.push({ ...clone(d.overlays[0]), id: 'duplicate' });
        rejects(() => sealOverlays(d), 'R19');
    }
});
test('C20 overlapping regions membership span and empty clip', () => {
    const d = group('region');
    d.overlays.push({ ...clone(d.overlays[0]), id: 'also' });
    agree(sealOverlays(d));
    const invalid = group('region');
    (invalid.overlays[0].data as any).from = '1';
    rejects(() => sealOverlays(invalid), 'R20');
    const empty = fixture('empty-clip');
    empty.overlays = clone(d.overlays);
    empty.overlays.forEach((o: any) => {
        o.data.events = [];
        o.depends.events = [];
        o.data.clip = 'empty';
        o.depends.clips[0].id = 'empty';
        o.depends.membership = ['empty'];
    });
    rejects(() => sealOverlays(empty), 'R20');
});
for (const state of ['current', 'stale'] as const)
    for (const ref of ['event', 'clip', 'overlay', 'anchor'])
        test(`C21 dangling ${ref} ${state}`, () => {
            const d = unknown(), g = groove(d);
            g.state = state;
            if (ref === 'event')
                g.data.event = 'missing';
            if (ref === 'clip')
                g.depends.membership = ['missing'];
            if (ref === 'overlay')
                g.data.nominal = 'missing';
            if (ref === 'anchor')
                g.data.anchor = 'missing', g.depends.events.push({ id: 'missing', fields: ['clip', 'at'] });
            rejects(() => validate(d), 'R21');
        });
test('C21 duplicate dependencies paths cycles self and current on stale', () => {
    const d = nominal(fresh());
    const cases = [(x: any) => x.overlays[0].depends.events.push(clone(x.overlays[0].depends.events[0])), (x: any) => x.overlays[0].depends.events[0].fields.push('at'), (x: any) => x.overlays[0].depends.events[0].fields.push('unknown'), (x: any) => x.overlays[0].depends.overlays.push('nom')];
    for (const mut of cases) {
        const x = clone(d);
        mut(x);
        rejects(() => validate(x), 'R21');
    }
    const u = unknown();
    u.overlays.find(o => o.type === 'nominal')!.depends.overlays = [groove(u).id];
    rejects(() => validate(u), 'R21');
    const stale = unknown();
    stale.overlays.find(o => o.type === 'nominal')!.state = 'stale';
    rejects(() => validate(stale), 'R21');
});
test('C21 deletion explicit removals nonmember removal invalidates membership', () => {
    const d = group('role');
    d.events.push({ ...d.events[0], id: 'nonmember', at: '3' });
    const base = sealOverlays(d);
    const p = patch(base);
    p.remove = ['nonmember'];
    assert.equal(applyPatch(base, p).document.overlays[0].state, 'stale');
    const x = patch(base);
    x.remove = ['n1'];
    rejects(() => applyPatch(base, x), 'R21');
    x.overlayRemove = ['role'];
    assert.equal(applyPatch(base, x).document.overlays.length, 0);
});
test('C22 independent default projection digest and dependency order', () => {
    const d = nominal(fresh());
    d.overlays[0].depends.events[0].fields = ['channel', 'duration', 'clip', 'at'];
    const sealed = sealOverlays(d), o = sealed.overlays[0];
    const projection = '{"clips":[],"events":[{"id":"n1","values":{"at":"0","channel":1,"clip":"part","duration":"1"}}],"membership":[],"overlays":[]}';
    const expected = createHash('sha256').update('ghostnote-dependencies/1.0\n' + projection).digest('hex');
    assert.equal(o.basis, expected);
    const permuted = clone(sealed);
    permuted.overlays[0].depends.events[0].fields.reverse();
    agree(permuted);
    assert.equal(contentHash(permuted), contentHash(sealed));
    const v = clone(sealed);
    v.events[0].velocity = 50;
    assert.equal(dependencyBasis(v, o), expected);
    v.events[0].at = '1';
    assert.notEqual(dependencyBasis({ ...v, overlays: [] }, o), expected);
});
test('C22 overlay basis omitted recursively data provenance state included', () => {
    const d = unknown(), g = groove(d), nom = d.overlays.find(o => o.type === 'nominal')!;
    const projectionBase = clone(d);
    projectionBase.overlays.forEach(o => o.state = 'stale');
    g.state = 'stale';
    const original = dependencyBasis(projectionBase, g);
    projectionBase.overlays.find(o => o.type === 'nominal')!.basis = 'f'.repeat(64);
    assert.equal(dependencyBasis(projectionBase, g), original);
    projectionBase.overlays.find(o => o.type === 'nominal')!.provenance.method = 'other';
    assert.notEqual(dependencyBasis(projectionBase, g), original);
    const bad = clone(d);
    bad.overlays.find(o=>o.type==='nominal')!.basis = 'f'.repeat(64);
    rejects(() => validate(bad), 'R22');
    assert.equal(nom.state, 'current');
});
test('C23 velocity preserves timing edit propagates stale explicit reaffirm undo', () => {
    const base = unknown(), p = patch(base);
    p.update = [{ id: base.events[0].id, set: { velocity: 50 } }];
    assert.ok(applyPatch(base, p).document.overlays.every(o => o.state === 'current'));
    p.update = [{ id: base.events[0].id, set: { at: '1/2' } }];
    const stale = applyPatch(base, p).document;
    assert.ok(stale.overlays.every(o => o.state === 'stale'));
    assert.deepEqual(stale.overlays.map(o => o.basis), base.overlays.map(o => o.basis));
    const undo = patch(stale);
    undo.update = [{ id: base.events[0].id, set: { at: base.events[0].at } }];
    const restored = applyPatch(stale, undo).document;
    assert.ok(restored.overlays.every(o => o.state === 'stale'));
    const reaffirm = patch(restored);
    reaffirm.overlayPut = clone(base.overlays);
    assert.ok(applyPatch(restored, reaffirm).document.overlays.every(o => o.state === 'current'));
    const desired = clone(stale);
    desired.base = { sha256: contentHash(base) };
    assert.ok(applyDesired(base, desired).document.overlays.every(o => o.state === 'stale'));
});
test('C24 stale previous span equations uniqueness and references', () => {
    const d = unknown();
    d.overlays.forEach(o => o.state = 'stale');
    groove(d).data.unassigned = '-8';
    agree(d);
    const groupDoc = group('harmony');
    groupDoc.overlays[0].state = 'stale';
    (groupDoc.overlays[0].data as any).to = '8';
    agree(groupDoc);
    const dup = nominal(fresh());
    dup.overlays.push({ ...clone(dup.overlays[0]), id: 'previous', state: 'stale' });
    agree(dup);
    (dup.overlays[1].data as any).duration = '-1';
    rejects(() => validate(dup), 'R05');
});
test('C25 default omission sets ordering swing and extensions order', () => {
    const b = fresh(), d = clone(b);
    Object.assign(d.events[0], clone(EVENT_DEFAULTS));
    d.clips[0].name = '';
    d.clips[0].loop = null;
    d.clips[0].playRange = null;
    d.meta = {};
    d.extensions = {};
    d.coverage[0].fields = [...EVENT_FIELDS].reverse();
    d.coverage[0].channels.reverse();
    assert.equal(contentHash(d), contentHash(b));
    const full = fixture('complete');
    full.overlays.reverse();
    full.events.reverse();
    full.overlays.forEach((o: any) => {
        o.depends.events.reverse();
        o.depends.clips.reverse();
        o.depends.membership.reverse();
        o.depends.overlays.reverse();
        o.depends.events.forEach((x: any) => x.fields.reverse());
        o.depends.clips.forEach((x: any) => x.fields.reverse());
        if (o.data.events)
            o.data.events.reverse();
    });
    assert.equal(contentHash(full), contentHash(fixture('complete')));
    const x = fresh();
    x.extensions = { 'v:list': [2, 1] };
    const h = contentHash(x);
    x.extensions['v:list'] = [1, 2];
    assert.notEqual(contentHash(x), h);
});
test('C26 scalar key order controls numbers and final newlines', () => {
    const d = fresh();
    d.extensions = { 'v:data': { '2': 'two', '10': 'ten', '\ue000': 'BMP', '𐀀': 'astral', controls: '\b\t\n\f\r\u0001/"\\', num: -0 } };
    d.meta = { title: 'literal 🎵' };
    const j = serialize(d, 'json');
    assert.ok(j.indexOf('"10"') < j.indexOf('"2"'));
    assert.ok(j.indexOf('\ue000') < j.indexOf('𐀀'));
    assert.ok(j.includes('\\b\\t\\n\\f\\r\\u0001/'));
    assert.ok(j.includes('"num":0'));
    assert.ok(!j.endsWith('\n'));
    assert.ok(serialize(d, 'fields').endsWith('\n'));
    agree(d);
    const n = fresh();
    n.events[0].releaseVelocity = 0.5;
    assert.equal(contentHash(parse(JSON.stringify(n).replace('0.5', '5e-1'), 'json')), contentHash(n));
});
test('C27 content domains renamed IDs coverage provenance base distinct', () => {
    const d = fresh(), h = contentHash(d);
    const renamed = clone(d);
    renamed.events[0].id = 'changed';
    assert.notEqual(contentHash(renamed), h);
    const snapshot = clone(d);
    snapshot.kind = 'snapshot';
    snapshot.coverage[0].fields = [...BINDING];
    assert.notEqual(contentHash(snapshot), h);
    const overlay = nominal(fresh()), oh = contentHash(overlay);
    overlay.overlays[0].provenance.kind = 'inferred';
    assert.notEqual(contentHash(sealOverlays(overlay)), oh);
    const guarded = clone(d);
    guarded.base = { sha256: h };
    assert.notEqual(contentHash(guarded), h);
    assert.notEqual(contentHash(patch(d)), h);
    assert.notEqual(contentHash(nominal(fresh())), nominal(fresh()).overlays[0].basis);
});
test('C28 byte limit exact input boundary and plus one', () => {
    const text = serialize(fresh(), 'json');
    const padded = text + ' '.repeat(LIMITS.bytes - Buffer.byteLength(text));
    assert.equal(contentHash(parse(padded, 'json')), contentHash(fresh()));
    rejects(() => parse(padded + ' ', 'json'), 'R28');
});
test('C28 IDs strings depth digits and integer arithmetic boundaries', () => {
    const d = fresh();
    d.events[0].id = 'a'.repeat(128);
    d.meta = { title: '🎵'.repeat(4096) };
    agree(d);
    d.meta.title += 'a';
    rejects(() => validate(d), 'R28');
    const deep = fresh();
    let v: any = null;
    for (let i = 0; i < 30; i++)
        v = [v];
    deep.extensions = { 'v:deep': v };
    agree(deep);
    deep.extensions['v:deep'] = [v];
    rejects(() => validate(deep), 'R28');
    assert.equal(spelling(rational('9'.repeat(96))), '9'.repeat(96));
    rejects(() => rational('9'.repeat(97)), 'R28');
    rejects(() => rational('1/' + '9'.repeat(97)), 'R28');
    assert.equal(boundedInteger((1n << 4096n) - 1n), (1n << 4096n) - 1n);
    rejects(() => boundedInteger(1n << 4096n), 'R28');
    rejects(() => normalizeTiming(Number.MIN_VALUE, 1), 'R28');
});
for (const [key, max] of Object.entries({ clips: 256, coverage: 256, events: 131072, overlays: 32768 }))
    test(`C28 count ${key} plus one`, () => {
        const d: any = fresh();
        d[key] = new Array(max + 1).fill(null);
        rejects(() => validate(d), 'R28');
    });
test('C28 256 clips 32768 overlays and count bounds', () => {
    const clips = fresh();
    clips.clips = [];
    clips.coverage = [];
    clips.events = [];
    for (let i = 0; i < 256; i++) {
        const id = 'c' + i;
        clips.clips.push({ id, length: '0' });
        clips.coverage.push({ clip: id, from: '0', to: '0', channels: Array.from({ length: 16 }, (_, i) => i + 1), fields: 'all', status: 'complete' });
    }
    agree(clips);
    const overlays = nominal(fresh());
    const template = overlays.overlays[0];
    overlays.overlays = [];
    for (let i = 0; i < 32768; i++)
        overlays.overlays.push({ ...clone(template), id: 'o' + i, state: 'stale' });
    // This count fits the array limit. Its canonical encodings exceed the byte limit.
    rejects(() => validate(overlays), 'R28');
    const p = patch(fresh());
    p.remove = Array.from({ length: 131072 }, (_, i) => 'n' + i);
    agree(p);
    p.update = [{ id: 'other', set: { pitch: 61 } }];
    rejects(() => validate(p), 'R28');
});
test('C28 dependency and field reference limits', () => {
    const base = fresh();
    base.events = [];
    base.clips[0].length = '2048';
    base.coverage[0].to = '2048';
    for (let i = 0; i < 1024; i++)
        base.events.push({ id: 'n' + i, clip: 'part', at: String(i), duration: '1', pitch: 60, velocity: 80 });
    const o: any = { id: 'nom', type: 'nominal', state: 'stale', basis: '0'.repeat(64), provenance: { kind: 'declared', source: 'test', method: 'bound' }, depends: { events: base.events.map(e => ({ id: e.id, fields: ['clip', 'at', 'duration'] })), clips: [], overlays: [], membership: [] }, data: { event: 'n0', at: '0', duration: '1', division: '1' } };
    base.overlays = [o];
    agree(base);
    const extra = clone(base);
    extra.overlays[0].depends.membership = ['part'];
    rejects(() => validate(extra), 'R28');
    const refs = clone(base);
    (refs.overlays[0] as any).depends.events.forEach((e: any) => e.fields = [...EVENT_FIELDS]);
    refs.overlays = [];
    for (let i = 0; i < 18; i++)
        refs.overlays.push({ ...clone(o), id: 'o' + i });
    refs.overlays.forEach(x => x.depends.events.forEach(e => e.fields = [...EVENT_FIELDS]));
    rejects(() => validate(refs), 'R28');
});
test('C29 rule path field and FIELDS line column failures', () => {
    const raw = fieldBase().replace('n1 part 0', 'n1 part 1/3');
    assert.throws(() => parse(raw, 'fields'), (e: any) => {
        assert.equal(e.rule, 'R06');
        assert.equal(e.field, 'at');
        assert.equal(e.line, 5);
        assert.equal(e.column, 15);
        return true;
    });
    const json = JSON.stringify({ ...fresh(), events: [{ ...fresh().events[0], at: '1/3' }] });
    assert.throws(() => parse(json, 'json'), (e: any) => {
        assert.equal(e.rule, 'R06');
        assert.ok(e.path.includes('at'));
        assert.equal(e.line, 1);
        assert.ok(e.column > 1);
        return true;
    });
});
test('C29 retained header renamed extra notes empty regressions', () => {
    rejects(() => parse(fieldBase().replace('ghostnote-document 1.0', 'ghostnote-document'), 'fields'), 'R10');
    rejects(() => parse('', 'fields'), 'R10');
    const base = fresh(), p = patch(base);
    p.update = [{ id: 'renamed', set: { pitch: 62 } }];
    rejects(() => applyPatch(base, p), 'R09');
    const extra = clone(base);
    extra.events.push({ ...base.events[0], id: 'extra', at: '2' });
    agree(extra);
    assert.notEqual(contentHash(extra), contentHash(base));
    assert.notEqual(extra.events.length, base.events.length);
    const zero = clone(base);
    zero.events = [];
    agree(zero);
    assert.equal(zero.coverage[0].status, 'complete');
});
test('C30 pure pressure preservation portable defaults snapshot authority', () => {
    const d = fresh();
    d.events[0].expression = { ...EVENT_DEFAULTS.expression, pressure: 0.8 };
    const result = applyPatch(d, patch(d)).document;
    assert.equal(result.events[0].expression!.pressure, 0.8);
    assert.equal(result.events[0].releaseVelocity, undefined);
    const snapshot = fixture('partial');
    assert.equal(snapshot.coverage[0].status, 'partial');
    agree(snapshot);
});
test('C31 corpus owner rule index all 32 families and golden provenance', () => {
    const inventory = JSON.parse(file('spec/ghostnote-document-v1/conformance/v1/manifest.json'));
    assert.equal(inventory.owner, '8f2 reference codec');
    assert.equal(inventory.rules.length, 32);
    for (let i = 1; i <= 32; i++)
        assert.equal(inventory.rules[i - 1].rule, 'R' + String(i).padStart(2, '0'));
    assert.equal(inventory.regressions.length, 4);
    for (const item of inventory.regressions)
        assert.ok(file(item.source).length > 0);
});
test('C32 schema copy meta-schema compilation valid fixtures semantic boundary', () => {
    const normative = JSON.parse(file('spec/ghostnote-document-v1/schema.json'));
    assert.deepEqual(schema, normative);
    const Ajv = (Ajv2020 as any).default ?? Ajv2020, ajv = new Ajv({ strict: false, allErrors: true });
    assert.equal(ajv.validateSchema(normative), true);
    const structural = ajv.compile(normative);
    for (const name of Object.keys(expected.documents))
        assert.equal(structural(fixture(name)), true, JSON.stringify(structural.errors));
    const d = fresh();
    d.events[0].at = '1/3';
    assert.equal(structural(d), true);
    rejects(() => validate(d), 'R06');
});
for (const [field, lo, hi] of [['velocitySpread', 0, 1], ['gain', 0, 8], ['pan', -1, 1], ['pressure', 0, 1], ['timbre', 0, 1], ['transpose', -128, 128]] as const)
    for (const value of [lo, hi])
        test(`C04 expression ${field} ${value}`, () => {
            const d = fresh();
            d.events[0].expression = { ...EVENT_DEFAULTS.expression, [field]: value };
            agree(d);
            const bad = clone(d);
            bad.events[0].expression![field] = hi + 1;
            rejects(() => validate(bad), 'R04');
        });
for (const field of ['chance', 'occurrence', 'recurrence', 'repeat'] as const)
    test(`C04 disabled ${field} retains values`, () => {
        const d = fixture('complete') as StateDocument;
        d.overlays = [];
        d.events[0][field]!.enabled = false;
        const n = agree(d) as StateDocument;
        assert.equal(n.events[0][field]!.enabled, false);
        const other = clone(n);
        delete other.events[0][field];
        assert.notEqual(contentHash(n), contentHash(other));
    });
test('C08 all editable fields are complete atomic updates', () => {
    const d = fixture('complete') as StateDocument;
    d.overlays = [];
    const source = d.events[0], base = fresh(), p = patch(base), set: any = {};
    for (const [field, value] of Object.entries(source))
        if (field !== 'id' && field !== 'clip')
            set[field] = value;
    p.update = [{ id: 'n1', set }];
    agree(p);
    const result = applyPatch(base, p);
    assert.deepEqual(result.document.events[0], validate({ ...base, events: [source] }).kind === 'patch' ? null : (validate({ ...base, events: [source] }) as StateDocument).events[0]);
});
test('C09 operation order independence overlay conflict clip reset length', () => {
    const b = fresh(), p = patch(b);
    p.add = [{ ...b.events[0], id: 'z', at: '3' }, { ...b.events[0], id: 'a', at: '2' }];
    const r = applyPatch(b, p);
    p.add.reverse();
    assert.equal(contentHash(applyPatch(b, p).document), contentHash(r.document));
    const invalid = patch(b);
    invalid.overlayPut = nominal(b).overlays;
    invalid.overlayRemove = ['nom'];
    rejects(() => validate(invalid), 'R09');
    const c = patch(fresh());
    c.clipUpdate = [{ id: 'part', set: { length: null } } as any];
    rejects(() => validate(c), 'R05');
});
test('C09 desired unchanged current claim on changed timing refuses', () => {
    const b = nominal(fresh()), d = clone(b);
    d.events[0].at = '1';
    d.base = { sha256: contentHash(b) };
    rejects(() => applyDesired(b, d), 'R22');
});
test('C10 repeated singleton envelope missing binding empty wrong record', () => {
    for (const word of ['META', 'EXTENSIONS', 'BASE']) {
        const text = fieldBase().replace('CLIP ', `${word} {}\n${word} {}\nCLIP `);
        rejects(() => parse(text, 'fields'), 'R10');
    }
    rejects(() => parse('DOC ghostnote-document 1.0 desired', 'fields'), 'R10');
    rejects(() => parse(fieldBase() + 'REMOVE n1\n', 'fields'), 'R10');
});
test('C11 carriage returns unescaped controls forbidden JSON layouts', () => {
    rejects(() => parse('DOC ghostnote-document 1.0 desired\rFIELDS id clip at duration pitch velocity', 'fields'));
    rejects(() => parse('{"title":"raw\nnewline"}', 'json'), 'R11');
    rejects(() => parse('{/* comment */}', 'json'), 'R11');
    rejects(() => parse('[1,]', 'json'), 'R11');
});
test('C14 anchor same clip requirement', () => {
    const d = fixture('complete') as StateDocument;
    d.clips.push({ id: 'other', length: '4' });
    d.coverage.push({ ...clone(d.coverage[0]), clip: 'other' });
    d.events.push({ id: 'anchor', clip: 'other', at: '0', duration: '1', pitch: 60, velocity: 80 });
    const g = groove(d);
    g.data.anchor = 'anchor';
    g.depends.events.push({ id: 'anchor', fields: ['clip', 'at'] });
    rejects(() => sealOverlays(d), 'R14');
});
test('C16 local tempo display context dependency and stale exclusion', async () => {
    const { timingDisplay } = await import('./index.js');
    const late = context('tempo', '1');
    assert.equal(timingDisplay(late, 'part', '0', '1/64'), null);
    const ms = timingDisplay(late, 'part', '1', '1/64')!;
    assert.equal(ms.milliseconds, '125/16');
    assert.deepEqual(ms.dependsOverlays, ['tempo']);
    late.overlays[0].state = 'stale';
    assert.equal(timingDisplay(late, 'part', '1', '1/64'), null);
    const conflicting = context('tempo');
    conflicting.overlays.push({ ...clone(conflicting.overlays[0]), id: 'conflict' });
    rejects(() => timingDisplay(conflicting, 'part', '1', '1/64'), 'R19');
});
test('C22 sorting overlay dependency data and field definitions', () => {
    const d = fixture('complete') as StateDocument, g = groove(d);
    g.depends.overlays.push('harmony1');
    const base = sealOverlays(d), reordered = clone(base);
    const harmony: any = reordered.overlays.find(o => o.id === 'harmony1');
    harmony.data.events.reverse();
    harmony.depends.events.reverse();
    harmony.depends.events.forEach((e: any) => e.fields.reverse());
    assert.equal(contentHash(reordered), contentHash(base));
});
test('C28 each patch count and group count plus one', () => {
    for (const [key, max] of Object.entries({ add: 131072, remove: 131072, update: 131072, clipUpdate: 256, overlayPut: 32768, overlayRemove: 32768 })) {
        const p: any = patch(fresh());
        p[key] = new Array(max + 1).fill(null);
        rejects(() => validate(p), 'R28');
    }
    const d = group('role');
    (d.overlays[0].data as any).events = new Array(131073).fill('n1');
    rejects(() => validate(d), 'R28');
});
test('C28 exact field-reference threshold accepted plus one rejected', () => {
    const d = fresh();
    d.clips[0].length = '2048';
    d.coverage[0].to = '2048';
    d.events = [];
    for (let i = 0; i < 1024; i++)
        d.events.push({ id: 'n' + i, clip: 'part', at: String(i), duration: '1', pitch: 60, velocity: 80 });
    const o: any = { id: 'o', type: 'nominal', state: 'stale', basis: '0'.repeat(64), provenance: { kind: 'declared', source: 'test', method: 'bound' }, depends: { events: d.events.map(e => ({ id: e.id, fields: [...EVENT_FIELDS] })), clips: [], membership: [], overlays: [] }, data: { event: 'n0', at: '0', duration: '1', division: '1' } };
    d.overlays = Array.from({ length: 17 }, (_, i) => ({ ...clone(o), id: 'o' + i }));
    const last = clone(o);
    last.id = 'last';
    last.depends.events = last.depends.events.slice(0, 1022).map((e: any, i: number) => ({ ...e, fields: i === 0 ? ['clip', 'at', 'duration'] : ['at'] }));
    d.overlays.push(last);
    agree(d);
    last.depends.events[1].fields.push('clip');
    rejects(() => validate(d), 'R28');
});
test('C28 import pair report budget resource failure', () => {
    const b = fresh().events[0];
    const notes = Array.from({ length: 513 }, (_, i) => ({ ...b, id: 'n' + i, at: `${i}/512`, duration: '1000' }));
    rejects(() => importNotes(notes), 'R28');
});
test('C29 FIELDS semantic invalid families and strict JSON fragments', () => {
    for (const [value, rule] of [['1/3', 'R06'], ['1/0', 'R05'], ['-1', 'R05']] as const)
        rejects(() => parse(fieldBase().replace('n1 part 0', `n1 part ${value}`), 'fields'), rule);
    rejects(() => parse(fieldBase().replace('"id":"part"', '"id":"part","id":"part"'), 'fields'), 'R11');
});
test('C29 native accessors and extra array properties refuse without evaluation', () => {
    const d: any = fresh();
    let invoked = false;
    Object.defineProperty(d, 'meta', { enumerable: true, get() {
            invoked = true;
            return {};
        } });
    rejects(() => validate(d), 'R29');
    assert.equal(invoked, false);
    const extra: any = fresh();
    extra.events.extra = 'discarded';
    rejects(() => validate(extra), 'R29');
});
test('C07 import validates portable fields and detaches caller objects', () => {
    const source = fresh().events[0];
    rejects(() => importNotes([{ ...source, pitch: 128 }]), 'R04');
    const note = { ...source, expression: { ...EVENT_DEFAULTS.expression, pressure: 0.5 } };
    const imported = importNotes([note]);
    note.expression.pressure = 0;
    assert.equal(imported.events[0].expression!.pressure, 0.5);
});
test('C21 basis and sealing helpers reject unknown paths and uncovered values', () => {
    const base = nominal(fresh()), claim = clone(base.overlays[0]);
    claim.depends.events[0].fields.push('unsupported' as any);
    rejects(() => dependencyBasis(base, claim), 'R21');
    const partial = fixture('partial');
    partial.events[0].expression = clone(EVENT_DEFAULTS.expression);
    rejects(() => sealOverlays(partial), 'R03');
});
