/** Phase 2 closeout: read-only proof of the accepted dogfood project baseline. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface Track {
  readonly trackId: string;
  readonly name: string;
  readonly kind: string;
  readonly position: number;
}

interface PublicNote {
  readonly startBeats: number;
  readonly pitch: number;
  readonly velocity: number;
  readonly durationBeats: number;
}

interface ClipRead {
  readonly readable: boolean;
  readonly clipExists: boolean;
  readonly lengthBeats: number | null;
  readonly notes: readonly PublicNote[];
}

interface ObservationEntry {
  readonly type: string;
  readonly id: string;
  readonly descriptionVersion: string;
  readonly operatorResponse?: string;
  readonly resultIds?: readonly string[];
  readonly structure?: string;
  readonly tool?: string;
  readonly outcome?: string;
  readonly result?: Record<string, unknown>;
}

const EXPECTED_TRACKS = [
  ['Lead', 'Instrument'],
  ['Harmony', 'Instrument'],
  ['Harmony – Open Minor', 'Instrument'],
  ['MS20 Water Bass', 'Instrument'],
  ['Audio 5', 'Audio'],
  ['FX 1', 'Effect'],
  ['Master', 'Master'],
] as const;

const EXPECTED_OCCUPIED_ROWS: Readonly<Record<string, readonly number[]>> = {
  Lead: [1, 2, 3, 4],
  Harmony: [1, 2, 3, 4],
  'Harmony – Open Minor': [1, 2, 3, 4, 5, 6],
  'MS20 Water Bass': [],
  'Audio 5': [],
  'FX 1': [],
  Master: [],
};

const progressionOne: readonly PublicNote[] = [
  ...chord(0, [53, 60, 63, 67, 80], 82),
  ...chord(8, [55, 62, 65, 70, 72], 78),
  ...chord(16, [51, 58, 62, 65, 79], 80),
  ...chord(24, [48, 55, 58, 62, 65, 75], 76),
];

const progressionTwo: readonly PublicNote[] = [
  ...chord(0, [53, 60, 63, 67, 70, 80], 80),
  ...chord(8, [56, 63, 67, 70, 84], 76),
  ...chord(16, [46, 53, 56, 60, 62, 79], 82),
  ...chord(24, [51, 58, 62, 65, 79], 78),
];

function chord(
  startBeats: number,
  pitches: readonly number[],
  velocity: number,
): readonly PublicNote[] {
  return pitches.map((pitch) => ({ startBeats, pitch, velocity, durationBeats: 7.5 }));
}

function fail(message: string): never {
  throw new Error(message);
}

function noteKey(note: PublicNote): string {
  return [note.startBeats, note.pitch, note.velocity, note.durationBeats].join(':');
}

function sameNotes(left: readonly PublicNote[], right: readonly PublicNote[]): boolean {
  return left.length === right.length
    && left.map(noteKey).sort().join('|') === right.map(noteKey).sort().join('|');
}

function hasNote(notes: readonly PublicNote[], expected: PublicNote): boolean {
  return notes.some((note) => noteKey(note) === noteKey(expected));
}

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/mcp-server.ts'] });
const mcp = new Client({ name: 'phase2k-baseline', version: '1.0.0' });

function parse(value: unknown): Record<string, unknown> {
  const result = value as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  const output = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError === true || output === undefined) fail(output ?? 'the public call failed');
  return JSON.parse(output) as Record<string, unknown>;
}

async function call(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return parse(await mcp.callTool({ name, arguments: args }));
}

function check(name: string, condition: boolean, detail?: unknown): void {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
  if (!condition) fail(`${name}: ${JSON.stringify(detail)}`);
}

async function readClip(track: Track, row: number): Promise<ClipRead> {
  return await call('read_clip', { trackId: track.trackId, row, channel: 0 }) as unknown as ClipRead;
}

try {
  await mcp.connect(transport);

  const connection = await call('check_connection');
  const tracksInfo = connection['tracks'] as { addressable?: number; inProject?: number };
  const rowsInfo = connection['rows'] as { addressable?: number; inProject?: number };
  check('2k-L0: the project and complete bank coverage match the accepted baseline',
    connection['project'] === '26.05-2 moon'
      && tracksInfo.addressable === 256
      && tracksInfo.inProject === 7
      && rowsInfo.addressable === 128
      && rowsInfo.inProject === 8,
    connection);

  const listed = await call('list_tracks') as unknown as {
    readonly tracks: readonly Track[];
    readonly notListed: number | null;
  };
  check('2k-L1: every durable track identity and ordered track type is visible',
    listed.notListed === 0
      && listed.tracks.length === EXPECTED_TRACKS.length
      && listed.tracks.every((track, index) => track.position === index
        && track.name === EXPECTED_TRACKS[index]?.[0]
        && track.kind === EXPECTED_TRACKS[index]?.[1]
        && track.trackId.length > 0),
    listed);

  const clips = new Map<string, ClipRead>();
  for (const track of listed.tracks) {
    for (let row = 0; row < 8; row += 1) {
      const clip = await readClip(track, row);
      clips.set(`${track.name}:${row}`, clip);
      const expected = EXPECTED_OCCUPIED_ROWS[track.name]?.includes(row) === true;
      if (!clip.readable || clip.clipExists !== expected) {
        fail(`unexpected launcher state at ${track.name} row ${row}: ${JSON.stringify(clip)}`);
      }
    }
  }
  check('2k-L2: the complete 7-by-8 launcher grid has no clip residue', true);

  const lead = listed.tracks.find((track) => track.name === 'Lead') ?? fail('Lead is absent');
  const harmony = listed.tracks.find((track) => track.name === 'Harmony') ?? fail('Harmony is absent');
  const openMinor = listed.tracks.find((track) => track.name === 'Harmony – Open Minor')
    ?? fail('Harmony – Open Minor is absent');

  for (const track of [lead, harmony]) {
    const source = clips.get(`${track.name}:1`) ?? fail(`${track.name} source is absent`);
    check(`2k-L3: ${track.name} source and three variations keep 32-beat clip metadata`,
      [1, 2, 3, 4].every((row) => clips.get(`${track.name}:${row}`)?.lengthBeats === 32));
    const expected = track.name === 'Lead'
      ? [
          { startBeats: 12, pitch: 64, velocity: 90, durationBeats: 2 },
          { startBeats: 29, pitch: 69, velocity: 92, durationBeats: 2 },
          { startBeats: 12, pitch: 64, velocity: 88, durationBeats: 2 },
          { startBeats: 29, pitch: 69, velocity: 90, durationBeats: 2 },
        ]
      : [
          { startBeats: 12, pitch: 60, velocity: 86, durationBeats: 2 },
          { startBeats: 29, pitch: 64, velocity: 86, durationBeats: 2 },
          { startBeats: 12, pitch: 60, velocity: 84, durationBeats: 2 },
          { startBeats: 29, pitch: 64, velocity: 84, durationBeats: 2 },
        ];
    const row2 = clips.get(`${track.name}:2`)!;
    const row3 = clips.get(`${track.name}:3`)!;
    const row4 = clips.get(`${track.name}:4`)!;
    check(`2k-L4: ${track.name} variations contain only the accepted additions`,
      row2.notes.length === source.notes.length + 1 && hasNote(row2.notes, expected[0]!)
        && row3.notes.length === source.notes.length + 1 && hasNote(row3.notes, expected[1]!)
        && row4.notes.length === source.notes.length + 2
        && hasNote(row4.notes, expected[2]!) && hasNote(row4.notes, expected[3]!));
  }

  check('2k-L5: the copied track keeps every accepted Harmony phrase exactly',
    [1, 2, 3, 4].every((row) => sameNotes(
      clips.get(`${harmony.name}:${row}`)!.notes,
      clips.get(`${openMinor.name}:${row}`)!.notes,
    )));
  const first = clips.get(`${openMinor.name}:5`)!;
  const second = clips.get(`${openMinor.name}:6`)!;
  check('2k-L6: the two open-minor progressions match the accepted 43-note result',
    first.lengthBeats === 32 && second.lengthBeats === 32
      && sameNotes(first.notes, progressionOne)
      && sameNotes(second.notes, progressionTwo),
    { firstNotes: first.notes.length, secondNotes: second.notes.length });

  const observed = await call('read_observation_record') as unknown as {
    readonly record: {
      readonly format: string;
      readonly schemaVersion: number;
      readonly entries: readonly ObservationEntry[];
    };
  };
  const entries = observed.record.entries;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const acceptedPhrases = entries.find((entry) => entry.type === 'instruction-observation'
    && entry.descriptionVersion === 'ghostnote-description-v4'
    && entry.operatorResponse === 'accepted'
    && entry.resultIds?.length === 6);
  const acceptedOpenMinor = entries.find((entry) => entry.type === 'instruction-observation'
    && entry.descriptionVersion === 'ghostnote-description-v4'
    && entry.operatorResponse === 'accepted'
    && entry.resultIds?.length === 2);
  check('2k-L7: schema v2 keeps the two accepted reconstruction instructions and result links',
    observed.record.format === 'ghostnote-observation-record'
      && observed.record.schemaVersion === 2
      && acceptedPhrases?.resultIds?.every((id) => byId.get(id)?.structure === 'clip-block') === true
      && acceptedOpenMinor?.resultIds?.some((id) => byId.get(id)?.outcome === 'copy-track') === true
      && acceptedOpenMinor?.resultIds?.some(
        (id) => byId.get(id)?.tool === 'generate_clip_music') === true,
    { acceptedPhrases, acceptedOpenMinor });

  console.log('Phase 2 live baseline: PASS');
} finally {
  await mcp.close();
}
