/** Resolve one recorded clip change to a current, explicit Bitwig editor target. */
import {
  addressKey, clip as clipAt, deltaComplete,
  type Address, type ClipAddress,
} from '../contract/index.js';
import type { BoundaryVerdict, StashedChangeset } from '../stash/index.js';
import type { Workspace } from './workspace.js';

export interface ChangedClipTarget {
  readonly trackId: string;
  readonly row: number;
}

interface Candidate {
  readonly clip: ClipAddress;
  readonly target: ChangedClipTarget;
  readonly addresses: readonly Address[];
  readonly occupiedAfterChange: boolean;
}

const clipAddress = (address: Address): ClipAddress | undefined => {
  switch (address.kind) {
    case 'slot': return clipAt(address);
    case 'clip': return address;
    case 'notes':
    case 'clipLaunch':
    case 'clipPlay': return address.clip;
    default: return undefined;
  }
};

const targetOf = (clip: ClipAddress): ChangedClipTarget => ({
  trackId: clip.slot.track.channelId,
  row: clip.slot.scene.index,
});

const sameTarget = (left: ChangedClipTarget, right: ChangedClipTarget): boolean =>
  left.trackId === right.trackId && left.row === right.row;

const valueShowsContent = (change: StashedChangeset, address: Address): boolean => {
  const value = change.take.verify.entries[addressKey(address)]?.value;
  if (value === undefined) return false;
  switch (value.of) {
    case 'clip': return value.exists;
    case 'notes':
    case 'clipLaunch': return true;
    case 'clipPlay': return value.play.hasContent;
    default: return false;
  }
};

/**
 * Unique post-change clip locations. A move reports its occupied destination,
 * not its now-empty source. A deletion keeps its empty address so the caller
 * receives a missing-content result instead of an unsupported result.
 */
function candidatesOf(change: StashedChangeset): readonly Candidate[] {
  if (!change.take.report.applied) return [];
  const grouped = new Map<string, { clip: ClipAddress; addresses: Address[] }>();
  for (const writeTarget of change.take.targets) {
    const clip = clipAddress(writeTarget.address);
    if (clip === undefined) continue;
    const key = addressKey(clip);
    const group = grouped.get(key) ?? { clip, addresses: [] };
    group.addresses.push(writeTarget.address);
    grouped.set(key, group);
  }
  const all = [...grouped.values()].map((group) => {
    const clipStates = group.addresses
      .map((address) => change.take.verify.entries[addressKey(address)]?.value)
      .filter((value) => value?.of === 'clip');
    return {
      ...group,
      target: targetOf(group.clip),
      // A clip state is the direct occupancy fact. It takes precedence over a
      // notes state, which can remain in the write-set after a move emptied the
      // source slot.
      occupiedAfterChange: clipStates.length > 0
        ? clipStates.some((value) => value.exists)
        : group.addresses.some((address) => valueShowsContent(change, address)),
    };
  });
  const occupied = all.filter((candidate) => candidate.occupiedAfterChange);
  return occupied.length > 0 ? occupied : all;
}

const mismatch = (verdict: BoundaryVerdict): string => {
  switch (verdict) {
    case 'moved': return 'the recorded clip moved or was replaced after the change';
    case 'changed': return 'the recorded clip content no longer matches the change';
    case 'superseded': return 'a later change from this session changed the recorded clip';
    case 'undecidable': return 'launcher events since the change are incomplete';
    case 'blind': return 'the recorded clip is outside the current bank window';
    case 'unverified': return 'the change did not verify this clip after it wrote';
    case 'unread': return 'the recorded clip could not be read now';
    case 'unseen': return 'this session has no verified record for the clip';
    case 'ours': return '';
  }
};

export async function showChangedClip(
  workspace: Workspace,
  changeId: string,
  requested?: ChangedClipTarget,
): Promise<Record<string, unknown>> {
  const change = workspace.changes.require(changeId);
  const candidates = candidatesOf(change);
  const availableTargets = candidates.map((candidate) => candidate.target);
  if (candidates.length === 0) {
    return {
      navigated: false,
      supported: false,
      availableTargets,
      why: change.take.report.applied
        ? 'this change has no launcher clip target'
        : 'this recorded change did not apply',
    };
  }
  if (requested === undefined && candidates.length > 1) {
    return {
      navigated: false,
      ambiguous: true,
      availableTargets,
      why: 'this change has several clip targets. Select one by trackId and row.',
    };
  }
  const selected = requested === undefined
    ? candidates[0]
    : candidates.find((candidate) => sameTarget(candidate.target, requested));
  if (selected === undefined) {
    return {
      navigated: false,
      targetMismatch: true,
      availableTargets,
      why: 'the selected target is not a clip target of this change',
    };
  }

  const now = await workspace.mark();
  const recorded = change.take.verify.at;
  if (now.generation !== recorded.generation) {
    return {
      navigated: false, target: selected.target, availableTargets,
      why: 'Bitwig or the extension restarted after this change. The recorded target is stale.',
    };
  }
  if (now.project !== recorded.project || now.project === '') {
    return {
      navigated: false, target: selected.target, availableTargets,
      why: 'the foreground project does not match the project that recorded this change',
    };
  }
  if (now.sceneEpoch !== selected.clip.slot.scene.epoch) {
    return {
      navigated: false, target: selected.target, availableTargets,
      why: 'launcher rows changed after this address was recorded. The row is stale.',
    };
  }

  const unique = new Map<string, Address>();
  for (const address of [...selected.addresses, selected.clip]) unique.set(addressKey(address), address);
  const current = await workspace.read([...unique.values()]);
  const clipKey = addressKey(selected.clip);
  if (current.unreachable.some((address) => addressKey(address) === clipKey)) {
    return {
      navigated: false, target: selected.target, availableTargets,
      why: 'the recorded clip is outside the current bank window',
    };
  }

  const launcher = await workspace.contentSince(recorded);
  if (!deltaComplete(launcher)) {
    return {
      navigated: false, target: selected.target, availableTargets,
      why: 'launcher events since the change are incomplete, so the target cannot be verified',
    };
  }
  const relevant = new Set(selected.addresses.map(addressKey));
  const failed = workspace.changes.boundary(changeId, current, launcher)
    .find((check) => relevant.has(check.key) && check.verdict !== 'ours');
  if (failed !== undefined) {
    return {
      navigated: false,
      target: selected.target,
      availableTargets,
      mismatch: failed.verdict,
      why: mismatch(failed.verdict),
    };
  }
  const clipValue = current.entries[clipKey]?.value;
  if (clipValue?.of !== 'clip' || !clipValue.exists) {
    return {
      navigated: false, target: selected.target, availableTargets,
      why: 'the recorded launcher slot no longer holds a clip',
    };
  }

  // Close the gap between the snapshot, launcher window, and UI request. The
  // adapter and extension must validate this same mark. A newer mark can approve
  // a replacement occupant or a different project against itself.
  const verifiedAt = await workspace.mark();
  if (verifiedAt.revision !== current.at.revision
      || verifiedAt.generation !== current.at.generation
      || verifiedAt.project !== current.at.project
      || verifiedAt.sceneEpoch !== current.at.sceneEpoch
      || verifiedAt.contentEpoch !== launcher.now) {
    return {
      navigated: false, target: selected.target, availableTargets,
      why: 'Bitwig state changed while the clip target was being verified',
    };
  }

  const result = await workspace.showClipInEditor(selected.clip, verifiedAt);
  return {
    ...result,
    target: selected.target,
    availableTargets,
    effect: 'Bitwig UI focus only. Project content and the change record are unchanged.',
  };
}
