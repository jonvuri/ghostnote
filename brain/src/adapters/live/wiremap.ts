/**
 * The wire vocabulary — THE ONLY PLACE `category.action` strings live.
 *
 * The extension registers 93 methods (extension/methods.golden.json). The
 * contract reaches ~26 of them. That gap is deliberate, not incompleteness:
 *
 *   - the rest are exploration surface the E4c/E4d/E6/E7 probes run against, and
 *     they stay on the wire forever so those probes keep working — they are the
 *     regression suite that keeps the offline fake honest;
 *   - some are BANNED and must stay unreachable. `app.invokeAction` is standing
 *     rule 6 (E6: foreground-and-focus gated, zero readback, and it fires against
 *     the UI selection our own addressing sets — it silently created seven orphan
 *     duplicates of a fixture track before the mechanism was understood).
 *     `app.undo`/`app.redo` are E3: a 4-note write takes exactly 4 undos, there
 *     is no grouping hook, and the stack is project-global.
 *
 * `wiremap.test.ts` asserts USED ⊆ golden, and that no banned name appears in it.
 */

/** Every wire method the contract's encoder may emit. */
export const WIRE = {
  hello: 'contract.hello',
  ping: 'ping',
  hostInfo: 'host.info',
  rigInfo: 'rig.info',
  rigMethods: 'rig.methods',
  scanTracks: 'rig.scanTracks',

  trackList: 'track.list',
  trackCreate: 'track.create',
  trackSetName: 'track.setName',
  trackDelete: 'track.delete',
  trackResolve: 'track.resolveByChannelId',

  clipCreate: 'clip.create',
  slotStatus: 'slot.status',
  slotSelect: 'slot.select',
  slotDelete: 'slot.delete',

  cursorPin: 'cursor.pin',
  cursorPointTrack: 'cursor.pointTrack',
  cursorStatus: 'cursor.status',
  cursorSetStepSize: 'cursor.setStepSize',
  cursorSetNotes: 'cursor.setNotes',
  cursorGetNotes: 'cursor.getNotes',
  cursorGetNotesVerbose: 'cursor.getNotesVerbose',
  cursorClearNotes: 'cursor.clearNotes',
  cursorSetNoteProps: 'cursor.setNoteProps',

  sceneCreate: 'scene.create',
  sceneCount: 'scene.count',
  sceneDelete: 'scene.delete',

  deviceList: 'device.list',
  deviceInsertBitwig: 'device.insertBitwig',
  deviceInsertClap: 'device.insertClap',
  deviceInsertFile: 'device.insertFile',
  deviceDelete: 'device.delete',
  paramList: 'param.list',
  paramSet: 'param.set',
  directParamSet: 'directparam.set',

  batchRun: 'batch.run',
  revisionGet: 'revision.get',

  notify: 'notify',
} as const;

export type WireMethod = (typeof WIRE)[keyof typeof WIRE];

/** Sorted, de-duplicated — the set `wiremap.test.ts` checks against the golden. */
export const WIRE_METHODS_USED: readonly string[] = [...new Set(Object.values(WIRE))].sort();

/**
 * Methods that must NEVER appear in `WIRE`, with the rule that bans them.
 * They remain registered in the extension so the probes that established the
 * findings keep running.
 */
export const WIRE_METHODS_BANNED: Readonly<Record<string, string>> = {
  'app.invokeAction': 'standing rule 6 / E6 — named actions are unusable AND hazardous',
  'app.actions': 'standing rule 6 / E6 — enumeration only ever fed the ban',
  'app.undo': 'E3 — native undo is not a revert mechanism; ghostnote owns revert',
  'app.redo': 'E3 — see app.undo',
  'app.undoState': 'E3 — see app.undo',
};

/**
 * Methods that must not merely be unreachable — they must NOT EXIST.
 *
 * A different and harsher class than `WIRE_METHODS_BANNED` above. Those stay
 * registered on purpose, because the probes that established their bans are the
 * live regression suite and re-running one is merely unwise. These cannot be
 * re-run at all: invoking them takes Bitwig down, so a registration is a loaded
 * gun regardless of whether the contract reaches it.
 *
 * `wiremap.test.ts` asserts the golden does NOT contain any of these, which is
 * the inverse of what it asserts for the banned list.
 */
export const WIRE_METHODS_FORBIDDEN: Readonly<Record<string, string>> = {
  // ⚠ E14-A1, measured once, on 2026-07-25, at the cost of a Bitwig crash with
  // an unsaved project open. `Signal.fire()` on a `getDocumentState()` setting
  // throws `IllegalStateException: This signal cannot be invoked` — but it
  // throws it ASYNCHRONOUSLY, on Bitwig's own main thread, inside a runnable
  // deferred from our call. The handler's try/catch never sees it and the
  // application exits.
  //
  // The finding is a good one and it strengthens D4 rather than weakening it:
  // the agent cannot press the human's revert button even in principle, because
  // Bitwig refuses to let anything but a real click fire that signal. But the
  // measurement must never be repeated, so the method is deleted rather than
  // banned.
  'ui.signalFire': 'E14-A1 — Signal.fire() on a document-state setting CRASHES BITWIG, uncatchably',
};

/**
 * A single JSON-RPC call the encoder wants made. Deliberately a plain value:
 * frames are DATA, so a recording transport can assert on them in an offline
 * test without a socket, a server, or a running DAW.
 */
export interface Frame {
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export const frame = (method: string, params?: Record<string, unknown>): Frame =>
  params === undefined ? { method } : { method, params };
