import { test } from 'node:test';
import assert from 'node:assert/strict';

import { modulationRoute } from './modulation-target.js';

test('5j-target: native, VST3, and CLAP DirectParameter ids use one contract', () => {
  assert.equal(modulationRoute({
    parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency',
  }), 'CONTENTS/F1FREQ');
  for (const parameterId of ['CONTENTS/PID411', 'CONTENTS/PID7af']) {
    assert.equal(modulationRoute({ parameterId, parameterName: 'Plug-in target' }),
      `CONTENTS/ROOT_GENERIC_MODULE/${parameterId.slice('CONTENTS/'.length)}`);
  }
});

test('5j-target: a resolved container location wraps the same parameter id', () => {
  assert.equal(modulationRoute(
    { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' },
    { containerName: 'Chain', deviceIndex: 2 },
  ), 'CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/2:CONTENTS/F1FREQ');
});
