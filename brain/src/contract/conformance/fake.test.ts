/**
 * The conformance suite, run against the fake — offline, no Bitwig, no bridge.
 *
 * This is Phase-0 exit criterion 1's main event. The identical cases run against
 * real Bitwig via `npm run probe:conformance`, and any disagreement between the
 * two is the fake drifting — which is the risk this whole arrangement exists to
 * catch.
 */
import { runConformance } from './suite.js';
import { fakeHarness } from './harness-fake.js';

runConformance(fakeHarness());
