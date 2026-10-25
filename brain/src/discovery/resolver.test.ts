/** Resolution on a synthetic host tree: no running Bitwig, no installed prefs, no vendor jar. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  EXAMPLE_CLAP_ID, EXAMPLE_VST3_ID, FOREIGN_VST3_ID, POLYSYNTH_UUID, SAMPLER_UUID, buildSyntheticHost, type SyntheticHost,
} from './fixtures.js';
import { pluginIndexFileName, pluginIndexStem } from './plugin-index.js';
import { DiscoveryCache, RootNotDiscoveredError, resolveDeviceName, type DeviceNameResolution } from './resolver.js';

function host(t: { after(run: () => void): void }, prefs: Parameters<typeof buildSyntheticHost>[1] = {}): SyntheticHost {
  const dir = mkdtempSync(join(tmpdir(), 'gn-resolver-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return buildSyntheticHost(dir, prefs);
}

const scope = (r: DeviceNameResolution, kind: string, root: string) =>
  r.coverage.scopes.find((item) => item.sourceKind === kind && item.root === root)!;

test('resolver: a stock device resolves to its UUID from the installation, with complete coverage and a validated build', (t) => {
  const fx = host(t);
  const r = resolveDeviceName({ name: 'Polysynth' }, fx.context);
  assert.equal(r.status, 'resolved');
  assert.equal(r.coverage.complete, true);
  assert.deepEqual(r.candidates.map((c) => [c.sourceKind, c.identity, c.insertion]),
    [['native', { uuid: POLYSYNTH_UUID }, { kind: 'bitwig', id: POLYSYNTH_UUID }]]);
  assert.equal(r.admission.verdict, 'validated');
  assert.equal(r.admission.knownBuild, null);
  assert.deepEqual(r.admission.checks, { prefsDecoded: true, pluginRootsWithIndexState: 2, pluginRootsAvailable: 2, indexesPresent: 3, indexesDecoded: 3, nativeDecoded: true });
  assert.equal(scope(r, 'native', fx.context.deviceSettingsRoot).entries, 2);
  assert.deepEqual(r.coverage.requestedSourceKinds, ['native', 'vst3', 'clap', 'bitwig-preset']);
  assert.deepEqual(r.coverage.roots.map((root) => [root.kind, root.origin, root.available]), [
    ['native', 'installation', true], ['my-library', 'default', true], ['packages', 'default', true],
    ['plug-ins', 'configured', true], ['plug-ins', 'configured', true],
  ]);
  const sampler = resolveDeviceName({ name: 'Sampler', sourceKind: 'native' }, fx.context);
  assert.equal(sampler.status, 'resolved');
  assert.deepEqual(sampler.candidates[0]!.identity, { uuid: SAMPLER_UUID });
  assert.deepEqual(sampler.coverage.requestedSourceKinds, ['native']);
  assert.equal(sampler.coverage.scopes.length, 1);
});

test('resolver: a name in two formats is ambiguous; sourceKind or an exact root disambiguates without preference', (t) => {
  const fx = host(t);
  const both = resolveDeviceName({ name: 'Example' }, fx.context);
  assert.equal(both.status, 'ambiguous');
  assert.deepEqual(both.candidates.map((c) => [c.sourceKind, c.identity, c.location.path, c.vendor, c.architecture, c.freshness]), [
    ['vst3', { vst3Id: EXAMPLE_VST3_ID }, join(fx.vst3Root, 'Example.vst3'), 'Vendor', 'arm64', { bundleExists: true, bundleMtimeMatchesIndex: true }],
    ['clap', { clapId: EXAMPLE_CLAP_ID }, join(fx.clapRoot, 'Vendor', 'Example.clap'), 'Vendor', 'arm64', { bundleExists: true, bundleMtimeMatchesIndex: true }],
  ]);
  const vst3 = resolveDeviceName({ name: 'Example', sourceKind: 'vst3' }, fx.context);
  assert.equal(vst3.status, 'resolved');
  assert.deepEqual(vst3.candidates[0]!.insertion, { kind: 'vst3', id: EXAMPLE_VST3_ID });
  const clap = resolveDeviceName({ name: 'Example', root: fx.clapRoot }, fx.context);
  assert.equal(clap.status, 'resolved');
  assert.deepEqual(clap.candidates[0]!.insertion, { kind: 'clap', id: EXAMPLE_CLAP_ID });
  assert.deepEqual(clap.coverage.scopes.map((s) => [s.sourceKind, s.root]), [['vst3', fx.clapRoot], ['clap', fx.clapRoot]]);
  assert.throws(() => resolveDeviceName({ name: 'Example', root: '/nowhere' }, fx.context), RootNotDiscoveredError);
});

test('resolver: stale entries, foreign-architecture names, and recorded load failures are exclusions, not candidates', (t) => {
  const fx = host(t);
  const stale = resolveDeviceName({ name: 'Stale' }, fx.context);
  assert.equal(stale.status, 'not-found');
  assert.equal(stale.coverage.complete, true);
  assert.deepEqual(stale.exclusions.map((e) => [e.reason, e.name, e.path]), [['bundle-missing', 'Stale', join(fx.vst3Root, 'Stale.vst3')]]);
  const plain = resolveDeviceName({ name: 'Foreign' }, fx.context);
  assert.equal(plain.status, 'not-found');
  assert.deepEqual(plain.exclusions.map((e) => [e.reason, e.name]), [['architecture-suffix', 'Foreign [X64]']]);
  const suffixed = resolveDeviceName({ name: 'Foreign [X64]' }, fx.context);
  assert.equal(suffixed.status, 'resolved');
  assert.deepEqual([suffixed.candidates[0]!.identity, suffixed.candidates[0]!.architecture], [{ vst3Id: FOREIGN_VST3_ID }, 'x64']);
  const failed = resolveDeviceName({ name: 'Failed' }, fx.context);
  assert.equal(failed.status, 'not-found');
  assert.equal(failed.coverage.complete, true);
  assert.deepEqual(failed.exclusions.map((e) => [e.reason, e.name]), [['plug-in-failed-to-load', 'Failed']]);
  assert.match(failed.exclusions[0]!.detail, /could not load/);
  assert.deepEqual(scope(failed, 'vst3', fx.vst3Root).bundleCheck, { depth: 2, bundles: 2, unscannedDirectories: 0, unindexed: [], failedToLoad: ['Failed.vst3'] });
});

test('resolver: a bundle on disk without an index entry or a recorded failure makes the scope incomplete', (t) => {
  const fx = host(t);
  mkdirSync(join(fx.vst3Root, 'Vendor', 'New.vst3', 'Contents'), { recursive: true });
  const r = resolveDeviceName({ name: 'New' }, fx.context);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.candidates.length, 0);
  const vst3 = scope(r, 'vst3', fx.vst3Root);
  assert.equal(vst3.status, 'incomplete');
  assert.deepEqual(vst3.bundleCheck?.unindexed, ['Vendor/New.vst3']);
  assert.match(r.coverage.limits.join('\n'), /1 vst3 bundle\(s\) on disk without an index entry/);
  // Two verified candidates stay ambiguous even while another scope is incomplete.
  assert.equal(resolveDeviceName({ name: 'Example' }, fx.context).status, 'ambiguous');
  // A new bundle beside an indexed one in the same vendor directory is unindexed too (review P2).
  mkdirSync(join(fx.clapRoot, 'Vendor', 'Sibling.clap', 'Contents'), { recursive: true });
  const sibling = resolveDeviceName({ name: 'Sibling', sourceKind: 'clap' }, fx.context);
  assert.equal(sibling.status, 'incomplete');
  assert.deepEqual(scope(sibling, 'clap', fx.clapRoot).bundleCheck?.unindexed, ['Vendor/Sibling.clap']);
  // A directory below the bundle-check depth is counted, not searched, and does not change the index-based claim.
  mkdirSync(join(fx.vst3Root, 'Deep', 'Deeper', 'Deepest', 'Hidden.vst3'), { recursive: true });
  const deep = resolveDeviceName({ name: 'Hidden', sourceKind: 'vst3' }, fx.context);
  assert.equal(scope(deep, 'vst3', fx.vst3Root).bundleCheck?.unscannedDirectories, 1);
});

test('resolver: without any index state file, no plug-in scope claims uniqueness or absence (review P2)', (t) => {
  const fx = host(t);
  for (const root of [fx.vst3Root, fx.clapRoot]) rmSync(join(fx.indexDirectory, `${pluginIndexStem(root)}-state`));
  const r = resolveDeviceName({ name: 'Example', sourceKind: 'vst3' }, fx.context);
  assert.equal(r.admission.verdict, 'partial');
  assert.equal(r.status, 'incomplete');
  assert.equal(r.candidates.length, 1);
  assert.equal(scope(r, 'vst3', fx.vst3Root).status, 'incomplete');
  assert.match(r.coverage.limits.join('\n'), /no configured plug-in location has an index state file/);
  assert.equal(resolveDeviceName({ name: 'Polysynth', sourceKind: 'native' }, fx.context).status, 'resolved');
});

test('resolver: one file under two overlapping content roots is one candidate with both roots as provenance (review P2)', (t) => {
  const fx = host(t);
  fx.writePrefs({ soundContent: [[fx.myLibrary, 1]] });
  const r = resolveDeviceName({ name: 'gn-preset-zoo' }, fx.context);
  assert.equal(r.status, 'resolved');
  assert.equal(r.candidates.length, 1);
  assert.deepEqual(r.candidates[0]!.location.rootKind, 'my-library');
  assert.deepEqual(r.candidates[0]!.location.alsoUnder, [{ rootKind: 'sound-content', root: fx.myLibrary }]);
  const filtered = resolveDeviceName({ name: 'gn-preset-zoo', root: fx.myLibrary }, fx.context);
  assert.equal(filtered.status, 'resolved');
  assert.equal(filtered.candidates.length, 1);
});

test('resolver: presets resolve by file name under My Library, packages, and a sound-content location added or removed in the prefs', (t) => {
  const fx = host(t);
  const cache = new DiscoveryCache();
  const zoo = resolveDeviceName({ name: 'gn-preset-zoo' }, fx.context, { cache });
  assert.equal(zoo.status, 'resolved');
  const [candidate] = zoo.candidates;
  assert.deepEqual([candidate!.sourceKind, candidate!.identity, candidate!.insertion, candidate!.location.rootKind, candidate!.location.relativePath], [
    'bitwig-preset', { path: join(fx.myLibrary, 'Presets', 'Polysynth', 'gn-preset-zoo.bwpreset') },
    { kind: 'preset', path: join(fx.myLibrary, 'Presets', 'Polysynth', 'gn-preset-zoo.bwpreset') }, 'my-library', 'Presets/Polysynth/gn-preset-zoo.bwpreset']);
  assert.equal(candidate!.preset?.deviceId, POLYSYNTH_UUID);
  assert.equal(candidate!.preset?.deviceName, 'Polysynth');
  assert.equal(candidate!.preset?.applicationVersion, '6.0.6');
  assert.equal(candidate!.preset?.bytes, 59066);
  assert.equal(resolveDeviceName({ name: 'Pack Sampler', sourceKind: 'bitwig-preset' }, fx.context, { cache }).candidates[0]?.location.rootKind, 'packages');

  const before = resolveDeviceName({ name: 'Custom Ünïcode Name' }, fx.context, { cache });
  assert.equal(before.status, 'not-found');
  assert.equal(before.coverage.complete, true);
  fx.writePrefs({ soundContent: [[fx.soundContent, 1]] });
  const added = resolveDeviceName({ name: 'Custom Ünïcode Name' }, fx.context, { cache });
  assert.equal(added.status, 'resolved');
  assert.equal(added.prefs.reused, false);
  assert.deepEqual([added.candidates[0]!.location.rootKind, added.candidates[0]!.location.root], ['sound-content', fx.soundContent]);
  assert.deepEqual(added.coverage.roots.find((root) => root.kind === 'sound-content')?.automaticUpdate, true);
  const again = resolveDeviceName({ name: 'Custom Ünïcode Name' }, fx.context, { cache });
  assert.equal(again.prefs.reused, true);
  assert.equal(again.cache.misses, 0);
  fx.writePrefs({});
  const removed = resolveDeviceName({ name: 'Custom Ünïcode Name' }, fx.context, { cache });
  assert.equal(removed.status, 'not-found');
  assert.equal(removed.coverage.complete, true);
  assert.equal(removed.coverage.roots.some((root) => root.kind === 'sound-content'), false);
});

test('resolver: a duplicate preset name across roots is ambiguous and an exact root selects one', (t) => {
  const fx = host(t, { soundContent: [[join(mkdtempSync(join(tmpdir(), 'gn-dup-')), 'x'), 1]] });
  const dup = join(fx.soundContent, 'gn-preset-zoo.bwpreset');
  copyFileSync(join(fx.myLibrary, 'Presets', 'Polysynth', 'gn-preset-zoo.bwpreset'), dup);
  fx.writePrefs({ soundContent: [[fx.soundContent, 1]] });
  const r = resolveDeviceName({ name: 'gn-preset-zoo' }, fx.context);
  assert.equal(r.status, 'ambiguous');
  assert.deepEqual(r.candidates.map((c) => c.location.rootKind), ['my-library', 'sound-content']);
  const one = resolveDeviceName({ name: 'gn-preset-zoo', root: fx.soundContent }, fx.context);
  assert.equal(one.status, 'resolved');
  assert.deepEqual(one.candidates[0]!.identity, { path: dup });
});

test('resolver: unavailable roots and unreadable presets keep partial results with concrete limits', (t) => {
  const fx = host(t, { soundContent: [['/Volumes/Missing Drive', 1]] });
  const r = resolveDeviceName({ name: 'gn-preset-zoo' }, fx.context);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.candidates.length, 1);
  assert.equal(scope(r, 'bitwig-preset', '/Volumes/Missing Drive').status, 'unavailable');
  assert.match(r.coverage.limits.join('\n'), /Missing Drive: location does not exist/);
  writeFileSync(join(fx.myLibrary, 'Presets', 'Broken.bwpreset'), Buffer.from('not a preset'));
  const broken = resolveDeviceName({ name: 'Broken', sourceKind: 'bitwig-preset', root: fx.myLibrary }, fx.context);
  assert.equal(broken.status, 'incomplete');
  assert.deepEqual(broken.exclusions.map((e) => [e.reason, e.name]), [['unreadable-preset', 'Broken']]);
});

test('resolver: a missing prefs file leaves only the installation scope; an undecodable index is a partial build', (t) => {
  const fx = host(t);
  rmSync(fx.context.prefsPath);
  const native = resolveDeviceName({ name: 'Polysynth', sourceKind: 'native' }, fx.context);
  assert.equal(native.status, 'resolved');
  assert.equal(native.admission.verdict, 'unsupported');
  const plugin = resolveDeviceName({ name: 'Example', sourceKind: 'vst3' }, fx.context);
  assert.equal(plugin.status, 'unsupported');
  assert.match(plugin.coverage.unsupportedScopes.join('\n'), /vst3: the configured plug-in locations are unknown/);
  const all = resolveDeviceName({ name: 'Polysynth' }, fx.context);
  assert.equal(all.status, 'incomplete');
  assert.equal(all.candidates.length, 1);

  fx.writePrefs({});
  writeFileSync(join(fx.indexDirectory, pluginIndexFileName(fx.clapRoot, 'clap', 'arm64')), Buffer.from('garbage index bytes'));
  const partial = resolveDeviceName({ name: 'Example' }, fx.context);
  assert.equal(partial.admission.verdict, 'partial');
  assert.equal(scope(partial, 'clap', fx.clapRoot).status, 'unsupported');
  assert.equal(partial.status, 'incomplete');
  assert.deepEqual(partial.candidates.map((c) => c.sourceKind), ['vst3']);
});

test('resolver: a plug-in root list without a standard location never re-adds it, and a changed bundle is reported', (t) => {
  const fx = host(t, { plugins: [] });
  const r = resolveDeviceName({ name: 'Example' }, fx.context);
  assert.deepEqual(r.coverage.roots.filter((root) => root.kind === 'plug-ins'), []);
  assert.equal(r.status, 'not-found');
  assert.equal(r.admission.verdict, 'validated');
  fx.writePrefs({});
  utimesSync(join(fx.vst3Root, 'Example.vst3'), new Date(1_700_000_000_000), new Date(1_700_000_000_000));
  const changed = resolveDeviceName({ name: 'Example', sourceKind: 'vst3' }, fx.context);
  assert.equal(changed.status, 'resolved');
  assert.deepEqual(changed.candidates[0]!.freshness, { bundleExists: true, bundleMtimeMatchesIndex: false });
});
