/** Read-only check for the Phase 8 probe runtime boundary. */
import { check, client, failureCount, note } from './lib.js';

const D13_METHODS = [
  'app.actions',
  'app.invokeAction',
  'app.redo',
  'app.undo',
  'app.undoState',
  'branch.groupTrack',
] as const;

const PHASE8_METHODS = [
  'api.runtimeMethods',
  'stepdata.observer.enrich',
  'stepdata.observer.prepare',
  'stepdata.observer.read',
] as const;

const hello = await client.request('contract.hello') as {
  readonly runtimeProfile: string;
  readonly methodCount: number;
  readonly methodsHash: string;
};
check('the Phase 8 probe identity is live',
  hello.runtimeProfile === 'phase-8-probe-v1'
    && hello.methodCount === 95
    && hello.methodsHash === '226dd8c1467c7c3b',
  hello);

const methodReply = await client.request('rig.methods') as {
  readonly methods: readonly string[];
};
for (const method of [...D13_METHODS, ...PHASE8_METHODS]) {
  check(`${method} is present in the probe profile`, methodReply.methods.includes(method));
}
check('the forbidden signal route is absent', !methodReply.methods.includes('ui.signalFire'));

const actions = await client.request('app.actions', {
  filter: '__ghostnote_no_matching_action__',
}) as { readonly matched: number; readonly total: number };
check('named-action enumeration remains runnable without invoking an action',
  actions.matched === 0 && actions.total > 0,
  actions);

const undoState = await client.request('app.undoState') as {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
};
check('undo-state observation remains runnable without changing the project',
  typeof undoState.canUndo === 'boolean' && typeof undoState.canRedo === 'boolean',
  undoState);

const inventory = await client.request('api.runtimeMethods') as {
  readonly readOnly: boolean;
  readonly targets: readonly unknown[];
};
check('the API inventory remains read-only and complete',
  inventory.readOnly === true && inventory.targets.length === 10,
  { readOnly: inventory.readOnly, targets: inventory.targets.length });

const prepared = await client.request('stepdata.observer.prepare') as {
  readonly generation: number;
};
const read = await client.request('stepdata.observer.read') as {
  readonly generation: number;
  readonly callbacks: number;
  readonly invalidCells: number;
};
const enriched = await client.request('stepdata.observer.enrich', {
  generation: prepared.generation,
  callbacks: read.callbacks,
}) as { readonly stable: boolean; readonly count: number; readonly coordinateCount: number };
check('the step-data observer produces one stable read-only snapshot',
  read.generation === prepared.generation
    && read.invalidCells === 0
    && enriched.stable === true,
  { prepared, read, enriched });

note('No named action, undo, redo, or group operation was invoked.');
client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
