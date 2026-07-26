/**
 * E14 — read the UI panel's state and stop. Non-interactive, read-only.
 *
 * Exists because `e14-ui.ts` blocks on human input almost immediately, and two
 * of its questions are answerable before anyone sits down: did the panel build
 * at all, and does the undocumented `Setting` downcast succeed? The second one
 * is the single most consequential unknown in the whole row set — if it fails,
 * row C is ○ and D4's pre-allocated take slots have no way to hide themselves.
 *
 * Safe to run at any time; it writes nothing and touches no clip.
 *
 *   npm run probe:e14-status
 */
import { client, note } from './lib.js';

const s = (await client.request('ui.status')) as Record<string, unknown>;
console.log(JSON.stringify(s, null, 2));

if (s['available'] !== true) {
  note(`the panel did NOT build: ${String(s['error'])}`);
} else {
  const cast = s['settingCastWorks'] as Record<string, boolean>;
  const all = Object.values(cast).every(Boolean);
  const none = Object.values(cast).every((v) => !v);
  note(all
    ? 'C1 ● every settings value object is also a `Setting` — runtime show/hide is reachable'
    : none
      ? 'C1 ○ no settings value object implements `Setting` — there is no runtime show/hide'
      : 'C1 ◐ MIXED — some kinds implement `Setting` and some do not, which no javadoc predicts');
}

client.disconnect();
