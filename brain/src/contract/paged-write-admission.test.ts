import assert from 'node:assert/strict';
import test from 'node:test';
import { chain, device, deviceIn, deviceSlot, track } from './address.js';
import { assertChainCreatable, assertChainRelocatable, assertChainRenamable, assertChainActivatable,
  assertDeviceInsertable, assertDeviceRelocatable, type Op } from './ops.js';
import type { ObservedContainer } from './chains.js';

const target = track('paged-track');
const container = device(target, 17);
const bank = { devicesComplete: true, bankSize: 16,
  devices: Array.from({ length: 18 }, (_, index) => ({ index, name: `Top ${index}`, enabled: true })) };
const observed: ObservedContainer = {
  chainsComplete: true, chainsBankSize: 5, slotsComplete: true,
  chains: Array.from({ length: 6 }, (_, index) => ({ index, name: `Chain ${index}`, id: `id-${index}`, solo: false,
    devicesComplete: true, devicesBankSize: 4,
    devices: Array.from({ length: 5 }, (_, index) => ({ index, name: `Inner ${index}`, enabled: true })) })),
  slots: [{ name: 'FX', devicesComplete: true, devicesBankSize: 4,
    devices: [{ index: 0, name: 'Slot device', enabled: true }] }],
};
const relocate: Op = { op: 'chain.relocate', source: deviceIn(chain(container, 'Chain 5'), 4),
  destination: chain(container, 'Chain 0'), mode: 'copy' };

test('B17 admission: paged siblings, full device chains and top-level overflow are writable', () => {
  assertChainCreatable([{ op: 'chain.create', source: chain(container, 'Chain 5'), name: 'Seventh' }], () => observed);
  assertChainRenamable([{ op: 'chain.rename', chain: chain(container, 'Chain 5'), name: 'Sixth' }], () => observed);
  assertChainActivatable([{ op: 'chain.activate', chain: chain(container, 'Chain 5') }], () => observed);
  assertChainRelocatable([relocate], () => bank, () => observed);
  assertDeviceInsertable([{ op: 'device.insert', track: target, source: { from: 'bitwig', uuid: 'source' } }], () => bank);
  assertDeviceRelocatable([{ op: 'device.relocate', track: target, sourceFromEnd: 0,
    expectedName: 'Top 17', before: device(target, 0) }], () => bank);
});

test('B17 admission: partial top-level, sibling and device views still refuse before writes', () => {
  const partial = { ...observed, chainsComplete: false };
  assert.throws(() => assertChainCreatable([{ op: 'chain.create', source: chain(container, 'Chain 5'), name: 'New' }], () => partial), /complete/);
  assert.throws(() => assertChainRenamable([{ op: 'chain.rename', chain: chain(container, 'Chain 5'), name: 'New' }], () => partial), /complete/);
  assert.throws(() => assertChainActivatable([{ op: 'chain.activate', chain: chain(container, 'Chain 5') }], () => partial), /partial/);
  assert.throws(() => assertChainRelocatable([relocate], () => bank, () => partial), /complete/);
  assert.throws(() => assertChainRelocatable([relocate], () => bank, () => ({ ...observed,
    chains: observed.chains.map(c => ({ ...c, devicesComplete: false })) })), /complete/);
  assert.throws(() => assertDeviceInsertable([{ op: 'device.insert', track: target, source: { from: 'bitwig', uuid: 'source' } }],
    () => ({ ...bank, devicesComplete: false })), /complete/);
});

test('B17 admission: named-slot transfers retain every legacy endpoint window', () => {
  const slot = deviceSlot(container, 'FX');
  assert.throws(() => assertChainRelocatable([{ op: 'chain.relocate', source: device(target, 16),
    destination: slot, mode: 'copy' }], () => bank, () => observed), /named-slot route/);
  const near = device(target, 0);
  const smallBank = { ...bank, devices: bank.devices.slice(0, 2) };
  assert.throws(() => assertChainRelocatable([{ op: 'chain.relocate', source: deviceIn(chain(near, 'Chain 5'), 0),
    destination: deviceSlot(near, 'FX'), mode: 'copy' }], () => smallBank, () => observed), /named-slot route/);
  assert.throws(() => assertChainRelocatable([{ op: 'chain.relocate', source: deviceIn(deviceSlot(near, 'FX'), 0),
    destination: chain(near, 'Chain 0'), mode: 'copy' }], () => smallBank,
    () => ({ ...observed, chains: observed.chains.slice(0, 1) })), /named-slot route/);
});
