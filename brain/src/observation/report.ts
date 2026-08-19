/** Read-only descriptive reporting for the observation record. */
import {
  type InstructionObservation,
  type ObservationRecord,
  type OperatorResponse,
  type RequestedScope,
} from './record.js';

export interface OperatorResponseCounts {
  readonly silent: number;
  readonly accepted: number;
  readonly vetoed: number;
}

export interface OperatorResponseRates {
  readonly silent: number;
  readonly accepted: number;
  readonly vetoed: number;
}

export interface ActualResultProfile {
  readonly deviceAlternateEvents: number;
  readonly clipBlockEvents: number;
  readonly copyTrackUses: number;
  readonly generationUses: number;
  readonly transformationUses: number;
}

export interface ObservationCrossTabRow {
  readonly descriptionVersion: string;
  readonly requestedScope: RequestedScope;
  /** Independent result counts. This value does not define a shared lifecycle. */
  readonly actualResults: ActualResultProfile;
  readonly instructionCount: number;
  readonly operatorResponses: OperatorResponseCounts;
  readonly operatorResponseRates: OperatorResponseRates;
}

export interface ObservationScopeSummary {
  readonly descriptionVersion: string;
  readonly requestedScope: RequestedScope;
  readonly instructionCount: number;
  /** Number of different exact result profiles observed for this requested scope. */
  readonly choiceDiversity: number;
  readonly operatorResponses: OperatorResponseCounts;
  readonly operatorResponseRates: OperatorResponseRates;
}

export interface ObservationReport {
  readonly format: ObservationRecord['format'];
  readonly schemaVersion: ObservationRecord['schemaVersion'];
  readonly totals: {
    readonly entries: number;
    readonly instructions: number;
    readonly managedEvents: number;
    readonly ordinaryUses: number;
    readonly musicalUses: number;
    readonly resultReferences: number;
  };
  readonly managedEvents: {
    readonly deviceAlternate: number;
    readonly clipBlock: number;
  };
  readonly ordinaryUses: { readonly copyTrack: number };
  readonly musicalUses: {
    readonly generation: number;
    readonly transformation: number;
    readonly applied: number;
  };
  readonly instructionsWithoutResults: number;
  readonly unreferencedResults: {
    readonly managedEvents: number;
    readonly ordinaryUses: number;
    readonly musicalUses: number;
  };
  readonly operatorResponses: OperatorResponseCounts;
  readonly descriptionVersions: readonly {
    readonly descriptionVersion: string;
    readonly instructionObservations: number;
    readonly managedEvents: number;
    readonly ordinaryUses: number;
    readonly musicalUses: number;
  }[];
  readonly scopeSummaries: readonly ObservationScopeSummary[];
  readonly crossTab: readonly ObservationCrossTabRow[];
}

const REQUESTED_SCOPE_ORDER: readonly RequestedScope[] = [
  'device-only', 'launcher-clip-only', 'mixed', 'unsupported',
];

const emptyResponses = (): OperatorResponseCounts => ({
  silent: 0, accepted: 0, vetoed: 0,
});

const addResponse = (
  counts: OperatorResponseCounts,
  response: OperatorResponse,
): OperatorResponseCounts => ({ ...counts, [response]: counts[response] + 1 });

const rates = (counts: OperatorResponseCounts): OperatorResponseRates => {
  const total = counts.silent + counts.accepted + counts.vetoed;
  return total === 0
    ? { silent: 0, accepted: 0, vetoed: 0 }
    : {
      silent: counts.silent / total,
      accepted: counts.accepted / total,
      vetoed: counts.vetoed / total,
    };
};

const profileKey = (profile: ActualResultProfile): string => [
  profile.deviceAlternateEvents,
  profile.clipBlockEvents,
  profile.copyTrackUses,
  profile.generationUses,
  profile.transformationUses,
].join(':');

function actualResults(
  instruction: InstructionObservation,
  entries: ReadonlyMap<string, ObservationRecord['entries'][number]>,
): ActualResultProfile {
  let deviceAlternateEvents = 0;
  let clipBlockEvents = 0;
  let copyTrackUses = 0;
  let generationUses = 0;
  let transformationUses = 0;
  for (const id of instruction.resultIds) {
    const result = entries.get(id);
    if (result?.type === 'ordinary-use') copyTrackUses += 1;
    if (result?.type === 'musical-use' && result.tool === 'generate_clip_music') {
      generationUses += 1;
    }
    if (result?.type === 'musical-use' && result.tool === 'transform_clip_music') {
      transformationUses += 1;
    }
    if (result?.type === 'managed-event' && result.structure === 'device-alternate') {
      deviceAlternateEvents += 1;
    }
    if (result?.type === 'managed-event' && result.structure === 'clip-block') {
      clipBlockEvents += 1;
    }
  }
  return {
    deviceAlternateEvents, clipBlockEvents, copyTrackUses, generationUses, transformationUses,
  };
}

