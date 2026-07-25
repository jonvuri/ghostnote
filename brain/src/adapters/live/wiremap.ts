/**
 * The wire vocabulary — THE ONLY PLACE `category.action` strings live.
 *
 * The extension registers 84 methods (extension/methods.golden.json). The
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
