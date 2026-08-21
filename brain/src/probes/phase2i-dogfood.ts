/** Ordinary MCP client for the first real musical dogfood session. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { BridgeClient } from '../client.js';

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/mcp-server.ts'] });
const mcp = new Client({ name: 'phase2i-dogfood', version: '1.0.0' });
const mode = process.argv[2] ?? 'read';
const rawRequest = "Opened project '26.05-2 moon'. Read the only clips on the 'Lead' and "
  + "'Harmony' tracks, and extend them both with three more measures of simple variations "
  + 'on the initial theme (keeping the same overall simplicity with just a few interesting '
  + 'tweaks each measure).';
const revisedRequest = 'For now, modify the request to just create new clips with the requested '
  + 'changes, instead, and then try to fulfill it. Then, make a note to add that clip-length '
  + 'update operation in a follow-up session.';
const clarifiedRequest = 'Revert, then try again. Keep each full original clip as phrase 1, '
  + 'followed by three subtle variations on that complete phrase.';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Recreate accepted additive notes after a saved-project loss, then verify publicly. */
async function addRecoveredNotes(
  targets: readonly {
    readonly trackId: string;
    readonly row: number;
    readonly notes: readonly {
      readonly startBeats: number;
      readonly pitch: number;
      readonly velocity: number;
      readonly durationBeats: number;
    }[];
  }[],
): Promise<void> {
  const bridge = new BridgeClient();
  try {
    await bridge.connect();
    await bridge.request('cursor.pin', { cursor: '0', pinned: false });
    const listed = await bridge.request('track.list') as {
      readonly tracks: readonly { readonly index: number; readonly channelId: string }[];
    };
    for (const target of targets) {
      const track = listed.tracks.find((item) => item.channelId === target.trackId);
      if (track === undefined) throw new Error(`recovery target is absent: ${target.trackId}`);
      await bridge.request('cursor.pointTrack', { cursor: '0', trackIndex: track.index });
      await bridge.request('slot.select', {
        trackIndex: track.index, slotIndex: target.row, mechanism: 'track',
      });
      let pointed = false;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const status = await bridge.request('cursor.status', { cursor: '0' }) as {
          readonly exists: boolean;
          readonly trackPosition: number;
          readonly sceneIndex: number;
        };
        if (status.exists && status.trackPosition === track.index
            && status.sceneIndex === target.row) {
          pointed = true;
          break;
        }
        await wait(25);
      }
      if (!pointed) throw new Error(`recovery cursor did not reach row ${target.row}`);
      await bridge.request('cursor.setStepSize', { cursor: '0', stepSize: 0.25 });
      await wait(150);

      const pages = new Map<number, [number, number, number, number][]>();
      for (const note of target.notes) {
        const absoluteStep = Math.round(note.startBeats / 0.25);
        const page = Math.floor(absoluteStep / 64) * 64;
        const notes = pages.get(page) ?? [];
        notes.push([absoluteStep - page, note.pitch, note.velocity, note.durationBeats]);
        pages.set(page, notes);
      }
      for (const [page, notes] of [...pages].sort(([left], [right]) => left - right)) {
        const result = await bridge.request('batch.run', {
          verbose: true,
          ops: [
            { method: 'cursor.scrollToStep', params: { cursor: '0', step: page } },
            { method: 'cursor.setNotes', params: { cursor: '0', channel: 0, notes } },
          ],
        }) as { readonly applied: boolean; readonly results?: readonly { readonly ok: boolean }[] };
        if (!result.applied || result.results?.some((item) => !item.ok) === true) {
          throw new Error(`recovery write failed at row ${target.row}, page ${page}`);
        }
      }
      await bridge.request('cursor.scrollToStep', { cursor: '0', step: 0 });
    }
  } finally {
    bridge.disconnect();
  }
}

const parse = (value: unknown): Record<string, unknown> => {
  const content = (value as { content?: { type: string; text?: string }[] }).content ?? [];
  const result = content.find((item) => item.type === 'text')?.text;
  if (result === undefined) throw new Error('the MCP call returned no text result');
  return JSON.parse(result) as Record<string, unknown>;
};

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = parse(await mcp.callTool({ name, arguments: args }));
  console.log(JSON.stringify({ tool: name, args, result }));
  return result;
};

