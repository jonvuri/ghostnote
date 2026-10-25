/** Bounded R05 filter discovery. Each mutation has separate delayed readback. */
export const BROWSER_MARKER = 'r05-browser-discovery-v3';
// Research waits, not stable latency claims. E346 explains the omitted content-type setter.
export const BROWSER_WAITS = { open: 1000, reset: 1000, update: 180, stable: 80 } as const;
type Item = { index: number; exists: boolean; name: string; selected: boolean };
type Filter = { key: string; exists: boolean; count: number; bankCount: number; offset: number; wildcard: Item; items: Item[] };
export type BrowserStatus = {
  marker: string; guard: string; exists: boolean; owned: boolean;
  context: { project: string; generation: string; trackId: string };
  contentTypes: string[]; contentTypeIndex: number; contentTypeName: string;
  shouldAudition: boolean; resultCount: number; resultOffset: number; results: Item[];
  filters: Filter[];
};
export type BrowserRequest = (params: Record<string, unknown>) => Promise<unknown>;
export type DiscoveryVerdict = {
  verdict: 'filter-discovery-observed';
  conditions: {
    location: string; name: string | null; outcome: 'scanned' | 'filter-unavailable';
    count: number; scanned: number; complete: boolean; matches: Item[]; sample: Item[];
  }[];
  identity: 'unproved';
};

/** Validate a page, including host clamping of the final bank, without double counting. */
function pageRows(items: Item[], offset: number, next: number, end: number): Item[] {
  if (!Number.isInteger(offset) || offset < 0 || offset > next) throw new Error('page did not reach requested index');
  const page = items.filter(item => item.index >= next && item.index < end);
  if (!page.length || page.some((item, i) => !item.exists || item.index !== next + i)) {
    throw new Error('incomplete page');
  }
  return page;
}

