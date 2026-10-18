// Check the delete completion predicate without a live Bitwig host.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const tasks = [];
const replies = [];
const host = {
  defineController() {},
  defineMidiPorts() {},
  addDeviceNameBasedDiscoveryPair() {},
  scheduleTask(callback) { tasks.push(callback); },
  errorln() {},
};
const context = vm.createContext({ loadAPI() {}, host });
const source = new URL('../../../../reference/bitwig-control-deck/controller/ControlDeck.control.js', import.meta.url);
vm.runInContext(readFileSync(source, 'utf8'), context);

// The target guards pass. The host ignores the delete. Isolate the final check.
context.selectTrack = (_request, _params, callback) => callback({});
context.requireDevice = () => ({ deleteObject() {} });
context.deviceSnapshot = () => ({ name: 'Unchanged device', index: 0 });
context.deviceBank = { itemCount: () => ({ get: () => 1 }) };
context.finish = (_request, ok, payload) => replies.push({ ok, payload });
context.dispatch({ method: 'delete_device', params: { deviceIndex: 0 } });
for (const task of tasks) task();

assert.equal(replies.length, 1);
assert.equal(replies[0].ok, true);
assert.equal(replies[0].payload.previousCount, 1);
assert.equal(replies[0].payload.verifiedCount, 1);
console.log(JSON.stringify(replies[0], null, 2));
