/** Bounded R05 discovery sequence. Each mutation has separate delayed readback. */
export const BROWSER_MARKER = 'r05-browser-discovery-v2';
// E344: initial results arrived between 305 and 402 ms after the open receipt.
export const BROWSER_WAITS = { open: 1000, update: 180, stable: 80 } as const;
type Item = { index: number; exists: boolean; name: string; selected: boolean };
export type BrowserStatus = {
  marker: string; guard: string; exists: boolean; owned: boolean;
  context: { project: string; generation: string; trackId: string };
  contentTypes: string[]; contentTypeIndex: number; contentTypeName: string;
  shouldAudition: boolean; resultCount: number; resultOffset: number; results: Item[];
  filters: { key: string; exists: boolean; count: number; offset: number; wildcard: Item; items: Item[] }[];
};
export type BrowserRequest = (params: Record<string, unknown>) => Promise<unknown>;
export type DiscoveryVerdict = {
  verdict: 'content-type-unavailable' | 'names-enumerated';
  conditions: { contentType: string; name: string; count: number; matches: Item[] }[];
  identity: 'unproved';
};

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
  const contentMatches = (state: BrowserStatus, name: string) => state.exists && state.owned
    && !state.shouldAudition && state.contentTypeName === name
    && state.contentTypeIndex >= 0 && state.contentTypes[state.contentTypeIndex] === name;
  try {
    let state = await read('entry');
    if (state.exists || state.owned) throw new Error('another browser session exists');
    for (const key of ['project', 'generation', 'trackId'] as const) {
      if (state.context[key] !== target[key]) throw new Error(`wrong scratch ${key}`);
    }
    // Set before dispatch: a lost reply is uncertain and still needs inspection/cancellation.
    opened = true;
    state = await mutate(state, { operation: 'open', ...target }, BROWSER_WAITS.open);
    if (!state.exists || !state.owned) throw new Error('owned popup did not open');
    // E344: opening the host popup can turn audition back on. Disable it in the open session.
    state = await mutate(state, { operation: 'auditionOff' });
    if (!state.exists || !state.owned || state.shouldAudition) throw new Error('post-open audition disable did not read back');
    for (const [contentType, name] of [['Devices', 'Polysynth'], ['Plug-ins', 'Addictive Drums 2']]) {
      state = await mutate(state, { operation: 'contentType', name: contentType });
      if (!contentMatches(state, contentType)) {
        record('content-type-mismatch', { requested: contentType, state });
        return { verdict: 'content-type-unavailable', conditions, identity: 'unproved' };
      }
      state = await mutate(state, { operation: 'resetFilters', contentType });
      if (!contentMatches(state, contentType)
        || state.filters.some(filter => filter.exists && !filter.wildcard.selected)) {
        throw new Error('filter reset or content-type readback failed');
      }
      const types = state.filters.find(filter => filter.key === 'deviceType');
      const instruments = types?.items.filter(item => /^Instruments?$/.test(item.name)) ?? [];
      if (!types?.exists || types.count > 128 || types.offset !== 0 || instruments.length !== 1) {
        throw new Error('no unique instrument filter in the complete device-type bank');
      }
      state = await mutate(state, { operation: 'deviceType', name: instruments[0].name, contentType });
      const selectedTypes = state.filters.find(filter => filter.key === 'deviceType');
      if (selectedTypes?.wildcard.selected || selectedTypes?.items.filter(item => item.selected).length !== 1
        || !selectedTypes.items.some(item => item.selected && item.name === instruments[0].name)) {
        throw new Error('device-type selection did not read back');
      }
      const count = state.resultCount;
      if (!Number.isInteger(count) || count <= 0 || count > 4096) throw new Error('result count outside 1..4096 scan bound');
      const filterState = JSON.stringify(state.filters);
      const matches: Item[] = [];
      let next = 0;
      while (next < count) {
        state = await mutate(state, { operation: 'page', offset: next, contentType });
        if (!contentMatches(state, contentType) || state.resultCount !== count
          || JSON.stringify(state.filters) !== filterState) throw new Error('browser changed during scan');
        // Bitwig may clamp the final bank to count - bank size; retain absolute indices once.
        if (state.resultOffset < 0 || state.resultOffset > next
          || !state.results.some(item => item.index === next)) throw new Error('result page did not reach requested index');
        const page = state.results.filter(item => item.index >= next && item.index < count);
        if (!page.length || page.some((item, i) => item.index !== next + i)) throw new Error('incomplete result page');
        matches.push(...page.filter(item => item.name === name));
        next += page.length;
      }
      conditions.push({ contentType, name, count, matches });
      record('condition', conditions.at(-1));
    }
    return { verdict: 'names-enumerated', conditions, identity: 'unproved' };
  } catch (error) {
    // Preserve the original failure even if cancellation/readback also fails.
    record('discovery-failure', { error: String(error) });
    throw error;
  } finally {
    if (opened) {
      // Read before cleanup even after uncertainty. No mutation is automatically retried.
      await read('before-cancel');
      await request({ operation: 'cancel', token });
      const final = await stable('canceled', BROWSER_WAITS.update);
      if (final.exists || final.owned) throw new Error('owned browser cancellation is unconfirmed');
    }
  }
}
