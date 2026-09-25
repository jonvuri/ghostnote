/** Probe-only cache identity and lifecycle model for Phase 8d. */

export interface ClipAddress {
  readonly channelId: string;
  readonly row: number;
}

export interface ProjectWitness {
  readonly name: string;
  readonly trackIds: readonly string[];
}

export interface ClipCandidate {
  readonly address: ClipAddress;
  readonly fingerprint: string;
}

export interface ContentEvent {
  readonly sequence: number;
  readonly address: ClipAddress;
  readonly filled: boolean;
}

export type EntryState =
  | 'warming'
  | 'complete'
  | 'dirty'
  | 'repairing'
  | 'ambiguous'
  | 'deleted'
  | 'invalid';

export type RegistryHealth =
  | 'empty'
  | 'warming'
  | 'complete'
  | 'repairing'
  | 'rebuilding'
  | 'ambiguous'
  | 'invalid';

export interface CacheEntry {
  readonly logicalId: string;
  readonly projectGeneration: number;
  readonly address: ClipAddress;
  readonly slotIdentity: string;
  readonly fingerprint: string;
  readonly contentGeneration: number;
  readonly bindingGeneration: number;
  readonly state: EntryState;
}

export interface CallbackToken {
  readonly projectGeneration: number;
  readonly structuralEpoch: number;
  readonly bindingGeneration: number;
  readonly rebuildGeneration: number;
}

export interface RebuildToken {
  readonly projectGeneration: number;
  readonly structuralEpoch: number;
  readonly rebuildGeneration: number;
}

export interface TransitionResult {
  readonly kind: 'move' | 'create' | 'delete' | 'replace' | 'ambiguous' | 'none';
  readonly preserved: readonly string[];
  readonly minted: readonly string[];
  readonly retired: readonly string[];
}

const addressKey = (address: ClipAddress): string => `${address.channelId}:${address.row}`;

function witnessKey(witness: ProjectWitness): string {
  return JSON.stringify({
    name: witness.name,
    trackIds: [...witness.trackIds].sort(),
  });
}

/**
 * Model the minimum identity rules for the 8d live probe.
 *
 * This is not the product cache. It stores no note data or host handles.
 */
export class CacheLifecycleRegistry {
  private readonly entriesByAddress = new Map<string, CacheEntry>();
  private readonly retiredEntries = new Map<string, CacheEntry>();
  private idSequence = 0;
  private projectGenerationValue = 0;
  private structuralEpochValue = 0;
  private rebuildGenerationValue = 0;
  private bindingGenerationValue = 0;
  private extensionGeneration = '';
  private projectWitnessKey = '';
  private healthValue: RegistryHealth = 'empty';

  get projectGeneration(): number {
    return this.projectGenerationValue;
  }

  get structuralEpoch(): number {
    return this.structuralEpochValue;
  }

  get rebuildGeneration(): number {
    return this.rebuildGenerationValue;
  }

  get health(): RegistryHealth {
    return this.healthValue;
  }

  entries(): readonly CacheEntry[] {
    return [...this.entriesByAddress.values()]
      .sort((left, right) => addressKey(left.address).localeCompare(addressKey(right.address)));
  }

  retired(): readonly CacheEntry[] {
    return [...this.retiredEntries.values()];
  }

  /** A controller load or project witness change starts a new identity domain. */
  beginProject(extensionGeneration: string, witness: ProjectWitness): void {
    for (const entry of this.entriesByAddress.values()) {
      this.retire(entry, 'invalid');
    }
    this.entriesByAddress.clear();
    this.projectGenerationValue += 1;
    this.structuralEpochValue += 1;
    this.rebuildGenerationValue += 1;
    this.bindingGenerationValue += 1;
    this.extensionGeneration = extensionGeneration;
    this.projectWitnessKey = witnessKey(witness);
    this.healthValue = 'rebuilding';
  }

