import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse, serialize, contentHash, applyPatch, type Patch, type StateDocument } from '../document/index.js';
import { modelReference, REFERENCE_SECTIONS } from '../document/reference.js';
const root = new URL('../../../', import.meta.url), spec = new URL('spec/ghostnote-document-v1/', root);
const read = (path: string) => readFileSync(new URL(path, spec), 'utf8');
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const check = process.argv.includes('--check');
const emit = (path: string, value: string) => {
    if (check)
        assert.equal(read(path), value, `${path} is out of date`);
    else
        writeFileSync(new URL(path, spec), value);
};
const schemaCopy = '// Generated from spec/ghostnote-document-v1/schema.json. Owner: 8f2.\nexport const schema: Record<string, any> = ' + read('schema.json').trim() + ';\n';
const schemaPath = new URL('brain/src/document/schema-data.ts', root);
if (check)
    assert.equal(readFileSync(schemaPath, 'utf8'), schemaCopy, 'schema copy is out of date');
else
    writeFileSync(schemaPath, schemaCopy);
const expected = JSON.parse(read('examples/expected.json'));
for (const [name, expect] of Object.entries(expected.documents) as [
    string,
    {
        sha256: string;
    }
][]) {
    const json = parse(read(`examples/${name}.json`), 'json'), fields = parse(read(`examples/${name}.fields`), 'fields');
    assert.deepEqual(json, fields);
    assert.equal(contentHash(json), expect.sha256);
    for (const encoding of ['json', 'fields'] as const)
        emit(`conformance/v1/canonical/${name}.${encoding}`, serialize(json, encoding));
}
const source = read('MODEL-REFERENCE.md'), examples = [...source.matchAll(/```fields\n([\s\S]*?)```/g)].map(match => parse(match[1], 'fields'));
assert.equal(examples.length, 2);
const result = applyPatch(examples[0] as StateDocument, examples[1] as Patch);
assert.equal(result.document.events[0].pitch, 62);
emit('MODEL-REFERENCE.identity.json', JSON.stringify({ formatVersion: '1.0', referenceRevision: 1, algorithm: 'sha256', scope: 'Exact UTF-8 bytes of MODEL-REFERENCE.md', sha256: hash(source) }, null, 2) + '\n');
const baseline = JSON.parse(execFileSync('python3', [new URL('conformance/v1/measure-baseline.py', spec).pathname], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
const selections = { core: [], patch: ['Patch'], timing: ['Timing overlays'], full: REFERENCE_SECTIONS.filter(section => section !== 'Core') } as const;
const measurements = Object.entries(selections).map(([name, sections]) => {
    const text = modelReference(source, [...sections]);
    emit(`conformance/v1/prompts/${name}.txt`, text);
    return { name, sections: ['Core', ...sections], bytes: Buffer.byteLength(text), sha256: hash(text), ratioToRetainedReference: Number((Buffer.byteLength(text) / baseline.bytes).toFixed(4)), providerTokens: null };
});
emit('conformance/v1/measurements.json', JSON.stringify({ owner: '8f2 reference codec', formatVersion: '1.0', referenceSha256: hash(source), scope: 'Complete selected reference plus its examples and source identity preface. No task, input document, or provider wrapper.', providerTokensReason: 'No tokenizer for these provider models is bundled. No token-count or generation request was made. Bytes are not tokens.', baseline, measurements }, null, 2) + '\n');
console.log(check ? 'Document artifacts match.' : 'Document artifacts generated.');
