import { WireTransport } from './phase8h3c-promotion.js';
const t = new WireTransport();
const m: any = await t.send({ method: 'revision.get' });
console.log(m.project, JSON.stringify(((await t.send({ method: 'track.list' })) as any).tracks.map((x: any) => [x.index, x.name, x.type])));
process.exit(0);
