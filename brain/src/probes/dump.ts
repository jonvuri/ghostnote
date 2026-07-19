import { client } from "./lib.js";
await client.connect();
const l = await client.request("track.list");
console.log(JSON.stringify(l, null, 1));
client.disconnect();
