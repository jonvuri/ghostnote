/**
 * OBSERVING a device-layer chain — the half step 6a deliberately did not build.
 *
 * Step 6a landed the grammar: a chain is nameable, a device inside one is
 * nameable, and every route that could not reach inside a chain refuses instead
 * of indexing past it. Nothing resolved, and both adapters answered every
 * chain-family address `unsupported` — *"no chain lookup happened, so absence is
 * not known"*.
 *
 * This module is the lookup itself, and it lives in the CONTRACT rather than in
 * either adapter for the reason every shared refusal does: the fake models a
 * container with the same windows live Bitwig has, so a case that resolves
 * offline resolves live and a conformance row proves one behaviour rather than
 * two implementations of a hope.
 *
 * ⚠⚠ **What makes this different from every other resolution in the system: a
 * chain is found by NAME, and a name is not a key.** `ChainAddress` says why
 * (the loader mints a chain's `channelId` afresh on every project load, E17ad/
 * E18b, while the name survives), and it names the two obligations that fall on
 * whoever resolves one. Both are implemented here:
 *
 *   - a name matching MORE THAN ONE chain is `ambiguous`, never the first hit —
 *     `e17n` produced exactly that fixture, a duplicated container whose chains
 *     have identical names and different ids;
 *   - a name matching NONE is `absent` only when the window was known to be
 *     complete. Otherwise it is `outside-bank-window`, because a chain bank is
 *     small and fixed (`Rig.SLOT_LAYER_BANK`) and *"we could not see it"* must
 *     never be reported as *"it is not there"* (E5, standing rule 5, and the
 *     same distinction `LiveAdapter.resolve` already makes for tracks).
 *
 * ⚠ DEPTH ONE ONLY. The grammar is recursive — `chainPath` walks a chain inside
 * a chain inside a chain — and no wire route enumerates past the first level:
 * `chain.inventory` reads a container's chains and the devices in them, and
 * stops there. A deeper address is `unsupported` (we cannot look), never
 * `absent` (we looked and it was not there). Truncating the path to the part we
 * can walk would answer a question about one chain with a fact about a different
 * one, which is the whole failure class `assertDevicesRoutable` exists to
 * prevent.
 *
 * ⚠ Session 3f step 6b-2 added ONE thing to this module and it is not a lookup:
 * `mintedChain`, which answers *which chain did the create just make* from two
 * observations. It lives here rather than in an adapter for the same reason the
 * lookups do — both adapters must identify a minted chain by the same rule, or
 * the offline suite is certifying a discipline the live one does not have.
 */
import { chainPath, type ChainAddress, type DeviceAddress } from './address.js';

/** One device seen inside a chain, at the position the container reported. */
export interface ObservedDevice {
  readonly index: number;
  readonly name: string;
}

/** One independently enumerated device chain, top-level or nested. */
export interface ObservedDeviceSequence {
  readonly devices: readonly ObservedDevice[];
  /** True only when the enumeration proved that no device was hidden. */
  readonly devicesComplete: boolean;
}

/**
 * One chain of a container, as the enumeration reported it — and the value a
 * `read` of a `ChainAddress` returns.
 *
 * ⚠ ONE shape for one fact, deliberately, the way `tracks()` returns the same
 * `TrackState` a track read does. A separate "chain state" type would be a
 * second reading of the same observation, free to disagree with the first.
 *
 * ⚠ `devicesComplete` is not decoration and it is not derivable from
 * `devices.length`. The enumeration skips bank slots that hold nothing, so a
 * short list means either a short chain or a chain whose tail is past the bank —
 * and only the bank SIZE separates them. False is the safe value: it turns a
 * device we cannot see into `outside-bank-window` rather than into `absent`.
 */
