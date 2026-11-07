import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=process.cwd(), scratch=mkdtempSync(join(tmpdir(),'r01-codex-home-'));
try {
 const auth=readFileSync(join(process.env.CODEX_HOME ?? join(process.env.HOME,'.codex'),'auth.json'));
 const parsed=JSON.parse(auth);
 if(parsed.auth_mode !== 'chatgpt' || parsed.OPENAI_API_KEY) throw new Error('ChatGPT file authentication required');
 writeFileSync(join(scratch,'auth.json'),auth,{mode:0o600});
 const r=spawnSync(process.execPath,[join(root,'brain/benchmarks/r01-candidates/cli-control-probe.mjs'),'codex-current',resolve(process.argv[2])],{cwd:root,env:{...process.env,CODEX_HOME:scratch},encoding:'utf8',timeout:130000});
 process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? '');
 process.exitCode=r.status ?? 1;
} finally {rmSync(scratch,{recursive:true,force:true});}
