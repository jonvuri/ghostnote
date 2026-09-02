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
  /**
   * ⚠ Reached for ONE field: `initEpochMs`, when the running extension started.
   *
   * That is what `deploy.ts` compares against the deployed jar's mtime to answer
   * *"is Bitwig running the build that is on disk?"* — the question
   * `contract.hello` cannot answer, because `methodsHash` is over method NAMES
   * and a change that only adds fields to a reply leaves it identical. The rest
   * of this method is E5 scale instrumentation the contract does not use.
   */
  rigStats: 'rig.stats',
  scanTracks: 'rig.scanTracks',

  trackList: 'track.list',
  trackCreate: 'track.create',
  trackSetName: 'track.setName',
  trackDelete: 'track.delete',
  trackResolve: 'track.resolveByChannelId',
  trackDuplicate: 'branch.duplicateTrack',

  clipCreate: 'clip.create',
  slotStatus: 'slot.status',
  slotSelect: 'slot.select',
  slotDelete: 'slot.delete',
  slotDuplicateClip: 'slot.duplicateClip',
  slotLaunchWithOptions: 'slot.launchWithOptions',
  slotPlayState: 'slot.playState',
  slotMoveTo: 'slot.moveTo',

  /**
   * The user's own clip selection, as an observer's last value.
   *
   * ⚠ Read to SAVE it, not to act on it. Pointing steals the selection (E1) and
   * D6 makes restoring it Phase 1's debt; E14-F measured that the save/restore
   * round trip works and does not disturb the pool cursor.
   */
  selectionStatus: 'selection.status',

  cursorPin: 'cursor.pin',
  cursorPinTrack: 'cursor.pinTrack',
  cursorPointTrack: 'cursor.pointTrack',
  cursorStatus: 'cursor.status',
  cursorClipMetadata: 'cursor.clipMetadata',
  cursorSetClipMetadata: 'cursor.setClipMetadata',
  cursorSetStepSize: 'cursor.setStepSize',
  cursorScrollToStep: 'cursor.scrollToStep',
  cursorSetNotes: 'cursor.setNotes',
  cursorGetNotes: 'cursor.getNotes',
  cursorGetNotesVerbose: 'cursor.getNotesVerbose',
  cursorGetNotesVerboseAllChannels: 'cursor.getNotesVerboseAllChannels',
  cursorPlayState: 'cursor.playState',
  cursorLaunchSettings: 'cursor.launchSettings',
  cursorSetLaunchSettings: 'cursor.setLaunchSettings',
  cursorClearNotes: 'cursor.clearNotes',
  cursorSetNoteProps: 'cursor.setNoteProps',
  noteObserverPrepare: 'note.observer.prepare',
  noteObserverArm: 'note.observer.arm',
  noteObserverRead: 'note.observer.read',

  sceneCreate: 'scene.create',
  sceneCount: 'scene.count',
  sceneDelete: 'scene.delete',

  deviceList: 'device.list',
  /** Measured same-track before-anchor move, promoted for `device.relocate`. */
  deviceMoveTo: 'device.moveTo',
  /**
   * ⚠⚠ PROMOTED in session 3f step 6b, out of E18 §3.1 probe surface, and it is
   * the only route by which a layer chain is observable at all.
   *
   * ⚠ Why this one and not `layer.list`. `layer.list` reads `rig.layerBank0`,
   * which follows `cursorDevice0` — exactly ONE container is addressable at a
   * time, the container is named by hidden cursor state rather than by a
   * parameter (the e16o trap), and reaching an arbitrary container needs the
   * device-cursor apparatus that Phase 4 owns. `chain.inventory` reads
   * `Rig.slotLayerBanks`, layer banks hung off top-level device SLOTS: the
   * container is a parameter, and the slot, its chains and the devices inside
   * those chains arrive in ONE reply — which is also the guard, because three
   * E17 probes read "nothing happened" while a container changed one level above
   * where they looked.
   *
   * ⚠ Its reach is small and fixed, and the resolver treats the limits as
   * limits: `Rig.SLOT_SCOPES` container positions on the track `cursorTracks[0]`
   * points at, `SLOT_LAYER_BANK` chains, `SLOT_LAYER_DEVICE_BANK` devices. A
   * chain past the bank is `outside-bank-window`, never `absent`.
   */
  chainInventory: 'chain.inventory',
  /** Slot-scoped device relocation, promoted only for `chain.relocate`. */
  chainMove: 'chain.move',
  /**
   * ⚠⚠ NEW in session 3f step 6b-2, and the first WRITE in this system that
   * reaches inside a container. `layer.select` + `Channel.duplicate()`, the one
   * typed route `e17ak` found for making a chain — but reached through
   * `Rig.slotLayerBanks`, exactly as `chain.inventory` reads through them.
   *
   * ⚠ **Why a new method instead of the two `layer.*` ones `e17ak` used.** Those
   * act on `rig.layerBank0`, which follows `cursorDevice0`. Three consequences,
   * any one of them disqualifying:
   *
   *   - the container becomes a HIDDEN argument (the e16o trap), where every
   *     other call in this family names it by parameter;
   *   - the reader and the writer would then address containers through two
   *     different handles, so a chain resolved at slot 1 could be duplicated
   *     somewhere else entirely;
   *   - `cursorDevice0` is what `param.set` writes through. Moving it to reach a
   *     container would silently re-aim every parameter write in the same batch.
   *
   * ⚠ The DEVIATION is named rather than glossed: `e17ak` measured
   * `selectInEditor()` + `duplicate()` on a `DeviceLayer` obtained from
   * `layerBank0`, and this obtains the same chain from `slotLayerBanks`. Same
   * interface, same two calls, a different bank handle — which this project's own
   * repeated lesson (sibling verbs disagree) says is a measurement and not a
   * deduction. The live conformance row is what closes it.
   */
  /**
   * ⚠⚠ Make a chain the editor selection — and A SEPARATE CALL ON PURPOSE.
   *
   * `Channel.duplicate()` copies the chain that is SELECTED, and `e17ak` fired
   * the select one turn earlier. E2 says a write is not visible to a read in the
   * same request, so a select bundled into the duplicate's own turn would be
   * relying on a timing nobody has measured — and its failure mode is a silent
   * ○, indistinguishable from "the route does not work at all". `LiveAdapter`
   * sends this, settles, and only then sends the duplicate.
   */
  chainSelect: 'chain.select',
  chainDuplicate: 'chain.duplicate',
  /**
   * ⚠⚠ Rename a chain BY ITS WITHIN-SESSION ID, not by name and not by position.
   *
   * The second half of the create, and it cannot be addressed the way everything
   * else is: at the moment it runs the container holds two chains under one
   * name, because a duplicate carries its source's. A name would pick between
   * them by luck and a bank position would depend on where the copy landed —
   * either way a wrong guess renames the SOURCE and leaves the copy wearing the
   * source's name, breaking every address anyone held.
   *
   * ⚠ `channelId` is worthless ACROSS a project load (E17ad, E18b) and perfectly
   * good WITHIN the turn that just observed it, which is the only window this is
   * used in. The handler refuses an id it cannot find rather than falling back.
   */
  chainSetName: 'chain.setName',
  /** Container-local exclusive solo, addressed through the same slot scope as observation. */
  chainActivate: 'chain.activate',
  deviceInsertBitwig: 'device.insertBitwig',
  deviceInsertVst3: 'device.insertVst3',
  deviceInsertClap: 'device.insertClap',
  deviceInsertFile: 'device.insertFile',
  deviceDelete: 'device.delete',
  deviceSetEnabled: 'device.setEnabled',
  deviceCursorStatus: 'devcursor.status',
  deviceCursorPin: 'devcursor.pin',
  deviceCursorSelectAt: 'devcursor.selectAt',
  paramList: 'param.list',
  paramSet: 'param.set',
  directParamList: 'directparam.list',
  directParamSet: 'directparam.set',
  directParamCompletion: 'directparam.completion',
  remoteList: 'remote.list',
  remoteSet: 'remote.set',
  layerList: 'layer.list',
  drumPadList: 'drumpad.list',
  drumPadInsertDevice: 'drumpad.insertDevice',
  deviceCursorSelectInLayer: 'devcursor.selectInLayer',
  deviceCursorSelectFirstInPad: 'devcursor.selectFirstInPad',
  deviceCursorSelectFirstInSlot: 'devcursor.selectFirstInSlot',
  deviceCursorSelectInSlot: 'devcursor.selectInSlot',
  deviceCursorSelectParent: 'devcursor.selectParent',

  batchRun: 'batch.run',
  revisionGet: 'revision.get',

  /** Exact opaque access to the hidden per-project observation setting. */
  observationRead: 'observation.read',
  observationReplace: 'observation.replace',

  /** One-way product update for the Last change field. */
  statusPush: 'status.push',

  /** UI-only product navigation. The adapter resolves the durable track id first. */
  showChangedClip: 'navigation.showChangedClip',

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
  'branch.groupTrack': 'E22 — Group follows unobservable primary focus and can misdispatch into a device chain',
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
