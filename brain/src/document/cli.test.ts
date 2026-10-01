import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse, contentHash } from './index.js';
const script = new URL('./cli.ts', import.meta.url).pathname;
const fixture = readFileSync(new URL('../../../spec/ghostnote-document-v1/examples/empty-clip.fields', import.meta.url), 'utf8');
function run(args: string[], input: string) {
    return spawnSync(process.execPath, ['--import', 'tsx', script, ...args], { input, encoding: 'utf8' });
}
test('C29 offline CLI stdin validation conversion and failure', () => {
    const valid = run(['validate', 'fields'], fixture);
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).sha256, contentHash(parse(fixture, 'fields')));
    const json = run(['convert', 'fields', 'json'], fixture);
    assert.equal(json.status, 0, json.stderr);
    assert.equal(contentHash(parse(json.stdout, 'json')), JSON.parse(valid.stdout).sha256);
    const failed = run(['validate', 'fields'], '');
    assert.equal(failed.status, 1);
    assert.equal(failed.stdout, '');
    assert.equal(JSON.parse(failed.stderr).rule, 'R10');
});
