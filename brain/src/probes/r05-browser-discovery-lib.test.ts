import assert from 'node:assert/strict';
import test from 'node:test';
import { BROWSER_MARKER, discoverBrowserNames, type BrowserStatus } from './r05-browser-discovery-lib.js';

const target = { project: 'R05 test', generation: 'init-1', trackId: 'scratch-id' };
function fake(options: { unstable?: boolean; ambiguous?: boolean; changedCount?: boolean; auditionStuck?: boolean;
  resetStuck?: boolean; selectStuck?: boolean; duplicateLocation?: boolean; missingLocation?: boolean;
  partial?: boolean; gap?: boolean; cancelFailure?: boolean; empty?: boolean; farDuplicate?: boolean; metadataError?: boolean; metadataMismatch?: boolean; resultLimit?: number; pluginScope?: boolean } = {}) {
  let revision = 0, location = '';
  const calls: Record<string, unknown>[] = [], waits: number[] = [];
  const item = (name: string, index: number, selected = false) => ({ name, index, selected, exists: true });
  const locations = Array.from({length: 1466}, (_, i) => item(`Other ${i}`, i));
  locations[14].name = 'Devices'; locations[117].name = options.missingLocation ? 'Unavailable' : 'Plug-ins';
  locations[1].name = 'My Library';
  locations[180].name = 'System VST 3 Plug-ins'; locations[220].name = 'System CLAP Plug-ins';
  if (options.farDuplicate) locations[140].name = 'Devices';
  if (options.duplicateLocation) locations[0].name = 'Devices';
  const types = [item('Any Device Type', 0, true), item('Instrument', 1)];
  const state: BrowserStatus = {
    marker: BROWSER_MARKER, guard: '0', context: target, exists: false, owned: false,
    contentTypes: ['Devices', 'Plug-ins'], contentTypeIndex: 0, contentTypeName: '',
    shouldAudition: false, resultCount: 10000, resultOffset: 0, results: [],
    filters: [
      { key: 'location', count: 0, bankCount: 1466, offset: 0, exists: true, wildcard: item('All', -1, true), items: [] },
      { key: 'deviceType', count: 1, bankCount: 2, offset: 0, exists: true, wildcard: item('All', -1, true), items: [] },
      { key: 'device', count: 0, bankCount: 0, offset: 0, exists: false, wildcard: item('', -1), items: [] },
    ],
  };
  const refreshFilters = () => {
    state.filters[0].items = locations.slice(state.filters[0].offset, state.filters[0].offset + 128);
    state.filters[1].items = types;
  };
  refreshFilters();
  const resultName = () => location === 'Devices' ? 'Polysynth' : location === 'System CLAP Plug-ins' ? 'Diva' : ['Plug-ins', 'System VST 3 Plug-ins'].includes(location) ? 'Addictive Drums 2' : 'My preset';
  const request = async (params: Record<string, unknown>): Promise<unknown> => {
    calls.push(params);
    if (params.operation === 'status') {
      if (options.unstable && state.exists) state.guard = String(++revision);
      return structuredClone(state);
    }
    assert.equal(params.token, 'owner');
    if (params.operation !== 'cancel') assert.equal(params.guard, state.guard);
    if (params.operation === 'open') state.exists = state.owned = state.shouldAudition = true;
    else if (params.operation === 'cancel') {
      if (options.cancelFailure) throw new Error('cancel failed');
      state.exists = state.owned = false;
    } else if (params.operation === 'auditionOff' && !options.auditionStuck) state.shouldAudition = false;
    else if (params.operation === 'filterPage') {
      const column = state.filters.find(column => column.key === params.key)!;
      column.offset = Math.min(Number(params.offset), Math.max(0, column.bankCount - 128));
    } else if (params.operation === 'filter' && !options.selectStuck) {
      const column = state.filters.find(column => column.key === params.key)!;
      const rows = params.key === 'location' ? locations : types;
      column.wildcard.selected = false;
      rows.forEach(row => { row.selected = row.index === params.offset; });
      if (params.key === 'location') { location = String(params.name); state.resultCount = 5000; }
      else state.resultCount = options.empty ? 0 : options.partial ? 4100 : options.ambiguous ? 129 : 1;
    } else if (params.operation === 'resetFilters') {
      for (const column of state.filters.filter(column => column.exists)) {
        column.wildcard.selected = !options.resetStuck;
        column.offset = 0;
      }
      for (const row of [...locations, ...types]) row.selected = false;
      state.resultCount = 10000;
    } else if (params.operation === 'inspectPage') {
      state.metadata = options.metadataError ? { state: 'error', error: 'test refusal' } : { state: 'done',
        rows: state.results.slice(0,16).map(row => ({ index: row.index, observedName: options.metadataMismatch ? 'Changed' : row.name,
          nativeClass: 'TestResult', fields: [] })) };
    } else if (params.operation === 'page') {
      if (options.changedCount) state.resultCount++;
      const next = Number(params.offset);
      state.resultOffset = Math.min(next, Math.max(0, state.resultCount - 128));
      state.results = Array.from({ length: Math.min(128, state.resultCount) }, (_, i) => item(resultName(), state.resultOffset + i));
      if (options.gap) state.results.shift();
    }
    refreshFilters();
    state.guard = String(++revision);
    return { requested: true, readbackRequired: true };
  };
  return {
    calls, waits, state,
    run: () => discoverBrowserNames({ request, target, token: 'owner', resultLimit: options.resultLimit, locationPageLimit: options.pluginScope ? 2 : 1,
      conditions: options.pluginScope ? [['System VST 3 Plug-ins', 'Addictive Drums 2'], ['System CLAP Plug-ins', 'Diva']] : undefined, record: () => {}, wait: async ms => { waits.push(ms); } }),
  };
}