  /**
   * Compare identity only at an explicit project foreground boundary.
   * Ordinary track edits must use structural transitions instead.
   */
  observeProject(extensionGeneration: string, witness: ProjectWitness): boolean {
    const nextWitness = witnessKey(witness);
    if (this.projectGenerationValue === 0
        || extensionGeneration !== this.extensionGeneration
        || nextWitness !== this.projectWitnessKey) {
      this.beginProject(extensionGeneration, witness);
      return true;
    }
    return false;
  }

  /** Start one atomic staging rebuild. */
  startRebuild(): RebuildToken {
    this.rebuildGenerationValue += 1;
    this.healthValue = 'rebuilding';
    return {
      projectGeneration: this.projectGenerationValue,
      structuralEpoch: this.structuralEpochValue,
      rebuildGeneration: this.rebuildGenerationValue,
    };
  }

  /**
   * Publish one complete rebuild. A full rebuild mints identities by default.
   * Same-address retention is valid only with a complete event window.
   */
  finishRebuild(
    token: RebuildToken,
    candidates: readonly ClipCandidate[],
    identityEvidence: 'mint' | 'continuous-same-address' = 'mint',
  ): boolean {
    if (!this.matchesRebuild(token)) return false;
    const old = new Map(this.entriesByAddress);
    const next = new Map<string, CacheEntry>();
    for (const candidate of candidates) {
      const key = addressKey(candidate.address);
      const prior = old.get(key);
      const canRetain = identityEvidence === 'continuous-same-address'
        && prior !== undefined
        && prior.projectGeneration === this.projectGenerationValue
        && prior.fingerprint === candidate.fingerprint
        && prior.state !== 'deleted'
        && prior.state !== 'invalid';
      next.set(key, canRetain
        ? this.updateEntry(prior, candidate.address, candidate.fingerprint, 'complete')
        : this.mint(candidate, 'complete'));
    }
    for (const [key, entry] of old) {
      if (!next.has(key) || next.get(key)?.logicalId !== entry.logicalId) {
        this.retire(entry, 'invalid');
      }
    }
    this.entriesByAddress.clear();
    for (const [key, entry] of next) this.entriesByAddress.set(key, entry);
    this.healthValue = 'complete';
    return true;
  }

  /** An interrupted rebuild cannot publish its partial staging state. */
  abortRebuild(token: RebuildToken): boolean {
    if (!this.matchesRebuild(token)) return false;
    this.rebuildGenerationValue += 1;
    this.healthValue = 'invalid';
    for (const [key, entry] of this.entriesByAddress) {
      this.entriesByAddress.set(key, { ...entry, state: 'invalid' });
    }
    return true;
  }

  /** Bind one observer to the current structural and project epochs. */
  bind(address: ClipAddress): CallbackToken {
    this.bindingGenerationValue += 1;
    const key = addressKey(address);
    const entry = this.entriesByAddress.get(key);
    if (entry !== undefined) {
      this.entriesByAddress.set(key, {
        ...entry,
        bindingGeneration: this.bindingGenerationValue,
        state: 'warming',
      });
      this.healthValue = 'warming';
    }
    return this.callbackToken();
  }

  callbackToken(): CallbackToken {
    return {
      projectGeneration: this.projectGenerationValue,
      structuralEpoch: this.structuralEpochValue,
      bindingGeneration: this.bindingGenerationValue,
      rebuildGeneration: this.rebuildGenerationValue,
    };
  }

  acceptsCallback(token: CallbackToken): boolean {
    return token.projectGeneration === this.projectGenerationValue
      && token.structuralEpoch === this.structuralEpochValue
      && token.bindingGeneration === this.bindingGenerationValue
      && token.rebuildGeneration === this.rebuildGenerationValue;
  }

