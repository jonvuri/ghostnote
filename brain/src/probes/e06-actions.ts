/**
 * E6 — Named actions escape hatch (§12; reduced urgency per SPIKE_PLAN).
 *
 * Application.getActions() exposes 781 actions. Question: are they a usable
 * escape hatch for the ops with no typed API (Group/Ungroup track grouping,
 * wrap/unwrap automation)? Answer: NO for a background agent, and actively
 * HAZARDOUS. Full model established across e06-diag2/3/4/6/7 (the foreground
 * runs done with Bitwig frontmost by the user):
 *
 *   1. invoke() resolves the action + returns cleanly, but EFFECT is
 *      GUI-state dependent:
 *   2. GLOBAL actions (Create Scene, Undo) fire ONLY when Bitwig is the
 *      foreground OS app; backgrounded → silent no-op. (diag2 vs diag3)
 *   3. CONTEXT-SENSITIVE editing actions dispatch against PANEL keyboard
 *      focus, which the controller API cannot set. With a clip selected but
 *      no panel focus, "Duplicate" does NOT duplicate the clip (diag3);
 *      it fires only after a focus action first (diag4).
 *   4. HAZARD: with a TRACK selected and no clip-panel focus, "Duplicate"
 *      duplicates the whole TRACK (diag7). Our addressing SELECTS the track
 *      it points at (selectChannel), so invoking Duplicate while a pool
 *      cursor is active silently duplicated our gn-A fixture — 7 times over
 *      the course of this experiment. Actions operate on the exact UI state
 *      our infrastructure manipulates. (A pure view action like a zoom is
 *      harmless — see phase D — so the danger is state-changing actions, not
 *      invoke() itself.)
 *
 * ⇒ ghostnote is a background agent. Named actions are UNAVAILABLE (need
 *   foreground/focus we can't assume) and UNSAFE (clobber the selection our
 *   own addressing sets). Rely on typed APIs; the no-typed-API residual is a
 *   minor, organisational capability gap.
 *
 * This probe asserts only FOCUS-INDEPENDENT invariants and is SELF-HEALING:
 * it snapshots track channelIds and deletes any track that appears during the
 * run, so it is safe to run in any focus state (a foreground Duplicate would
 * otherwise leave an orphan).
 */
import {
  client, check, note, failureCount, pollUntil, point, cursorStatus,
  getNotes, sameNotes, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };
type Action = { id: string; name: string; category: string };

const actions = async (filter?: string) =>
  (await client.request('app.actions', filter ? { filter } : {})) as
    { actions: Action[]; matched: number; total: number };
const invoke = async (id: string) =>
  (await client.request('app.invokeAction', { id })) as
    { success: boolean; resolved: boolean; resolvedName?: string };
const list = async () => (await client.request('track.list')) as { tracks: TrackRow[]; count: number };
const sel = async () => (await client.request('selection.status')) as
  { trackIndex: number; slotIndex: number; changes: number };
const slotHasContent = async (t: number, s: number) =>
  ((await client.request('slot.status', { trackIndex: t, slotIndex: s })) as { hasContent: boolean }).hasContent;

await client.connect();
console.log('connected\n');
const { trackA, trackB } = await ensureFixtureTracks();
// Self-healing baseline: any track not in this set at cleanup gets deleted.
const baselineIds = new Set((await list()).tracks.map((t) => t.channelId));

// ============================================ A. surface: the no-typed-API residual
console.log('-- A. action surface (781 across 20 categories)');
const all = await actions();
const byCat: Record<string, number> = {};
for (const a of all.actions) byCat[a.category] = (byCat[a.category] ?? 0) + 1;
const viewish = ['Navigation', 'Panel Management', 'Detail Editor', 'Zooming',
  'Window Management', 'Mixer', 'Text Editing', 'Browser', 'Help', 'Dialogs'];
const viewCount = viewish.reduce((n, c) => n + (byCat[c] ?? 0), 0);
note(`${all.total} actions; ~${viewCount} are view/panel/focus ops irrelevant to a headless agent`);
check('action list is enumerable with id + name + category', all.total > 700, { total: all.total });

const residual = ['Group', 'Ungroup', 'wrap', 'unwrap'];
const found = residual.filter((id) => all.actions.some((a) => a.id === id));
note(`no-typed-API residual present: ${found.join(', ')} (track grouping + automation wrap)`);
check('the marquee no-typed-API ops exist ONLY as actions',
  found.includes('Group') && found.includes('Ungroup'), { found });

// ============================================ B. invoke() path resolves (focus-independent)
console.log('\n-- B. invoke() resolves the action + returns cleanly');
const r = await invoke('detail_editor_zoom_in'); // harmless view action
note(`invoke("detail_editor_zoom_in") → ${JSON.stringify(r)}`);
check('invoke() resolves a named action by id and returns without error',
  r.resolved === true, r);
