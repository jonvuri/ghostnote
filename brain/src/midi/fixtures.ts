/** Generated SMF test inputs. No personal music is stored here. */
import type { StateDocument } from '../document/index.js';
export function smfFixture(tracks: readonly number[][], ppq = 1000, format = tracks.length === 1 ? 0 : 1): Buffer {
  const header = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, 0, tracks.length, ppq >> 8, ppq & 255]);
  return Buffer.concat([header, ...tracks.map(data => {
    const header = Buffer.from([0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 0]); header.writeUInt32BE(data.length, 4);
    return Buffer.concat([header, Buffer.from(data)]);
  })]);
}
export const EOT = [0, 255, 47, 0];
export const SIMPLE_MIDI = smfFixture([[0, 255, 81, 3, 15, 66, 64, 0, 0x90, 60, 100, 0x87, 0x68, 0x80, 60, 0, ...EOT]]);
export function midiDocument(count = 1): StateDocument {
  return { format: 'ghostnote-document', version: '1.0', kind: 'desired',
    clips: [{ id: 'c1', length: String(Math.max(4, count)), name: 'Generated MIDI fixture' }],
    coverage: [{ clip: 'c1', from: '0', to: String(Math.max(4, count)), channels: Array.from({ length: 16 }, (_, i) => i + 1), fields: 'all', status: 'complete' }],
    events: Array.from({ length: count }, (_, i) => ({ id: `n${i}`, clip: 'c1', at: String(i), duration: '1/2', pitch: 36 + i % 48, velocity: 80 + i % 40 })), overlays: [] };
}