  /** Update note content without changing clip identity. */
  updateContent(address: ClipAddress, fingerprint: string): CacheEntry {
    const key = addressKey(address);
    const prior = this.entriesByAddress.get(key);
    if (prior === undefined) throw new Error(`no cache entry at ${key}`);
    const updated = this.updateEntry(prior, address, fingerprint, 'complete');
    this.entriesByAddress.set(key, updated);
    this.healthValue = 'complete';
    return updated;
  }

  /**
   * Apply one complete launcher-content event window.
   *
   * A move needs one empty event, one fill event, an empty destination, and an
   * authority fingerprint match. All other fills mint a new identity.
   */
  reconcileContentEvents(
    events: readonly ContentEvent[],
    after: readonly ClipCandidate[],
  ): TransitionResult {
    const afterByAddress = new Map(after.map((item) => [addressKey(item.address), item]));
    const emptyEvents = events.filter((event) => !event.filled);
    const fillEvents = events.filter((event) => event.filled);
    const preserved: string[] = [];
    const minted: string[] = [];
    const retired: string[] = [];

    if (events.length === 2 && emptyEvents.length === 1 && fillEvents.length === 1
        && events[0] === emptyEvents[0] && events[1] === fillEvents[0]
        && events[0].sequence < events[1].sequence) {
      const sourceKey = addressKey(emptyEvents[0]!.address);
      const destinationKey = addressKey(fillEvents[0]!.address);
      const source = this.entriesByAddress.get(sourceKey);
      const destinationBefore = this.entriesByAddress.get(destinationKey);
      const destinationAfter = afterByAddress.get(destinationKey);
      if (source !== undefined && destinationBefore === undefined
          && destinationAfter !== undefined
          && source.fingerprint === destinationAfter.fingerprint) {
        this.entriesByAddress.delete(sourceKey);
        const moved = this.updateEntry(
          source, destinationAfter.address, destinationAfter.fingerprint, 'complete',
        );
        this.entriesByAddress.set(destinationKey, moved);
        preserved.push(moved.logicalId);
        this.afterStructuralRepair();
        return { kind: 'move', preserved, minted, retired };
      }
    }

    let sawReplacement = false;
    for (const event of events) {
      const key = addressKey(event.address);
      if (!event.filled) {
        const prior = this.entriesByAddress.get(key);
        if (prior !== undefined) {
          this.entriesByAddress.delete(key);
          this.retire(prior, 'deleted');
          retired.push(prior.logicalId);
        }
        continue;
      }
      const prior = this.entriesByAddress.get(key);
      const candidate = afterByAddress.get(key);
      if (prior !== undefined) {
        this.entriesByAddress.delete(key);
        this.retire(prior, 'deleted');
        retired.push(prior.logicalId);
        sawReplacement = true;
      }
      if (candidate !== undefined) {
        const created = this.mint(candidate, 'complete');
        this.entriesByAddress.set(key, created);
        minted.push(created.logicalId);
      }
    }
    this.afterStructuralRepair();
    let kind: TransitionResult['kind'] = 'none';
    if (sawReplacement || (emptyEvents.length > 0 && fillEvents.length > 0)) kind = 'replace';
    else if (fillEvents.length > 0) kind = 'create';
    else if (emptyEvents.length > 0) kind = 'delete';
    return { kind, preserved, minted, retired };
  }

  /** Repair row addresses after one known scene deletion. */
  deleteScene(row: number): readonly string[] {
    const retired: string[] = [];
    const next = new Map<string, CacheEntry>();
    for (const entry of this.entriesByAddress.values()) {
      if (entry.address.row === row) {
        this.retire(entry, 'deleted');
        retired.push(entry.logicalId);
        continue;
      }
      const address = entry.address.row > row
        ? { ...entry.address, row: entry.address.row - 1 }
        : entry.address;
      next.set(addressKey(address), this.updateEntry(entry, address, entry.fingerprint, 'repairing'));
    }
    this.replaceEntries(next);
    this.afterStructuralRepair();
    return retired;
  }

