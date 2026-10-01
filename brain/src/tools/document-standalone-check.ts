import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const brain = new URL('../../', import.meta.url).pathname, root = new URL('../../../', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'ghostnote-document-consumer-'));
try {
    mkdirSync(join(dir, 'src'));
    for (const name of readdirSync(join(brain, 'src/document')))
        if (name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'cli.ts')
            copyFileSync(join(brain, 'src/document', name), join(dir, 'src', name));
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, outDir: 'dist', typeRoots: [join(brain, 'node_modules/@types')], types: ['node'] }, include: ['src'] }));
    execFileSync(process.execPath, [join(brain, 'node_modules/typescript/bin/tsc'), '-p', join(dir, 'tsconfig.json')], { stdio: 'pipe' });
    const example = readFileSync(join(root, 'spec/ghostnote-document-v1/examples/complete.fields'), 'utf8');
    const expected = JSON.parse(readFileSync(join(root, 'spec/ghostnote-document-v1/examples/expected.json'), 'utf8')).documents.complete.sha256;
    writeFileSync(join(dir, 'consumer.mjs'), `import {parse,serialize,contentHash} from './dist/index.js';
const d=parse(${JSON.stringify(example)},'fields');
if(contentHash(parse(serialize(d,'json'),'json'))!==${JSON.stringify(expected)})throw new Error('Independent hash failed');
console.log('Standalone consumer passed.');\n`);
    assert.equal(execFileSync(process.execPath, [join(dir, 'consumer.mjs')], { encoding: 'utf8' }).trim(), 'Standalone consumer passed.');
    console.log('Standalone consumer passed. No runtime package dependency.');
}
finally {
    rmSync(dir, { recursive: true, force: true });
}
