/**
 * E14 row A, second half — does document state survive a save and reopen?
 *
 * Split from `e14-ui.ts` for the same reason E11g was split into load/verify:
 * the interesting event happens in Bitwig between the two runs, and a probe
 * cannot save-and-reopen a project on its own. Run `npm run probe:e14` first;
 * it writes the marker and prints the instructions.
 *
 * ⚠ This is the load-bearing half of D4. "Persisted inside the project document"
 * is what makes the controller surface a place takes could live at all — one that
 * resets on reopen is a scratchpad, not a store. And the STRONGER form of
 * the question is a full Bitwig restart rather than a project reopen, because
 * only that distinguishes "saved into the .bwproject file" from "held in memory
 * by a still-running extension instance".
 *
 *   npm run probe:e14-verify
 */
import { readFileSync } from 'node:fs';

import { client, check, note, failureCount, ask, askYesNo } from './lib.js';

type Status = {
  available: boolean;
  error?: string;
  statusValue: string;
  takeValue: string;
  revertFires: number;
  settingCount: number;
};

let expected: string;
try {
  expected = readFileSync(new URL('../../.e14-marker', import.meta.url), 'utf8').trim();
} catch {
  console.log('No .e14-marker found. Run `npm run probe:e14` first — it writes the marker.');
  process.exit(1);
}
note(`expecting status="${expected}", take="B"`);

const s = (await client.request('ui.status')) as Status;
if (!s.available) {
  check('the UI panel built at init', false, { error: s.error });
  client.disconnect();
  process.exit(1);
}

note(`found status="${s.statusValue}", take="${s.takeValue}", settings=${s.settingCount}`);

const restarted = await askYesNo('Did you fully RESTART Bitwig (not just reopen the project)?');
note(restarted
  ? 'strong form: a full restart, so anything found here came off disk'
  : 'weak form: project reopen only — the extension instance may have survived,'
    + ' so this cannot separate disk persistence from in-memory state');

check('VERDICT A3: a String document setting survives save + reopen',
  s.statusValue === expected, { got: s.statusValue, want: expected });
check('VERDICT A3: an Enum document setting survives save + reopen',
  s.takeValue === 'B', { got: s.takeValue });

// ⚠ The counter is extension-side state, NOT document state, so it must reset.
// If it did not, the settings would be living somewhere other than the document
// and D4's "saved in the project" claim would be about the wrong thing.
check('the click counter RESET, confirming what persists is the document, not our state',
  s.revertFires === 0, { revertFires: s.revertFires });

const perProject = await ask(
  'Optional, and the sharpest version of the question: open a DIFFERENT project.'
  + ' Does its ghostnote panel show empty settings (per-project) or these same values'
  + ' (global)? Say "per-project", "global", or "skip".');
note(`VERDICT A4 (user-reported): document state is ${perProject}`);
// D5 wants takes to belong to a project. Global settings would mean the panel is
// the wrong home for them and the daemon must own the store outright.
if (perProject.toLowerCase().startsWith('per')) {
  check('document state is scoped PER PROJECT, as D4 assumes', true, { reported: perProject });
} else if (perProject.toLowerCase().startsWith('glob')) {
  check('document state is scoped PER PROJECT, as D4 assumes', false, { reported: perProject });
}

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'E14 row A persistence: all checks passed' : `E14 row A persistence: ${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
