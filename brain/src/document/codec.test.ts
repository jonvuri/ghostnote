import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse, serialize, validate, contentHash, applyPatch, applyDesired, normalizeTiming, importNotes, observeCells, ImportCollisionError, DocumentError, EVENT_DEFAULTS, EVENT_FIELDS, COVERAGE_FIELDS, LIMITS, type StateDocument, type Patch, type Document } from './index.js';
import { canonicalJson, readJson } from './json.js';
import { boundedInteger, rational, spelling, cmp, sum } from './rational.js';
import { schema } from './schema-data.js';
const root = new URL('../../../', import.meta.url);
const file = (path: string) => readFileSync(new URL(path, root), 'utf8');
const fixture = (name: string) => parse(file(`spec/ghostnote-document-v1/examples/${name}.json`), 'json') as any;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const fresh = (): StateDocument => ({ format: 'ghostnote-document', version: '1.0', kind: 'desired', clips: [{ id: 'part', length: '4' }], coverage: [{ clip: 'part', from: '0', to: '4', channels: Array.from({ length: 16 }, (_, i) => i + 1), fields: 'all', status: 'complete' }], events: [{ id: 'n1', clip: 'part', at: '0', duration: '1', pitch: 60, velocity: 100 }] });
const patch = (base: StateDocument): Patch => ({ format: 'ghostnote-document', version: '1.0', kind: 'patch', base: { sha256: contentHash(base) }, add: [], remove: [], update: [], clipUpdate: [] });
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
for (const key of ['clips', 'coverage', 'events'])
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
for (const name of ['empty', 'empty-clip', 'partial', 'clip-defaults'])
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
        d.coverage[0].fields = [...COVERAGE_FIELDS];
        d.events[0].expression = clone(EVENT_DEFAULTS.expression);
    }, coverage: (d: any) => d.coverage = [], duplicate: (d: any) => d.coverage.push(clone(d.coverage[0])), range: (d: any) => d.clips[0].loop = { from: '3', to: '2' }, end: (d: any) => d.clips[0].playRange = { from: '0', to: '5' }, incomplete: (d: any) => d.coverage[0].fields = [...COVERAGE_FIELDS] }))
    bad(mut, 'R03', `C03 ${label}`);