export interface ObservedChain {
  readonly index: number;
  readonly name: string;
  readonly devices: readonly ObservedDevice[];
  readonly devicesComplete: boolean;
  /** Width of the nested device bank; absent on an older deployment. */
  readonly devicesBankSize?: number;
  /**
   * ⚠⚠ A WITHIN-SESSION WITNESS, and never an address. Read the sentence twice
   * before using this field, because the whole chain grammar rests on it being
   * the second thing and not the first.
   *
   * A chain does hand out a `channelId`, and it is worthless as a key: the
   * project LOADER mints it, so it regenerates on every document load while the
   * name survives (E17ad 8/8 changed with the track ids unchanged in the same
   * read; E18b separated the two reload kinds and closed it). That is precisely
   * why `ChainAddress` addresses by NAME.
   *
   * What it IS good for is the one question a name cannot answer: *which of
   * these two chains did we just create?* Chain creation is
   * `layer.select` + `Channel.duplicate()` (`e17ak`), and a duplicate carries
   * its source's NAME — so between the copy and its rename the container holds
   * two chains a name cannot tell apart, and `lookupChain` correctly refuses
   * both as `ambiguous`. `mintedChain` uses this id to identify the new one, in
   * the same turn it was made, exactly the way `apply` diffs the track bank by
   * `channelId` after a `track.create` (E2c).
   *
   * ⚠ OPTIONAL, and absence must fail closed. An extension too old to report it
   * answers with silence, which `methodsHash` cannot see — so `mintedChain`
   * declines to identify anything rather than falling back to position.
   */
  readonly id?: string;
}

/**
 * Check one relocation from structural readings taken on either side.
 * Acknowledgements and writer-held handles are intentionally absent.
 */
export function verifyDeviceRelocation(
  sourceIndex: number,
  mode: 'move' | 'copy',
  beforeSource: ObservedDeviceSequence,
  beforeDestination: ObservedDeviceSequence,
  afterSource: ObservedDeviceSequence,
  afterDestination: ObservedDeviceSequence,
): { readonly ok: true; readonly device: ObservedDevice } | { readonly ok: false; readonly why: string } {
  const complete = [beforeSource, beforeDestination, afterSource, afterDestination]
    .every((reading) => reading.devicesComplete);
  if (!complete) return { ok: false, why: 'source or destination device structure was outside its bank window' };

  const sourceAt = beforeSource.devices.findIndex((device) => device.index === sourceIndex);
  const source = beforeSource.devices[sourceAt];
  if (source === undefined) return { ok: false, why: `no source device exists at index ${sourceIndex}` };

  const names = (reading: ObservedDeviceSequence): string[] => reading.devices.map((device) => device.name);
  const beforeSourceNames = names(beforeSource);
  const beforeDestinationNames = names(beforeDestination);
  const expectedSource = mode === 'move'
    ? beforeSourceNames.filter((_, index) => index !== sourceAt)
    : beforeSourceNames;
  const expectedDestination = [...beforeDestinationNames, source.name];
  const afterSourceNames = names(afterSource);
  const afterDestinationNames = names(afterDestination);

  if (JSON.stringify(afterSourceNames) !== JSON.stringify(expectedSource)) {
    return {
      ok: false,
      why: `source readback was [${afterSourceNames.join(', ')}], expected [${expectedSource.join(', ')}]`,
    };
  }
  if (JSON.stringify(afterDestinationNames) !== JSON.stringify(expectedDestination)) {
    return {
      ok: false,
      why: `destination readback was [${afterDestinationNames.join(', ')}], expected [${expectedDestination.join(', ')}]`,
    };
  }
  const beforePopulation = beforeSource.devices.length + beforeDestination.devices.length;
  const afterPopulation = afterSource.devices.length + afterDestination.devices.length;
  const expectedPopulation = beforePopulation + (mode === 'copy' ? 1 : 0);
  if (afterPopulation !== expectedPopulation) {
    return {
      ok: false,
      why: `observable device population changed ${beforePopulation} -> ${afterPopulation}; expected ${expectedPopulation}`,
    };
  }
  return { ok: true, device: source };
}

/**
 * A container device's chains, as one observation.
 *
 * ⚠ Read TOGETHER, never assembled from separate calls. Three E17 probes read
 * "nothing happened" while a container was being duplicated one level above
 * where they looked, and `e17ac` shipped that blind spot a third time after it
 * had been written up as a method trap. `chain.inventory` exists to report every
 * level in one reply, and this type keeps them together on the way in.
 */