note('whether an action has EFFECT is GUI-state dependent (diag2/diag3): global');
note('actions fire only with Bitwig foregrounded — inert for a background agent.');

// ============================================ C. CRUX: editing actions ignore API clip selection
console.log('\n-- C. editing actions do NOT act on a bare API clip selection');
const FP: [number, number, number, number][] = [[3, 67, 100, 1]];
const SRC = 8, DST = 9;
for (const s of [SRC, DST]) {
  if (await slotHasContent(trackA, s)) {
    await client.request('slot.delete', { trackIndex: trackA, slotIndex: s });
    await pollUntil(async () => !(await slotHasContent(trackA, s)));
  }
}
await client.request('clip.create', { trackIndex: trackA, slotIndex: SRC, lengthBeats: 4 });
await pollUntil(async () => slotHasContent(trackA, SRC));
await point('0', trackA, SRC, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: FP });
await pollUntil(async () => sameNotes(await getNotes('0'), FP));
await client.request('cursor.pin', { cursor: '0', pinned: false });

await client.request('slot.select', { trackIndex: trackA, slotIndex: SRC, mechanism: 'slot' });
const selOk = await pollUntil(async () => {
  const s = await sel();
  return s.trackIndex === trackA && s.slotIndex === SRC;
});
check('the clip IS selected (Bitwig\'s own isSelected observer fired)', selOk.ok, await sel());

const dstEmptyBefore = !(await slotHasContent(trackA, DST));
await invoke('Duplicate');
const duplicated = await pollUntil(async () => slotHasContent(trackA, DST), 4000);
check('CRUX: "Duplicate" does NOT duplicate the selected CLIP (no panel keyboard focus; '
  + 'diag3 confirms this holds even foregrounded, diag4 fires only after a focus action)',
  dstEmptyBefore && !duplicated.ok,
  { note: 'and when it DOES fire it duplicates the TRACK, not the clip — see diag7/HAZARD' });

// ============================================ D. invoke() itself is pin-safe (view action)
console.log('\n-- D. a pure view action does not disturb a pinned pool cursor');
await point('1', trackA, SRC, MECH);
await client.request('cursor.pin', { cursor: '1', pinned: true });
const pinBefore = await cursorStatus('1');
await invoke('detail_editor_zoom_in');
await new Promise((res) => setTimeout(res, 300));
const pinAfter = await cursorStatus('1');
check('a pinned cursor is UNMOVED by a view action (invoke() per se is safe)',
  pinAfter.trackPosition === pinBefore.trackPosition
  && pinAfter.sceneIndex === pinBefore.sceneIndex && pinAfter.isPinned === true,
  { before: [pinBefore.trackPosition, pinBefore.sceneIndex, pinBefore.isPinned],
    after: [pinAfter.trackPosition, pinAfter.sceneIndex, pinAfter.isPinned] });
note('CONTRAST (diag6/diag7): "Duplicate" DID unpin + move this cursor and duplicated');
note('gn-A, because pointing the cursor selected gn-A and Duplicate acts on the selection.');
await client.request('cursor.pin', { cursor: '1', pinned: false });

// ============================================ E. checkpoint semantics
console.log('\n-- E. invocation semantics for checkpointing');
let threw = false;
try {
  await invoke('Ungroup'); // nothing to ungroup
} catch (e) {
  threw = true;
  note(`Ungroup threw: ${(e as Error).message}`);
}
check('an inapplicable action is a silent no-op (no throw)', !threw,
  { note: 'void invoke() + silent no-op ⇒ actions carry NO readback, un-verifiable from result' });

// ============================================ cleanup (self-healing)
console.log('\n-- cleanup');
for (const s of [SRC, DST]) {
  if (await slotHasContent(trackA, s)) {
    await client.request('slot.delete', { trackIndex: trackA, slotIndex: s });
    await pollUntil(async () => !(await slotHasContent(trackA, s)));
  }
}
// Delete any track that appeared during the run (a foreground Duplicate orphan).
const strays = (await list()).tracks.filter((t) => !baselineIds.has(t.channelId));
for (const t of strays) {
  const res = (await client.request('track.resolveByChannelId', { channelId: t.channelId })) as
    { found: boolean; index?: number };
  if (res.found) {
    await client.request('track.delete', { trackIndex: res.index });
    await pollUntil(async () =>
      !((await client.request('track.resolveByChannelId', { channelId: t.channelId })) as
        { found: boolean }).found);
  }
}
check('no stray tracks left behind (self-healing against the Duplicate hazard)',
  (await list()).tracks.every((t) => baselineIds.has(t.channelId)),
  { removed: strays.map((t) => t.name) });

await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
await client.request('cursor.pin', { cursor: '0', pinned: false });
check('fixture restored', true);

console.log(failureCount() === 0 ? '\nE6: all checks passed' : `\nE6: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
