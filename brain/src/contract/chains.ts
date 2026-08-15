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
 */
import { chainPath, type ChainAddress, type DeviceAddress } from './address.js';

/** One device seen inside a chain, at the position the container reported. */
export interface ObservedDevice {
  readonly index: number;
  readonly name: string;
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
