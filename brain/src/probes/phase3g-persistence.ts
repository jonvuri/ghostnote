/** Focused live smoke for the 3g-b opaque per-project persistence transport. */
import assert from 'node:assert/strict';

import { Session } from '../session.js';
import {
  ObservationCapacityError,
  appendObservationEntry,
  decodeObservationRecord,
  emptyObservationRecord,
  encodeObservationRecord,
  instructionObservation,
} from '../observation/index.js';

const session = new Session();
const mode = process.argv[2] ?? 'smoke';
const marker = encodeObservationRecord(appendObservationEntry(
  emptyObservationRecord(),
  instructionObservation({
    id: 'phase-3g-b-persistence-marker',
    correlationId: 'phase-3g-b-persistence-marker',
    recordedAtMs: 1_786_838_400_000,
    descriptionVersion: 'phase-3g-b-test-only',
    requestedScope: 'unsupported',
    rawScope: { purpose: '3g-b save, reload, restart, and project-switch smoke' },
  }),
));

async function smoke(): Promise<void> {
  const initial = await session.observations.read();
  assert.equal(initial.capacityChars, 262144);
  const original = initial.value;
  try {
    const empty = encodeObservationRecord(emptyObservationRecord(), {
      capacityChars: initial.capacityChars,
    });
    assert.equal((await session.observations.replace(empty)).value, empty);

    const populated = marker.replace('save, reload, restart, and project-switch',
      'immediate Unicode café 🎹');
    const landed = await session.observations.replace(populated);
    assert.equal(landed.value, populated);
    assert.equal(decodeObservationRecord(landed.value).entries.length, 1);

    await assert.rejects(
      () => session.observations.replace('x'.repeat(initial.capacityChars + 1)),
      ObservationCapacityError,
    );
    assert.equal((await session.observations.read()).value, populated,
      'overflow must not replace or truncate the landed value');
    console.log('PASS: empty, populated, Unicode, bounded readback, and overflow refusal.');
  } finally {
    const restored = await session.observations.replace(original);
    assert.equal(restored.value, original);
    console.log('RESTORED: the original project record is exact.');
  }
}

async function arm(): Promise<void> {
  const original = await session.observations.read();
  assert.equal(original.value, '',
    'REFUSING: persistence marker needs an empty pre-production record');
  assert.equal((await session.observations.replace(marker)).value, marker);
  console.log('ARMED: save the project before the next persistence check.');
}

async function check(expected: 'marker' | 'other'): Promise<void> {
  const stored = await session.observations.read();
  if (expected === 'marker') {
    assert.equal(stored.value, marker);
    console.log('PASS: the exact marker is present in this project.');
  } else {
    assert.notEqual(stored.value, marker);
    console.log('PASS: this project did not reuse the armed project record.');
  }
}

async function restore(): Promise<void> {
  await check('marker');
  assert.equal((await session.observations.replace('')).value, '');
  console.log('RESTORED: the test marker was removed exactly. Save the project.');
}

try {
  switch (mode) {
    case 'smoke': await smoke(); break;
    case 'arm': await arm(); break;
    case 'check': await check('marker'); break;
    case 'check-other': await check('other'); break;
    case 'restore': await restore(); break;
    default: throw new Error(`unknown mode: ${mode}`);
  }
} finally {
  await session.close();
}