export interface ObservedContainer {
  readonly chains: readonly ObservedChain[];
  /** ⚠ Was the chain bank known to hold everything? See `ObservedChain.devicesComplete`. */
  readonly chainsComplete: boolean;
  /**
   * ⚠ How wide the chain bank is (`Rig.SLOT_LAYER_BANK`) — the number
   * `chainsComplete` is a yes/no answer about.
   *
   * Both are carried because they answer different questions and only one of
   * them can be projected. `chainsComplete` says whether THIS reading saw
   * everything; the SIZE is what lets a guard reason about a container two
   * creates from now, without taking a second reading it has no way to take
   * (nothing has been applied yet). `assertChainCreatable` needs exactly that,
   * for the same reason `assertSceneRoom` needs `WindowCoverage.bankSize`: a
   * budget that re-checks the current count per op lets a pair through and
   * strands the second one.
   *
   * ⚠ OPTIONAL, and absence must fail closed. An extension too old to report it
   * also makes `chainsComplete` false on both adapters, so a create is refused
   * either way — but a guard must never treat a missing size as room.
   */
  readonly chainsBankSize?: number;
}

/**
 * Why a chain-family address did not resolve. Deliberately the same vocabulary
 * `ResolvedAddress.reason` carries, so an adapter maps rather than translates —
 * a translation table is where two adapters start disagreeing about what they
 * saw.
 */
export type ChainMiss = 'absent' | 'outside-bank-window' | 'ambiguous' | 'unsupported';

export type ChainLookup =
  | { readonly ok: true; readonly chain: ObservedChain }
  | { readonly ok: false; readonly miss: ChainMiss };

export type DeviceLookup =
  | { readonly ok: true; readonly device: ObservedDevice }
  | { readonly ok: false; readonly miss: ChainMiss };

/** How deep the nesting goes. 0 is a top-level device; 1 is inside one chain. */
export const nestingDepth = (a: ChainAddress | DeviceAddress): number => chainPath(a).length;

/**
 * ⚠ Can any measured route observe this address at all?
 *
 * The container of an observable chain is a device on the TRACK's own chain, and
 * nothing deeper. Everything else is `unsupported` — see the module header.
 */
export const nestingObservable = (a: ChainAddress | DeviceAddress): boolean => nestingDepth(a) <= 1;

/**
 * Find the chain this address names, or say precisely why not.
 *
 * ⚠ The order of the tests is the contract. Ambiguity is checked BEFORE
 * emptiness, because two matches is a fact about what we saw and no window
 * question can soften it; completeness is checked only in the zero-match case,
 * which is the one place a blind spot and a tombstone look alike.
 */
export function lookupChain(container: ObservedContainer, name: string): ChainLookup {
  const matches = container.chains.filter((c) => c.name === name);
  if (matches.length > 1) return { ok: false, miss: 'ambiguous' };
  const hit = matches[0];
  if (hit !== undefined) return { ok: true, chain: hit };
  return { ok: false, miss: container.chainsComplete ? 'absent' : 'outside-bank-window' };
}

/**
 * Find a device at `chainIndex` INSIDE an already-resolved chain.
 *
 * ⚠ By POSITION, and the position is the one the enumeration reported rather
 * than an offset into the returned array. Empty bank slots are skipped on the
 * way out, so `devices[2]` and *"the device at chain index 2"* are different
 * questions the moment a chain has a hole in it.
 */
export function lookupDevice(chain: ObservedChain, chainIndex: number): DeviceLookup {
  if (chainIndex < 0) return { ok: false, miss: 'absent' };
  const hit = chain.devices.find((d) => d.index === chainIndex);
  if (hit !== undefined) return { ok: true, device: hit };
  return { ok: false, miss: chain.devicesComplete ? 'absent' : 'outside-bank-window' };
}

/**
 * The whole path in one call: the container's chains in, the addressed device
 * out.
 *
 * ⚠ Both halves are checked, in order, and a `found` is only ever returned by
 * the second one. Resolving the chain and then trusting the index is how a
 * nested address gets answered with the state of whatever sits at that position
 * in some other list — the failure `C-nested-device` was written to make
 * impossible.
 */
export function lookupNestedDevice(
  container: ObservedContainer,
  address: DeviceAddress,
): DeviceLookup {
  const chainRef = address.chain;
  if (chainRef === undefined || !nestingObservable(address)) {
    return { ok: false, miss: 'unsupported' };
  }
  const found = lookupChain(container, chainRef.name);
  if (!found.ok) return { ok: false, miss: found.miss };
  return lookupDevice(found.chain, address.chainIndex);
}

