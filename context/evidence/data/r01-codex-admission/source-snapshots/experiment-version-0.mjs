import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { invocation, PROFILES, SYSTEM } from '../../brain/benchmarks/r01-candidates/cli-controls.mjs';
import { resolveBinary, sha } from '../../brain/benchmarks/r01-candidates/cli-attempt.mjs';
const [mode, outputArg, extraPath]=process.argv.slice(2);
const output=resolve(outputArg), scratch=mkdtempSync(join(tmpdir(),'r01-codex-gates-'));
const binary=resolveBinary('codex'), profile=PROFILES['codex-current'];
const sourceHome=process.env.CODEX_HOME ?? join(process.env.HOME,'.codex');
const preserved=['auth.json','config.toml','AGENTS.md'].map(name=>({name,bytes:existsSync(join(sourceHome,name)) ? readFileSync(join(sourceHome,name)):null}));
const save=(name,value)=>writeFileSync(join(output,name),typeof value==='string'? value: JSON.stringify(value,null,2)+'\n');
mkdirSync(output);
try {
 const isolated=join(scratch,'home');mkdirSync(isolated,{mode:0o700});
 const auth=preserved.find(p=>p.name==='auth.json').bytes, parsed=JSON.parse(auth);
 if(parsed.auth_mode!=='chatgpt'||parsed.OPENAI_API_KEY)throw new Error('ChatGPT file authentication required');
 writeFileSync(join(isolated,'auth.json'),auth,{mode:0o600});
 writeFileSync(join(scratch,'system.txt'),SYSTEM);
 const spec=invocation(profile,scratch);spec.env.CODEX_HOME=isolated;
 // Baseline collector logs parsed SSE events only, never HTTP auth headers.
 const extra=extraPath ? JSON.parse(readFileSync(extraPath,'utf8')):[];
 let args=spec.args.slice();args.splice(args.length-1,0,...extra);
 if(mode!=='exec') {
  const flags=[];for(let i=0;i<args.length;i++)if(['-c','--enable','--disable'].includes(args[i]))flags.push(args[i],args[++i]);
  args=['debug',mode==='catalog'?'models':'prompt-input',...flags,'-c',`model=${JSON.stringify(profile.model)}`];
  if(mode==='prompt')args.push('Control prompt. Reply OK.');
 }
 const prompt=readFileSync('context/evidence/data/r01-cli-controls/codex-current/prompt.txt','utf8');
 save('manifest.json',{schema:'r01-codex-gate-experiment-v1',kind:mode,profile,binary,args,scratch,isolatedHome:isolated,timeoutMs:120000,wrapperRetries:0,startedAt:new Date().toISOString(),sourceSha256:sha(readFileSync(new URL(import.meta.url))),explicitEnvironment:{CODEX_HOME:isolated,CODEX_ROLLOUT_TRACE_ROOT:spec.env.CODEX_ROLLOUT_TRACE_ROOT,RUST_LOG:spec.env.RUST_LOG}});
 save('prompt.txt',prompt);save('system.txt',SYSTEM);
 const start=performance.now();const r=spawnSync(binary.realPath,args,{cwd:scratch,env:spec.env,input:mode==='exec'?prompt:undefined,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024,killSignal:'SIGKILL'});
 save('stdout.jsonl',r.stdout??'');save('stderr.txt',r.stderr??'');
 for(const n of ['codex-traces'])if(existsSync(join(scratch,n)))cpSync(join(scratch,n),join(output,n),{recursive:true});
 const result={exitCode:r.status,signal:r.signal,error:r.error?.message??null,elapsedMs:performance.now()-start};save('process.json',result);console.log(result);
} finally {
 save('preserved-state.json',preserved.map(p=>({name:p.name,unchanged:p.bytes===null?!existsSync(join(sourceHome,p.name)):p.bytes.equals(readFileSync(join(sourceHome,p.name)))})));
 rmSync(scratch,{recursive:true,force:true});
}
