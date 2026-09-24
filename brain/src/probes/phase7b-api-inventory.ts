/** Read-only E130 inventory of concrete host proxy methods. */
import { client, check, failureCount, note } from './lib.js';

interface RuntimeTarget {
  name: string;
  apiType: string;
  runtimeType: string;
  apiPublicMethodCount: number;
  runtimePublicMethodCount: number;
  runtimeExtraCount: number;
  runtimeExtras: string[];
  contentCandidateExtras: string[];
  candidateReturnTypes: Array<{ type: string; contentExtras: string[] }>;
}

const hello = (await client.request('contract.hello')) as {
  hostApiVersion: number;
  methodCount: number;
  methodsHash: string;
};
note(`host API ${hello.hostApiVersion}; ${hello.methodCount} methods; ${hello.methodsHash}`);
check('the deployed extension uses Controller API 25', hello.hostApiVersion === 25, hello);

const inventory = (await client.request('api.runtimeMethods')) as {
  readOnly: boolean;
  targets: RuntimeTarget[];
};
check('the runtime inventory is read-only', inventory.readOnly === true);
check('all requested proxy families were inspected', inventory.targets.length === 10,
  { count: inventory.targets.length });

for (const target of inventory.targets) {
  note(`${target.name}: ${target.runtimeType}; API ${target.apiPublicMethodCount}; `
    + `runtime ${target.runtimePublicMethodCount}; extras ${target.runtimeExtraCount}`);
  if (target.contentCandidateExtras.length > 0) {
    note(`  content candidates: ${target.contentCandidateExtras.join(' | ')}`);
  }
  for (const returnType of target.candidateReturnTypes) {
    note(`  return type ${returnType.type}: ${returnType.contentExtras.length} content extras`);
    if (returnType.contentExtras.length > 0) {
      note(`    ${returnType.contentExtras.join(' | ')}`);
    }
  }
  check(`${target.name} public method inventory completed`,
    target.runtimePublicMethodCount >= target.apiPublicMethodCount,
    { api: target.apiPublicMethodCount, runtime: target.runtimePublicMethodCount });
}

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