/**
 * ⚠⚠ WHICH CHAIN A CREATE JUST MADE — from two observations of the container,
 * never from a count and never from the position anyone expected.
 *
 * The exact sibling of `mintedChainIndex` (a device insert) and of `apply`'s
 * track-bank diff (E2c), and the reason all three exist is one rule: *name the
 * survivor, never count it* (D20). Here the rule bites harder than usual,
 * because the create is a DUPLICATION and a duplicate carries its source's
 * name — so the container momentarily holds two chains that a name cannot tell
 * apart, and picking the wrong one renames the SOURCE while leaving the copy
 * wearing the source's name. Every address anyone held to the source would then
 * be pointing at an object that is no longer called that.
 *
 * ⚠ Identity, not position, and position is not a fallback. A duplicate landing
 * *after* its source is a reasonable expectation and nothing has measured it;
 * if the copy landed anywhere else, a positional rule would confidently rename
 * the wrong chain. `ObservedChain.id` is the within-session witness — see the
 * ⚠⚠ on that field for why it is a witness and never an address.
 *
 * ⚠ FAILS CLOSED, in four separate ways, because the consequence of a wrong
 * answer is a rename aimed at somebody else's chain:
 *
 *   - the BEFORE view was incomplete — the prior set is then unknown, so a
 *     chain that was already there could look new;
 *   - any chain missing its id — an older deployment, and silence must not
 *     degrade into a positional guess;
 *   - the count did not grow by exactly one, or a chain that was there before
 *     is gone (which is what a copy pushing a chain past the window looks like);
 *   - the new ids do not number exactly one.
 *
 * ⚠⚠ The AFTER view is deliberately allowed to be incomplete, and the asymmetry
 * is load-bearing rather than a relaxation. A complete before view has strictly
 * fewer chains than the bank is wide, so the one this call adds is always inside
 * the window — but the container is then FULL, and a full bank reports itself
 * incomplete by construction (`ObservedChain.devicesComplete` explains why).
 * Requiring completeness on both sides would therefore make the last slot of
 * every container permanently unusable: the copy would land, the diff would
 * decline, and the chain would be left wearing its source's name. That is a
 * deterministic defect traded against a race — two chains appearing between the
 * two readings — that the `lost`-id check above already catches whenever the new
 * arrival displaces anything, and that the track-bank mint in `apply` has lived
 * with since E2c.
 */
export type ChainMint =
  | { readonly ok: true; readonly chain: ObservedChain }
  | { readonly ok: false; readonly why: string };

/**
 * What a create that copied but could not NAME has left behind, in one sentence
 * both adapters use.
 *
 * ⚠ Shared rather than written twice, because it is the sentence a user acts on
 * and the sentence a conformance row matches. Two hand-written copies is how the
 * fake ends up reporting a softer version of what live reports — and this
 * particular failure is one nothing can clean up automatically, so the wording
 * is the entire remedy.
 */
export const chainCopyUnnamed = (sourceName: string, why: string): string =>
  `${why}. A chain was copied and is still called "${sourceName}", so that name now names two `
  + 'chains and neither resolves. There is no typed route to remove it (e17al, e17am); the '
  + 'container has to be reduced by hand.';

export function mintedChain(before: ObservedContainer, after: ObservedContainer): ChainMint {
  if (!before.chainsComplete) {
    return {
      ok: false,
      why: 'the chain bank was already full before the copy, so the set of chains that were '
        + 'there is unknown and one of them could pass for the new one',
    };
  }
  const ids = (c: ObservedContainer): string[] | undefined => {
    const out: string[] = [];
    for (const item of c.chains) {
      if (item.id === undefined || item.id === '') return undefined;
      out.push(item.id);
    }
    return out;
  };
  const was = ids(before);
  const now = ids(after);
  if (was === undefined || now === undefined) {
    return {
      ok: false,
      why: 'the container enumeration did not carry a per-chain identity, so which chain is new '
        + 'cannot be observed — and position is not an acceptable substitute for it',
    };
  }
  if (now.length !== was.length + 1) {
    return {
      ok: false,
      why: `the container held ${was.length} chains and now holds ${now.length}; exactly one more `
        + 'was expected, so what happened is not the create that was asked for',
    };
  }
  const seen = new Set(now);
  const lost = was.filter((id) => !seen.has(id));
  if (lost.length > 0) {
    return { ok: false, why: 'a chain that was there before the create is no longer there' };
  }
  const had = new Set(was);
  const fresh = after.chains.filter((c) => !had.has(c.id!));
  const one = fresh[0];
  if (fresh.length !== 1 || one === undefined) {
    return { ok: false, why: `${fresh.length} chains are new, and exactly one was expected` };
  }
  return { ok: true, chain: one };
}