test('R05 uses bound filters despite disconnected content-type fields and enumerates library names', async () => {
  const host = fake();
  const verdict = await host.run();
  assert.equal(verdict.verdict, 'filter-discovery-observed');
  assert.equal(verdict.identity, 'unproved');
  assert.deepEqual(verdict.conditions.map(condition => [condition.location, condition.complete, condition.matches.length]),
    [['Devices', true, 1], ['Plug-ins', true, 1], ['My Library', true, 0]]);
  assert.equal(verdict.conditions[2].sample[0].name, 'My preset');
  assert.equal(host.calls.some(call => ['contentType', 'commit'].includes(String(call.operation))), false);
  assert.ok(host.waits.includes(1000) && host.waits.includes(180) && host.waits.includes(80));
  assert.equal(host.state.exists, false);
});

test('R05 retains ambiguity across a clamped final result page without double counting', async () => {
  const verdict = await fake({ ambiguous: true }).run();
  assert.deepEqual(verdict.conditions.map(condition => condition.matches.length), [129, 129, 0]);
  assert.equal(new Set(verdict.conditions[0].matches.map(item => item.index)).size, 129);
});

test('R05 reports bounded scans as incomplete rather than proving uniqueness or absence', async () => {
  const verdict = await fake({ partial: true }).run();
  assert.ok(verdict.conditions.every(condition => condition.count === 4100 && condition.scanned === 4096 && !condition.complete));
});

test('R05 accepts a complete empty result set without requesting an invalid page', async () => {
  const host = fake({ empty: true });
  assert.ok((await host.run()).conditions.every(condition => condition.count === 0 && condition.complete));
  assert.equal(host.calls.some(call => call.operation === 'page'), false);
});

test('R05 records an absent location without claiming an empty complete scan', async () => {
  const verdict = await fake({ missingLocation: true }).run();
  assert.equal(verdict.conditions[1].outcome, 'filter-unavailable');
  assert.equal(verdict.conditions[1].complete, false);
});

for (const [option, message] of [
  ['unstable', /did not settle/], ['changedCount', /changed during scan/],
  ['auditionStuck', /quiet owned browser/], ['resetStuck', /reset did not read back/],
  ['selectStuck', /selection did not read back/], ['duplicateLocation', /ambiguous filter name/],
  ['gap', /metadata does not match/], ['metadataError', /native metadata unavailable/],
  ['metadataMismatch', /metadata does not match/],
] as const) {
  test(`R05 cancels after ${option} without retrying open`, async () => {
    const host = fake({ [option]: true });
    await assert.rejects(host.run, message);
    assert.equal(host.calls.filter(call => call.operation === 'open').length, 1);
    assert.equal(host.calls.filter(call => call.operation === 'cancel').length, 1);
    assert.equal(host.state.exists, false);
  });
}

test('R05 refuses another browser without canceling it', async () => {
  const host = fake();
  host.state.exists = true;
  await assert.rejects(host.run, /another browser/);
  assert.equal(host.calls.some(call => call.operation === 'cancel'), false);
});

test('R05 retains both discovery and cleanup errors', async () => {
  await assert.rejects(fake({ gap: true, cancelFailure: true }).run, error => {
    assert.ok(error instanceof AggregateError);
    assert.match(String(error.errors[0]), /metadata does not match/);
    assert.match(String(error.errors[1]), /cancel failed/);
    return true;
  });
});

test('R05 selects an observed location row without claiming global name uniqueness', async () => {
  const host = fake({ farDuplicate: true });
  assert.equal((await host.run()).conditions[0].complete, true); // Result scan completeness only.
  assert.ok(host.calls.some(call => call.operation === 'filter' && call.key === 'location' && call.offset === 14));
});

test('R05 metadata follow-up can stop after one result bank with explicit incompleteness', async () => {
  const host = fake({ ambiguous: true, resultLimit: 128 });
  assert.ok((await host.run()).conditions.every(condition => condition.scanned === 128 && !condition.complete));
});

test('R05 rejects an invalid result bound before opening the browser', async () => {
  const host = fake({ resultLimit: 4097 });
  await assert.rejects(host.run, /resultLimit outside/);
  assert.equal(host.calls.length, 0);
});

test('R05 samples exact VST3 and CLAP rows from a bounded two-page location prefix', async () => {
  const host = fake({ pluginScope: true });
  const verdict = await host.run();
  assert.deepEqual(verdict.conditions.map(row => row.matches[0].name), ['Addictive Drums 2', 'Diva']);
  assert.deepEqual(host.calls.filter(row => row.operation === 'filter' && row.key === 'location').map(row => row.offset), [180, 220]);
});