  /** A scene insertion keeps addresses only when its exact row is known. */
  insertScene(row: number): void {
    const next = new Map<string, CacheEntry>();
    for (const entry of this.entriesByAddress.values()) {
      const address = entry.address.row >= row
        ? { ...entry.address, row: entry.address.row + 1 }
        : entry.address;
      next.set(addressKey(address), this.updateEntry(entry, address, entry.fingerprint, 'repairing'));
    }
    this.replaceEntries(next);
    this.afterStructuralRepair();
  }

  /** Track position changes keep channel identities but invalidate bindings. */
  trackPositionChanged(): void {
    this.afterStructuralRepair();
  }

  /** A deleted track retires every logical clip on that channel identity. */
  deleteTrack(channelId: string): readonly string[] {
    const retired: string[] = [];
    for (const [key, entry] of this.entriesByAddress) {
      if (entry.address.channelId !== channelId) continue;
      this.entriesByAddress.delete(key);
      this.retire(entry, 'deleted');
      retired.push(entry.logicalId);
    }
    this.afterStructuralRepair();
    return retired;
  }

  /** Group visibility can change the complete flat inventory. Rebuild it. */
  groupTopologyChanged(): RebuildToken {
    this.structuralEpochValue += 1;
    this.bindingGenerationValue += 1;
    return this.startRebuild();
  }

  /** Mark identical candidates as ambiguous. Do not select one by order. */
  candidateAmbiguity(fingerprint: string, candidates: readonly ClipCandidate[]): 'none' | 'one' | 'many' {
    const matches = candidates.filter((candidate) => candidate.fingerprint === fingerprint);
    if (matches.length === 0) return 'none';
    if (matches.length === 1) return 'one';
    this.healthValue = 'ambiguous';
    return 'many';
  }

  private afterStructuralRepair(): void {
    this.structuralEpochValue += 1;
    this.bindingGenerationValue += 1;
    this.healthValue = this.entriesByAddress.size === 0 ? 'empty' : 'repairing';
    for (const [key, entry] of this.entriesByAddress) {
      this.entriesByAddress.set(key, {
        ...entry,
        bindingGeneration: this.bindingGenerationValue,
        state: 'repairing',
        slotIdentity: this.slotIdentity(entry.address),
      });
    }
  }

  private mint(candidate: ClipCandidate, state: EntryState): CacheEntry {
    return {
      logicalId: `gnclip-${++this.idSequence}`,
      projectGeneration: this.projectGenerationValue,
      address: candidate.address,
      slotIdentity: this.slotIdentity(candidate.address),
      fingerprint: candidate.fingerprint,
      contentGeneration: 1,
      bindingGeneration: this.bindingGenerationValue,
      state,
    };
  }

  private updateEntry(
    prior: CacheEntry,
    address: ClipAddress,
    fingerprint: string,
    state: EntryState,
  ): CacheEntry {
    return {
      ...prior,
      address,
      slotIdentity: this.slotIdentity(address),
      fingerprint,
      contentGeneration: prior.fingerprint === fingerprint
        ? prior.contentGeneration
        : prior.contentGeneration + 1,
      bindingGeneration: this.bindingGenerationValue,
      state,
    };
  }

  private retire(entry: CacheEntry, state: 'deleted' | 'invalid'): void {
    this.retiredEntries.set(entry.logicalId, { ...entry, state });
  }

  private replaceEntries(next: Map<string, CacheEntry>): void {
    this.entriesByAddress.clear();
    for (const [key, entry] of next) this.entriesByAddress.set(key, entry);
  }

  private slotIdentity(address: ClipAddress): string {
    return `${this.projectGenerationValue}:${this.structuralEpochValue}:${addressKey(address)}`;
  }

  private matchesRebuild(token: RebuildToken): boolean {
    return token.projectGeneration === this.projectGenerationValue
      && token.structuralEpoch === this.structuralEpochValue
      && token.rebuildGeneration === this.rebuildGenerationValue;
  }
}