/** Build deterministic counts and rates. This report makes no recommendation. */
export function reportObservationRecord(record: ObservationRecord): ObservationReport {
  const entries = new Map(record.entries.map((entry) => [entry.id, entry]));
  const instructions = record.entries.filter(
    (entry): entry is InstructionObservation => entry.type === 'instruction-observation',
  );
  const managed = record.entries.filter((entry) => entry.type === 'managed-event');
  const ordinary = record.entries.filter((entry) => entry.type === 'ordinary-use');
  const musical = record.entries.filter((entry) => entry.type === 'musical-use');
  const referenced = new Set(instructions.flatMap((entry) => [...entry.resultIds]));

  let operatorResponses = emptyResponses();
  for (const instruction of instructions) {
    operatorResponses = addResponse(operatorResponses, instruction.operatorResponse);
  }

  const versionRows = new Map<string, {
    instructionObservations: number;
    managedEvents: number;
    ordinaryUses: number;
    musicalUses: number;
  }>();
  for (const entry of record.entries) {
    const row = versionRows.get(entry.descriptionVersion) ?? {
      instructionObservations: 0, managedEvents: 0, ordinaryUses: 0, musicalUses: 0,
    };
    if (entry.type === 'instruction-observation') row.instructionObservations += 1;
    if (entry.type === 'managed-event') row.managedEvents += 1;
    if (entry.type === 'ordinary-use') row.ordinaryUses += 1;
    if (entry.type === 'musical-use') row.musicalUses += 1;
    versionRows.set(entry.descriptionVersion, row);
  }

  const crossRows = new Map<string, {
    descriptionVersion: string;
    requestedScope: RequestedScope;
    actualResults: ActualResultProfile;
    instructionCount: number;
    operatorResponses: OperatorResponseCounts;
  }>();
  for (const instruction of instructions) {
    const profile = actualResults(instruction, entries);
    const key = `${instruction.descriptionVersion}\u0000${instruction.requestedScope}\u0000${profileKey(profile)}`;
    const row = crossRows.get(key) ?? {
      descriptionVersion: instruction.descriptionVersion,
      requestedScope: instruction.requestedScope,
      actualResults: profile,
      instructionCount: 0,
      operatorResponses: emptyResponses(),
    };
    row.instructionCount += 1;
    row.operatorResponses = addResponse(row.operatorResponses, instruction.operatorResponse);
    crossRows.set(key, row);
  }

  const compareRows = <T extends {
    descriptionVersion: string;
    requestedScope: RequestedScope;
    actualResults?: ActualResultProfile;
  }>(left: T, right: T): number => {
    const version = left.descriptionVersion.localeCompare(right.descriptionVersion);
    if (version !== 0) return version;
    const scope = REQUESTED_SCOPE_ORDER.indexOf(left.requestedScope)
      - REQUESTED_SCOPE_ORDER.indexOf(right.requestedScope);
    if (scope !== 0 || left.actualResults === undefined || right.actualResults === undefined) {
      return scope;
    }
    return profileKey(left.actualResults).localeCompare(profileKey(right.actualResults));
  };

  const crossTab: ObservationCrossTabRow[] = [...crossRows.values()]
    .sort(compareRows)
    .map((row) => ({ ...row, operatorResponseRates: rates(row.operatorResponses) }));

  const scopeRows = new Map<string, {
    descriptionVersion: string;
    requestedScope: RequestedScope;
    instructionCount: number;
    profiles: Set<string>;
    operatorResponses: OperatorResponseCounts;
  }>();
  for (const row of crossTab) {
    const key = `${row.descriptionVersion}\u0000${row.requestedScope}`;
    const summary = scopeRows.get(key) ?? {
      descriptionVersion: row.descriptionVersion,
      requestedScope: row.requestedScope,
      instructionCount: 0,
      profiles: new Set<string>(),
      operatorResponses: emptyResponses(),
    };
    summary.instructionCount += row.instructionCount;
    summary.profiles.add(profileKey(row.actualResults));
    summary.operatorResponses = {
      silent: summary.operatorResponses.silent + row.operatorResponses.silent,
      accepted: summary.operatorResponses.accepted + row.operatorResponses.accepted,
      vetoed: summary.operatorResponses.vetoed + row.operatorResponses.vetoed,
    };
    scopeRows.set(key, summary);
  }

  return {
    format: record.format,
    schemaVersion: record.schemaVersion,
    totals: {
      entries: record.entries.length,
      instructions: instructions.length,
      managedEvents: managed.length,
      ordinaryUses: ordinary.length,
      musicalUses: musical.length,
      resultReferences: instructions.reduce((sum, entry) => sum + entry.resultIds.length, 0),
    },
    managedEvents: {
      deviceAlternate: managed.filter((entry) => entry.structure === 'device-alternate').length,
      clipBlock: managed.filter((entry) => entry.structure === 'clip-block').length,
    },
    ordinaryUses: { copyTrack: ordinary.length },
    musicalUses: {
      generation: musical.filter((entry) => entry.tool === 'generate_clip_music').length,
      transformation: musical.filter((entry) => entry.tool === 'transform_clip_music').length,
      applied: musical.filter((entry) => entry.result.applied).length,
    },
    instructionsWithoutResults: instructions.filter((entry) => entry.resultIds.length === 0).length,
    unreferencedResults: {
      managedEvents: managed.filter((entry) => !referenced.has(entry.id)).length,
      ordinaryUses: ordinary.filter((entry) => !referenced.has(entry.id)).length,
      musicalUses: musical.filter((entry) => !referenced.has(entry.id)).length,
    },
    operatorResponses,
    descriptionVersions: [...versionRows.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([descriptionVersion, counts]) => ({ descriptionVersion, ...counts })),
    scopeSummaries: [...scopeRows.values()]
      .sort(compareRows)
      .map((row) => ({
        descriptionVersion: row.descriptionVersion,
        requestedScope: row.requestedScope,
        instructionCount: row.instructionCount,
        choiceDiversity: row.profiles.size,
        operatorResponses: row.operatorResponses,
        operatorResponseRates: rates(row.operatorResponses),
      })),
    crossTab,
  };
}