test('C03 long duration preserved and covered defaults', () => {
    const d = fresh();
    d.events[0].duration = '8';
    agree(d);
    d.kind = 'snapshot';
    d.coverage[0].fields = [...COVERAGE_FIELDS];
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
    const loop = fresh();
    loop.clips[0].loop = { from: '-0', to: '8/2' };
    assert.deepEqual(clone((agree(loop) as StateDocument).clips[0].loop), { from: '0', to: '4' });
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
test('C06 add/update offgrid reject', () => {
    const b = fresh();
    for (const key of ['add', 'update'] as const) {
        const p = patch(b);
        if (key === 'add')
            p.add = [{ ...b.events[0], id: 'added', at: '1/3' }];
        else
            p.update = [{ id: 'n1', set: { at: '1/3' } }];
        rejects(() => validate(p), 'R06');
    }
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
    for (const array of ['add', 'remove', 'update', 'clipUpdate']) {
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
    assert.deepEqual(applyPatch(b, fixture('no-op')).report, { added: [], removed: [], changedFields: [], clipFields: [], clearedDefaults: [] });
    assert.equal(b.events[0].pitch, 60);
});
test('C09 preservation null reset every optional event field and clip range', () => {
    const complete = fixture('complete') as StateDocument;
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
for (const mode of ['remove', 'update', 'add'] as const)
    test(`C09 missing/existing ${mode}`, () => {
        const b = fresh(), p = patch(b);
        if (mode === 'add')
            p.add = [clone(b.events[0])];
        if (mode === 'remove')
            p.remove = ['missing'];
        if (mode === 'update')
            p.update = [{ id: 'missing', set: { pitch: 61 } }];
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
    const r = applyDesired(b, d);
    assert.equal(r.document.base, undefined);
    assert.equal(r.document.events[0].expression, undefined);
    assert.equal(r.document.events.length, 1);
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
    assert.deepEqual(parse(simple.replace('velocity\n', 'velocity channel mute\n').replace('60 100', '60 100 _ _'), 'fields'), parse(simple, 'fields'));
    assert.deepEqual(parse(simple.replace('60 100', '60 100 WITH {"channel":1}'), 'fields'), parse(simple, 'fields'));
});
const fieldBase = () => serialize(fresh(), 'fields');
for (const [label, mut] of Object.entries({ binding: (s: string) => s.replace(/^FIELDS.*\n/m, ''), required: (s: string) => s.replace('duration pitch', 'pitch'), width: (s: string) => s.replace('60 100', '60 100 7'), underwidth: (s: string) => s.replace('60 100', '60'), conflict: (s: string) => s.replace('velocity\n', 'velocity channel\n').replace('60 100', '60 100 _ WITH {"channel":1}'), emptyRequired: (s: string) => s.replace('n1 part 0', '_ part 0'), repeat: (s: string) => s + 'FIELDS id clip at duration pitch velocity\n', envelope: (s: string) => s + 'META {}\n', wrongKind: (s: string) => s.replace('EVENT', 'ADD') }))
    test(`C10 invalid ${label}`, () => rejects(() => parse(mut(fieldBase()), 'fields'), 'R10'));
test('C10 body interleaving', () => {
    const d = fixture('complete');
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
for (const [key, kind] of [['overlays', 'desired'], ['overlayPut', 'patch'], ['overlayRemove', 'patch']] as const)
    test(`C12 removed ${key} refuses`, () => {
        const d: any = kind === 'patch' ? patch(fresh()) : fresh();
        d[key] = [];
        assert.throws(() => validate(d), (e: any) => e instanceof DocumentError && e.rule === 'R12' && /D73/.test(e.message));
        assert.throws(() => parse(JSON.stringify(d), 'json'), (e: any) => e instanceof DocumentError && e.rule === 'R12');
    });
for (const record of ['OVERLAY {}', 'OVERLAY_PUT {}', 'OVERLAY_REMOVE nom'])
    test(`C12 removed ${record.split(' ')[0]} record refuses`, () => {
        const base = record === 'OVERLAY {}' ? serialize(fresh(), 'fields') : serialize(patch(fresh()), 'fields');
        assert.throws(() => parse(base + record + '\n', 'fields'), (e: any) => e instanceof DocumentError && e.rule === 'R12' && /D73/.test(e.message) && e.line !== undefined);
    });
const sourced = (provenance: any): StateDocument => {
    const d = fresh();
    d.clips[0].provenance = provenance;
    return d;
};
for (const [label, provenance] of Object.entries({
    path: { sources: [{ path: '/music/a.mid' }] },
    full: { sources: [{ path: '/music/a.mid', sha256: 'a'.repeat(64), range: { from: '8', to: '12' }, read: { conversion: 'midi-document-v3', track: 1, nested: { list: [1, null] } }, refs: { 'ghostworks:assetId': 'x1' } }, { path: '/music/b.mid' }], generator: { path: '/music/compose.py', sha256: 'b'.repeat(64) } },
    generator: { generator: { path: '/music/compose.py' } },
    many: { sources: Array.from({ length: 64 }, (_, i) => ({ path: `/music/${i}.mid` })) },
}))
    test(`C33 provenance ${label}`, () => {
        const d = agree(sourced(provenance)) as StateDocument;
        assert.deepEqual(clone(d.clips[0].provenance), provenance);
    });
for (const [label, provenance, rule] of [
    ['empty object', {}, 'R33'], ['empty sources', { sources: [] }, 'R33'],
    ['too many sources', { sources: Array.from({ length: 65 }, (_, i) => ({ path: `/m/${i}.mid` })) }, 'R28'],
    ['missing path', { sources: [{ sha256: 'a'.repeat(64) }] }, 'R33'], ['empty path', { sources: [{ path: '' }] }, 'R33'],
    ['bad sha256', { sources: [{ path: '/a.mid', sha256: 'ABC' }] }, 'R33'],
    ['equal range', { sources: [{ path: '/a.mid', range: { from: '4', to: '4' } }] }, 'R33'],
    ['reversed range', { sources: [{ path: '/a.mid', range: { from: '5', to: '4' } }] }, 'R33'],
    ['decimal range', { sources: [{ path: '/a.mid', range: { from: '0.5', to: '4' } }] }, 'R05'],
    ['unknown source key', { sources: [{ path: '/a.mid', tempo: 120 }] }, 'R01'],
    ['unknown key', { sources: [{ path: '/a.mid' }], intent: 'funky' }, 'R01'],
    ['bad ref value', { sources: [{ path: '/a.mid', refs: { 'gw:x': 1 } }] }, 'R33'],
    ['duplicate source', { sources: [{ path: '/a.mid' }, { path: '/a.mid' }] }, 'R33'],
] as const)
    test(`C33 provenance rejects ${label}`, () => rejects(() => validate(sourced(provenance)), rule));
test('C33 provenance identity, clip update set and clear', () => {
    const plain = fresh(), d = sourced({ sources: [{ path: '/music/a.mid' }] });
    assert.notEqual(contentHash(d), contentHash(plain));
    assert.equal(contentHash(sourced({ sources: [{ path: '/music/a.mid', range: { from: '2/2', to: '4' } }] })), contentHash(sourced({ sources: [{ path: '/music/a.mid', range: { from: '1', to: '4' } }] })));
    const set = patch(plain);
    set.clipUpdate = [{ id: 'part', set: { provenance: { sources: [{ path: '/music/a.mid' }] } } }];
    agree(set);
    const added = applyPatch(plain, set);
    assert.equal(contentHash(added.document), contentHash(d));
    assert.deepEqual(added.report.clipFields, [{ id: 'part', fields: ['provenance'] }]);
    const clear = patch(d);
    clear.clipUpdate = [{ id: 'part', set: { provenance: null } }];
    const cleared = applyPatch(d, clear);
    assert.equal(cleared.document.clips[0].provenance, undefined);
    assert.deepEqual(cleared.report.clipFields, [{ id: 'part', fields: ['provenance'] }]);
    const bad = patch(d);
    bad.clipUpdate = [{ id: 'part', set: { provenance: { sources: [{ path: '/a', range: { from: '2', to: '1' } }] } } }];
    rejects(() => validate(bad), 'R33');
});
/** Two notes of one clip; `defaults` and per-note extras as given. */
const kit = (defaults?: any, extras: any[] = [{}, {}]): StateDocument => {
    const d = fresh();
    if (defaults)
        d.clips[0].defaults = defaults;
    d.events = extras.map((extra, i) => ({ id: 'n' + (i + 1), clip: 'part', at: String(i), duration: '1', pitch: 60, velocity: 100, ...extra }));
    return d;
};
test('C34 defaults expand in both encodings and explicit values win', () => {
    const d = kit({ channel: 10, releaseVelocity: 0 }, [{}, { releaseVelocity: 0.5 }]);
    const n = validate(d) as StateDocument;
    assert.equal(n.clips[0].defaults, undefined);
    assert.deepEqual(n.events.map(e => [e.channel, e.releaseVelocity]), [[10, 0], [10, 0.5]]);
    assert.equal(contentHash(d), contentHash(kit(undefined, [{ channel: 10, releaseVelocity: 0 }, { channel: 10, releaseVelocity: 0.5 }])));
    const fields = 'DOC ghostnote-document 1.0 desired\nCLIP {"defaults":{"channel":10,"releaseVelocity":0},"id":"part","length":"4"}\n'
        + 'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"part","fields":"all","from":"0","status":"complete","to":"4"}\n'
        + 'FIELDS id clip at duration pitch velocity releaseVelocity\nEVENT n1 part 0 1 60 100 _\nEVENT n2 part 1 1 60 100 0.5\n';
    assert.deepEqual(parse(fields, 'fields'), n);
    assert.deepEqual(parse(JSON.stringify(d), 'json'), n);
    assert.deepEqual(parse(fields.replace('100 0.5', '100 _ WITH {"channel":10}').replace('velocity releaseVelocity\n', 'velocity releaseVelocity\n'), 'fields').kind, 'desired');
    rejects(() => validate(kit({ pitch: 60 })), 'R01');
    rejects(() => validate(kit({})), 'R34');
    rejects(() => validate(kit({ channel: 17 })), 'R34');
});
test('C34 a default needs a covered field', () => {
    const d = kit({ releaseVelocity: 0 });
    d.kind = 'snapshot';
    d.coverage[0].fields = [...COVERAGE_FIELDS];
    rejects(() => validate(d), 'R34');
    d.clips[0].defaults = { channel: 2 };
    assert.deepEqual((validate(d) as StateDocument).events.map(e => e.channel), [2, 2]);
});
test('C34 canonical FIELDS states uniform nondefault values once', () => {
    const uniform = serialize(kit(undefined, [{ channel: 10, releaseVelocity: 0, mute: false }, { channel: 10, releaseVelocity: 0 }]), 'fields');
    assert.match(uniform, /^CLIP \{"defaults":\{"channel":10,"releaseVelocity":0\},"id":"part","length":"4"\}$/m);
    assert.match(uniform, /^FIELDS id clip at duration pitch velocity$/m);
    assert.match(uniform, /^EVENT n1 part 0 1 60 100$/m);
    assert.ok(!uniform.includes('WITH'));
    const mixed = serialize(kit(undefined, [{ channel: 10, releaseVelocity: 0 }, { channel: 10, mute: true }]), 'fields');
    assert.match(mixed, /^CLIP \{"defaults":\{"channel":10\},"id":"part","length":"4"\}$/m);
    assert.match(mixed, /^FIELDS id clip at duration pitch velocity mute releaseVelocity$/m);
    assert.match(mixed, /^EVENT n1 part 0 1 60 100 _ 0$/m);
    assert.match(mixed, /^EVENT n2 part 1 1 60 100 true _$/m);
    const portable = serialize(kit({ channel: 1, releaseVelocity: 100 / 127 }), 'fields');
    assert.match(portable, /^CLIP \{"id":"part","length":"4"\}$/m);
    assert.match(portable, /^FIELDS id clip at duration pitch velocity$/m);
    const twoClips = fresh();
    twoClips.events = [];
    twoClips.clips.push({ id: 'drums', length: '4', defaults: { channel: 10 } });
    twoClips.coverage.push({ ...clone(twoClips.coverage[0]), clip: 'drums' });
    twoClips.events.push({ id: 'k', clip: 'drums', at: '0', duration: '1', pitch: 36, velocity: 100 }, { id: 'p', clip: 'part', at: '0', duration: '1', pitch: 60, velocity: 100, channel: 2 }, { id: 'q', clip: 'part', at: '1', duration: '1', pitch: 60, velocity: 100 });
    const both = serialize(twoClips, 'fields');
    assert.match(both, /^FIELDS id clip at duration pitch velocity channel$/m);
    assert.match(both, /^EVENT k drums 0 1 36 100 _$/m);
    assert.match(both, /^EVENT p part 0 1 60 100 2$/m);
    assert.match(both, /^EVENT q part 1 1 60 100 _$/m);
    agree(twoClips);
    const json = serialize(kit({ channel: 10 }), 'json');
    assert.ok(!json.includes('defaults'));
    assert.ok(json.includes('"channel":10'));
});
test('C34 patch adds take the base clip default; explicit and null stay portable', () => {
    const base = kit(undefined, [{ releaseVelocity: 0 }, { releaseVelocity: 0 }]), p = patch(base);
    p.add = [{ id: 'a', clip: 'part', at: '2', duration: '1', pitch: 62, velocity: 90 }, { id: 'b', clip: 'part', at: '3', duration: '1', pitch: 62, velocity: 90, releaseVelocity: 100 / 127 }];
    p.update = [{ id: 'n2', set: { releaseVelocity: null } }];
    const n = agree(p) as Patch;
    assert.equal(n.add.find(e => e.id === 'b')!.releaseVelocity, 100 / 127);
    assert.equal(n.add.find(e => e.id === 'a')!.releaseVelocity, undefined);
    const text = serialize(n, 'fields');
    assert.match(text, /^FIELDS id clip at duration pitch velocity releaseVelocity$/m);
    assert.match(text, /^ADD a part 2 1 62 90 _$/m);
    const events = applyPatch(base, p).document.events;
    assert.deepEqual(events.map(e => [e.id, e.releaseVelocity]), [['n1', 0], ['n2', undefined], ['a', 0], ['b', undefined]]);
});
test('C25 default omission sets ordering source order and extensions order', () => {
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
    full.events.reverse();
    assert.equal(contentHash(full), contentHash(fixture('complete')));
    const sources = fixture('complete');
    sources.clips[0].provenance.sources.push({ path: '/fixtures/other.mid' });
    const swapped = clone(sources);
    swapped.clips[0].provenance.sources.reverse();
    assert.notEqual(contentHash(swapped), contentHash(sources));
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
    snapshot.coverage[0].fields = [...COVERAGE_FIELDS];
    assert.notEqual(contentHash(snapshot), h);
    const sourced = clone(d);
    sourced.clips[0].provenance = { sources: [{ path: '/a.mid' }] };
    assert.notEqual(contentHash(sourced), h);
    const guarded = clone(d);
    guarded.base = { sha256: h };
    assert.notEqual(contentHash(guarded), h);
    assert.notEqual(contentHash(patch(d)), h);
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
for (const [key, max] of Object.entries({ clips: 256, coverage: 256, events: 131072 }))
    test(`C28 count ${key} plus one`, () => {
        const d: any = fresh();
        d[key] = new Array(max + 1).fill(null);
        rejects(() => validate(d), 'R28');
    });
test('C28 256 clips and count bounds', () => {
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
    const p = patch(fresh());
    p.remove = Array.from({ length: 131072 }, (_, i) => 'n' + i);
    agree(p);
    p.update = [{ id: 'other', set: { pitch: 61 } }];
    rejects(() => validate(p), 'R28');
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
test('C31 corpus owner rule index of the retained families and golden provenance', () => {
    const inventory = JSON.parse(file('spec/ghostnote-document-v1/conformance/v1/manifest.json'));
    assert.equal(inventory.owner, '8f2 reference codec');
    // D73 retired R13-R24 (overlays); R12 now covers their refusal, and R33-R34 are new.
    const rules = [...Array.from({ length: 12 }, (_, i) => i + 1), ...Array.from({ length: 10 }, (_, i) => i + 25)];
    assert.deepEqual(inventory.rules.map((r: any) => r.rule), rules.map(i => 'R' + String(i).padStart(2, '0')));
    for (const r of inventory.rules)
        assert.equal(r.family, 'C' + r.rule.slice(1));
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
        d.events[0][field]!.enabled = false;
        const n = agree(d) as StateDocument;
        assert.equal(n.events[0][field]!.enabled, false);
        const other = clone(n);
        delete other.events[0][field];
        assert.notEqual(contentHash(n), contentHash(other));
    });
test('C08 all editable fields are complete atomic updates', () => {
    const d = fixture('complete') as StateDocument;
    const source = d.events[0], base = fresh(), p = patch(base), set: any = {};
    for (const [field, value] of Object.entries(source))
        if (field !== 'id' && field !== 'clip')
            set[field] = value;
    p.update = [{ id: 'n1', set }];
    agree(p);
    const result = applyPatch(base, p);
    assert.deepEqual(result.document.events[0], validate({ ...base, events: [source] }).kind === 'patch' ? null : (validate({ ...base, events: [source] }) as StateDocument).events[0]);
});
test('C09 operation order independence clip reset length', () => {
    const b = fresh(), p = patch(b);
    p.add = [{ ...b.events[0], id: 'z', at: '3' }, { ...b.events[0], id: 'a', at: '2' }];
    const r = applyPatch(b, p);
    p.add.reverse();
    assert.equal(contentHash(applyPatch(b, p).document), contentHash(r.document));
    const c = patch(fresh());
    c.clipUpdate = [{ id: 'part', set: { length: null } } as any];
    rejects(() => validate(c), 'R05');
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
test('C28 each patch count plus one', () => {
    for (const [key, max] of Object.entries({ add: 131072, remove: 131072, update: 131072, clipUpdate: 256 })) {
        const p: any = patch(fresh());
        p[key] = new Array(max + 1).fill(null);
        rejects(() => validate(p), 'R28');
    }
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