try {
  await mcp.connect(transport);
  if (mode === 'reject') {
    const begun = await call('record_observation', {
      operation: 'begin',
      requestedScope: 'unsupported',
      rawScope: rawRequest,
    });
    await call('record_observation', {
      operation: 'enrich',
      instructionId: begun['instructionId'],
    });
    await call('read_observation_record');
    process.exitCode = 0;
  } else if (mode === 'cleanup-phrases') {
    const listed = await call('list_tracks') as {
      tracks?: { trackId: string; name: string; kind: string }[];
    };
    const targets = (listed.tracks ?? []).filter((track) =>
      track.name === 'Lead' || track.name === 'Harmony');
    if (targets.length !== 2) throw new Error('Lead or Harmony is absent');
    for (const row of [4, 3, 2]) {
      for (const track of [...targets].reverse()) {
        if (row === 2 && track.name === 'Harmony') continue;
        const removed = await call('delete_clip', {
          clips: [{ trackId: track.trackId, row }],
        });
        if (removed['applied'] !== true) throw new Error(`${track.name} row ${row} was not removed`);
      }
    }
  } else if (mode === 'apply-phrases' || mode === 'reconstruct-phrases') {
    let instructionId: string | undefined;
    const copiedChangeIds: string[] = [];
    const copiedClips: { trackId: string; row: number }[] = [];
    const noteChangeIds: string[] = [];
    try {
      const connection = await call('check_connection');
      if (connection['project'] !== '26.05-2 moon') {
        throw new Error(`expected project 26.05-2 moon, got ${String(connection['project'])}`);
      }
      const listed = await call('list_tracks') as {
        tracks?: { trackId: string; name: string; kind: string }[];
      };
      const lead = (listed.tracks ?? []).find((track) => track.name === 'Lead');
      const harmony = (listed.tracks ?? []).find((track) => track.name === 'Harmony');
      if (lead === undefined || harmony === undefined) throw new Error('Lead or Harmony is absent');
      for (const track of [lead, harmony]) {
        for (const row of [2, 3, 4]) {
          const empty = await call('read_clip', { trackId: track.trackId, row });
          if (empty['readable'] !== true || empty['clipExists'] !== false) {
            throw new Error(`${track.name} row ${row} is not positively empty`);
          }
        }
      }

      const begun = await call('record_observation', {
        operation: 'begin',
        requestedScope: 'launcher-clip-only',
        rawScope: {
          originalRequest: rawRequest,
          revisedRequest,
          clarification: clarifiedRequest,
        },
      });
      instructionId = begun['instructionId'] as string;

      for (const sourceRow of [1, 2, 3]) {
        for (const track of [lead, harmony]) {
          const copied = await call('copy_clip_down', {
            trackId: track.trackId,
            row: sourceRow,
            quantization: 'default',
            mode: 'default',
          });
          if (copied['applied'] !== true || copied['creationConfirmed'] !== true
              || typeof copied['changeId'] !== 'string') {
            throw new Error(`${track.name} row ${sourceRow} was not copied`);
          }
          copiedChangeIds.push(copied['changeId'] as string);
          copiedClips.push({ trackId: track.trackId, row: sourceRow + 1 });
        }
      }

      const literal = (notes: readonly {
        startBeats: number; pitch: number; velocity: number; durationBeats: number;
      }[]) => ({ op: 'generate', source: { kind: 'notes', notes } });
      const variation = (
        trackId: string,
        row: number,
        notes: readonly {
          startBeats: number; pitch: number; velocity: number; durationBeats: number;
        }[],
      ) => ({
        clip: { trackId, row },
        channel: 0,
        write: 'merge',
        operations: [literal(notes)],
      });
      const variations = [
        variation(lead.trackId, 2, [
          { startBeats: 12, pitch: 64, velocity: 90, durationBeats: 2 },
        ]),
        variation(harmony.trackId, 2, [
          { startBeats: 12, pitch: 60, velocity: 86, durationBeats: 2 },
        ]),
        variation(lead.trackId, 3, [
          { startBeats: 29, pitch: 69, velocity: 92, durationBeats: 2 },
        ]),
        variation(harmony.trackId, 3, [
          { startBeats: 29, pitch: 64, velocity: 86, durationBeats: 2 },
        ]),
        variation(lead.trackId, 4, [
          { startBeats: 12, pitch: 64, velocity: 88, durationBeats: 2 },
          { startBeats: 29, pitch: 69, velocity: 90, durationBeats: 2 },
        ]),
        variation(harmony.trackId, 4, [
          { startBeats: 12, pitch: 60, velocity: 84, durationBeats: 2 },
          { startBeats: 29, pitch: 64, velocity: 84, durationBeats: 2 },
        ]),
      ];
      if (mode === 'reconstruct-phrases') {
        await addRecoveredNotes(variations.map((target) => ({
          trackId: target.clip.trackId,
          row: target.clip.row,
          notes: (target.operations[0] as ReturnType<typeof literal>).source.notes,
        })));
      } else {
        for (const target of variations) {
          const written = await call('write_notes', {
            clips: [{
              trackId: target.clip.trackId,
              row: target.clip.row,
              channel: target.channel,
              notes: (target.operations[0] as ReturnType<typeof literal>).source.notes,
            }],
          });
          if (written['applied'] !== true || typeof written['changeId'] !== 'string') {
            throw new Error(`the phrase variation at row ${target.clip.row} did not apply`);
          }
          if (Array.isArray(written['mismatches']) && written['mismatches'].length > 0) {
            throw new Error(`the phrase variation at row ${target.clip.row} failed readback`);
          }
          noteChangeIds.push(written['changeId'] as string);
        }
      }

      const readbacks: Record<string, unknown>[] = [];
      for (const track of [lead, harmony]) {
        for (const row of [2, 3, 4]) {
          readbacks.push(await call('read_clip', { trackId: track.trackId, row, channel: 0 }));
        }
      }
      await call('show_changed_clip', {
        changeId: noteChangeIds[0] ?? copiedChangeIds[0],
        target: { trackId: lead.trackId, row: 2 },
      });
      console.log(JSON.stringify({
        readyForOperator: true,
        instructionId,
        copiedChangeIds,
        noteChangeIds,
        readbacks,
        decision: 'type keep or revert',
      }));

      process.stdin.setEncoding('utf8');
      for await (const input of process.stdin) {
        const decision = input.trim().toLowerCase();
        if (decision === 'keep') {
          await call('record_observation', {
            operation: 'enrich', instructionId, operatorResponse: 'accepted',
          });
          break;
        }
        if (decision === 'revert') {
          noteChangeIds.length = 0;
          for (const clip of copiedClips.reverse()) {
            await call('delete_clip', { clips: [clip] });
          }
          copiedClips.length = 0;
          copiedChangeIds.length = 0;
          await call('record_observation', {
            operation: 'enrich', instructionId, operatorResponse: 'vetoed',
          });
          break;
        }
        console.log(JSON.stringify({ waiting: true, decision: 'type keep or revert' }));
      }
      await call('read_observation_record');
    } catch (error) {
      for (const clip of copiedClips.reverse()) {
        try { await call('delete_clip', { clips: [clip] }); } catch { /* Best effort. */ }
      }
      if (instructionId !== undefined) {
        try {
          await call('record_observation', { operation: 'enrich', instructionId });
        } catch { /* The primary error is reported below. */ }
      }
      throw error;
    }
  } else if (mode === 'apply') {
    let instructionId: string | undefined;
    let createdChangeId: string | undefined;
    let generatedChangeId: string | undefined;
    try {
      const connection = await call('check_connection');
      if (connection['project'] !== '26.05-2 moon') {
        throw new Error(`expected project 26.05-2 moon, got ${String(connection['project'])}`);
      }
      const listed = await call('list_tracks') as {
        tracks?: { trackId: string; name: string; kind: string }[];
      };
      const lead = (listed.tracks ?? []).find((track) => track.name === 'Lead');
      const harmony = (listed.tracks ?? []).find((track) => track.name === 'Harmony');
      if (lead === undefined || harmony === undefined) throw new Error('Lead or Harmony is absent');
      for (const track of [lead, harmony]) {
        const empty = await call('read_clip', { trackId: track.trackId, row: 2 });
        if (empty['readable'] !== true || empty['clipExists'] !== false) {
          throw new Error(`${track.name} row 2 is not positively empty`);
        }
      }

      const begun = await call('record_observation', {
        operation: 'begin',
        requestedScope: 'launcher-clip-only',
        rawScope: { originalRequest: rawRequest, revisedRequest },
      });
      instructionId = begun['instructionId'] as string;

      const created = await call('add_clip', {
        clips: [lead, harmony].map((track) => ({
          trackId: track.trackId,
          row: 2,
          lengthBeats: 12,
        })),
      });
      if (created['applied'] !== true || typeof created['changeId'] !== 'string') {
        throw new Error('the two variation clips were not created');
      }
      createdChangeId = created['changeId'] as string;

      const literal = (notes: readonly {
        startBeats: number; pitch: number; velocity: number; durationBeats: number;
      }[]) => ({ op: 'generate', source: { kind: 'notes', notes } });
      const generated = await call('generate_clip_music', {
        schema: 'ghostnote-musical-patch',
        version: 1,
        protection: { kind: 'direct' },
        targets: [
          {
            clip: { trackId: lead.trackId, row: 2 },
            channel: 0,
            write: 'merge',
            operations: [literal([
              { startBeats: 0, pitch: 65, velocity: 102, durationBeats: 3 },
              { startBeats: 3, pitch: 67, velocity: 98, durationBeats: 1 },
              { startBeats: 4, pitch: 60, velocity: 102, durationBeats: 2 },
              { startBeats: 6, pitch: 62, velocity: 98, durationBeats: 2 },
              { startBeats: 8, pitch: 67, velocity: 102, durationBeats: 2 },
              { startBeats: 10, pitch: 69, velocity: 98, durationBeats: 1 },
              { startBeats: 11, pitch: 65, velocity: 96, durationBeats: 1 },
            ])],
          },
          {
            clip: { trackId: harmony.trackId, row: 2 },
            channel: 0,
            write: 'merge',
            operations: [literal([
              { startBeats: 0, pitch: 65, velocity: 96, durationBeats: 3 },
              { startBeats: 3, pitch: 60, velocity: 92, durationBeats: 1 },
              { startBeats: 4, pitch: 60, velocity: 96, durationBeats: 3 },
              { startBeats: 7, pitch: 62, velocity: 92, durationBeats: 1 },
              { startBeats: 8, pitch: 65, velocity: 96, durationBeats: 2 },
              { startBeats: 10, pitch: 64, velocity: 92, durationBeats: 1 },
              { startBeats: 11, pitch: 60, velocity: 90, durationBeats: 1 },
            ])],
          },
        ],
      });
      if (generated['applied'] !== true) throw new Error('the musical generation did not apply');
      const changes = generated['changes'] as { changeId?: string }[];
      generatedChangeId = changes[0]?.changeId;
      if (typeof generatedChangeId !== 'string') throw new Error('the generation returned no change id');

      const leadReadback = await call('read_clip', { trackId: lead.trackId, row: 2, channel: 0 });
      const harmonyReadback = await call('read_clip', { trackId: harmony.trackId, row: 2, channel: 0 });
      await call('show_changed_clip', {
        changeId: generatedChangeId,
        target: { trackId: lead.trackId, row: 2 },
      });
      console.log(JSON.stringify({
        readyForOperator: true,
        instructionId,
        createdChangeId,
        generatedChangeId,
        leadReadback,
        harmonyReadback,
        decision: 'type keep or revert',
      }));

      process.stdin.setEncoding('utf8');
      for await (const input of process.stdin) {
        const decision = input.trim().toLowerCase();
        if (decision === 'keep') {
          await call('record_observation', {
            operation: 'enrich', instructionId, operatorResponse: 'accepted',
          });
          break;
        }
        if (decision === 'revert') {
          await call('revert_change', { changeId: generatedChangeId });
          generatedChangeId = undefined;
          await call('revert_change', { changeId: createdChangeId });
          createdChangeId = undefined;
          await call('record_observation', {
            operation: 'enrich', instructionId, operatorResponse: 'vetoed',
          });
          break;
        }
        console.log(JSON.stringify({ waiting: true, decision: 'type keep or revert' }));
      }
      await call('read_observation_record');
    } catch (error) {
      if (generatedChangeId !== undefined) {
        try { await call('revert_change', { changeId: generatedChangeId }); } catch { /* Best effort. */ }
      }
      if (createdChangeId !== undefined) {
        try { await call('revert_change', { changeId: createdChangeId }); } catch { /* Best effort. */ }
      }
      if (instructionId !== undefined) {
        try {
          await call('record_observation', { operation: 'enrich', instructionId });
        } catch { /* The primary error is reported below. */ }
      }
      throw error;
    }
  } else if (mode !== 'read' && mode !== 'reread' && mode !== 'inspect-phrases') {
    throw new Error(`unknown mode ${mode}`);
  } else {
    if (mode === 'read') {
      const tools = await mcp.listTools();
      const musical = tools.tools.filter((tool) => [
        'generate_clip_music', 'transform_clip_music', 'record_observation',
        'read_clip', 'revert_change', 'show_changed_clip',
      ].includes(tool.name));
      console.log(JSON.stringify({ tools: musical }));
    }

    const connection = await call('check_connection');
    if (connection['project'] !== '26.05-2 moon') {
      throw new Error(`expected project 26.05-2 moon, got ${String(connection['project'])}`);
    }
    const listed = await call('list_tracks') as {
      tracks?: { trackId: string; name: string; kind: string }[];
    };
    const targets = (listed.tracks ?? []).filter((track) =>
      track.name === 'Lead' || track.name === 'Harmony');
    if (targets.length !== 2) {
      throw new Error(`expected Lead and Harmony, got ${JSON.stringify(targets)}`);
    }
    const rowInfo = connection['rows'] as { addressable?: number; inProject?: number | null };
    const rows = Math.min(rowInfo.addressable ?? 0, rowInfo.inProject ?? rowInfo.addressable ?? 0);
    for (const track of targets) {
      const selectedRows = mode === 'reread'
        ? [1]
        : mode === 'inspect-phrases'
          ? [1, 2, 3, 4]
          : Array.from({ length: rows }, (_, row) => row);
      for (const row of selectedRows) await call('read_clip', { trackId: track.trackId, row });
    }
    await call('read_observation_record');
  }
} finally {
  await mcp.close();
}