export async function discoverBrowserNames(options: {
  request: BrowserRequest;
  wait: (ms: number) => Promise<void>;
  record: (label: string, value: unknown) => void;
  target: { project: string; generation: string; trackId: string };
  token: string;
}): Promise<DiscoveryVerdict> {
  const { request, wait, record, target, token } = options;
  const conditions: DiscoveryVerdict['conditions'] = [];
  let opened = false;
  let failure: unknown;
  const read = async (label: string) => {
    const state = await request({ operation: 'status' }) as BrowserStatus;
    record(label, state);
    if (state.marker !== BROWSER_MARKER) throw new Error('wrong browser probe build');
    return state;
  };
  const stable = async (label: string, delay: number) => {
    await wait(delay);
    const first = await read(`${label}-first`);
    await wait(BROWSER_WAITS.stable);
    const second = await read(`${label}-second`);
    if (first.guard !== second.guard) throw new Error(`${label}: browser did not settle within the bounded wait`);
    return second;
  };
  const mutate = async (state: BrowserStatus, params: Record<string, unknown>, delay: number = BROWSER_WAITS.update) => {
    await request({ ...params, token, guard: state.guard });
    return stable(String(params.operation), delay);
  };
  const quiet = (state: BrowserStatus) => {
    if (!state.exists || !state.owned || state.shouldAudition) throw new Error('quiet owned browser is unavailable');
    for (const key of ['project', 'generation', 'trackId'] as const) {
      if (state.context[key] !== target[key]) throw new Error(`wrong scratch ${key}`);
    }
  };
  const filter = (state: BrowserStatus, key: string) => {
    const column = state.filters.find(column => column.key === key);
    if (!column?.exists) throw new Error(`${key}: filter is absent`);
    return column;
  };
  const selected = (state: BrowserStatus, key: string, name: string) => {
    const column = filter(state, key);
    if (column.wildcard.selected || column.items.filter(item => item.selected).length !== 1
      || !column.items.some(item => item.exists && item.selected && item.name === name)) {
      throw new Error(`${key}: filter selection did not read back`);
    }
  };
  const selectObserved = async (initial: BrowserStatus, key: string, names: string[]) => {
    let state = initial;
    const count = filter(state, key).bankCount;
    if (!Number.isInteger(count) || count < 1 || (key !== 'location' && count > 1024)) throw new Error(`${key}: invalid or oversized filter bank`);
    const matches: Item[] = [];
    const originalResultCount = state.resultCount;
    if (key === 'location') {
      // A research condition selects a concrete observed row, not a globally resolved name.
      // The full hierarchical location bank has 1,466 entries in attempt 3.
      const column = filter(state, key);
      if (column.offset !== 0) throw new Error('location: expected the reset first page');
      const end = Math.min(count, 128);
      const page = pageRows(column.items, column.offset, 0, end);
      if (page.length !== end) throw new Error('location: incomplete first page');
      matches.push(...page.filter(item => names.includes(item.name)));
      record('filter-matches', { key, names, count, scanned: end, complete: end === count,
        selectionScope: 'observed-first-page', matches });
    } else {
      for (let next = 0; next < count;) {
        state = await mutate(state, { operation: 'filterPage', key, offset: next });
        quiet(state);
        const column = filter(state, key);
        if (column.bankCount !== count || state.resultCount !== originalResultCount) throw new Error('filter changed during enumeration');
        const page = pageRows(column.items, column.offset, next, count);
        matches.push(...page.filter(item => names.includes(item.name)));
        next += page.length;
      }
      record('filter-matches', { key, names, count, scanned: count, complete: true, matches });
    }
    if (matches.length === 0) return { state, name: null };
    if (matches.length !== 1) throw new Error(`${key}: ambiguous filter name`);
    const match = matches[0];
    state = await mutate(state, { operation: 'filterPage', key, offset: match.index });
    quiet(state);
    if (filter(state, key).bankCount !== count || state.resultCount !== originalResultCount) throw new Error('filter changed before selection');
    state = await mutate(state, { operation: 'filter', key, offset: match.index, name: match.name });
    quiet(state);
    selected(state, key, match.name);
    record('filter-effect', { key, name: match.name, beforeCount: originalResultCount, afterCount: state.resultCount });
    return { state, name: match.name };
  };
  try {
    let state = await read('entry');
    if (state.exists || state.owned) throw new Error('another browser session exists');
    for (const key of ['project', 'generation', 'trackId'] as const) {
      if (state.context[key] !== target[key]) throw new Error(`wrong scratch ${key}`);
    }
    opened = true; // A lost reply still requires inspection and cancellation.
    state = await mutate(state, { operation: 'open', ...target }, BROWSER_WAITS.open);
    if (!state.exists || !state.owned) throw new Error('owned popup did not open');
    state = await mutate(state, { operation: 'auditionOff' });
    quiet(state);
    for (const [location, name] of [['Devices', 'Polysynth'], ['Plug-ins', 'Addictive Drums 2'], ['My Library', null]] as const) {
      state = await mutate(state, { operation: 'resetFilters' }, BROWSER_WAITS.reset);
      quiet(state);
      if (state.filters.some(column => column.exists && (!column.wildcard.selected || column.offset !== 0))) {
        throw new Error('filter reset did not read back');
      }
      const place = await selectObserved(state, 'location', [location]);
      state = place.state;
      if (place.name === null) {
        conditions.push({ location, name, outcome: 'filter-unavailable', count: state.resultCount,
          scanned: 0, complete: false, matches: [], sample: [] });
        record('condition', conditions.at(-1));
        continue;
      }
      const type = await selectObserved(state, 'deviceType', ['Instrument', 'Instruments']);
      state = type.state;
      if (type.name === null) throw new Error('instrument filter unavailable');
      selected(state, 'location', location);
      const count = state.resultCount;
      if (!Number.isInteger(count) || count < 0) throw new Error('invalid result count');
      const limit = Math.min(count, 4096);
      const filterState = JSON.stringify(state.filters);
      const matches: Item[] = [], sample: Item[] = [];
      let next = 0;
      while (next < limit) {
        state = await mutate(state, { operation: 'page', offset: next });
        quiet(state);
        if (state.resultCount !== count || JSON.stringify(state.filters) !== filterState) throw new Error('browser changed during scan');
        const page = pageRows(state.results, state.resultOffset, next, limit);
        matches.push(...page.filter(item => item.name === name));
        sample.push(...page.slice(0, Math.max(0, 16 - sample.length)));
        next += page.length;
      }
      conditions.push({ location, name, outcome: 'scanned', count, scanned: next, complete: next === count, matches, sample });
      record('condition', conditions.at(-1));
    }
    return { verdict: 'filter-discovery-observed', conditions, identity: 'unproved' };
  } catch (error) {
    failure = error;
    record('discovery-failure', { error: String(error) });
    throw error;
  } finally {
    if (opened) {
      try {
        await read('before-cancel');
        await request({ operation: 'cancel', token });
        const final = await stable('canceled', BROWSER_WAITS.update);
        if (final.exists || final.owned) throw new Error('owned browser cancellation is unconfirmed');
      } catch (cleanupError) {
        if (failure !== undefined) throw new AggregateError([failure, cleanupError], 'discovery and cancellation failed');
        throw cleanupError;
      }
    }
  }
}
