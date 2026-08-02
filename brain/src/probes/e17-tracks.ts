/** Read-only: list every track, so an orphan can be NAMED rather than counted (e16t). */
import { client } from './lib.js';
const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
await client.connect();
const t = (await req('track.list')) as { tracks: { index: number; name: string; type: string; channelId: string }[]; count: number };
console.log(`count=${t.count}`);
for (const x of t.tracks) console.log(`  [${x.index}] ${x.name.padEnd(24)} ${x.type.padEnd(8)} ${x.channelId.slice(0, 8)}`);
process.exit(0);
