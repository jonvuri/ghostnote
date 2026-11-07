// Local-only fault experiment. Dummy credentials; no upstream forwarding.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,cpSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { invocation,PROFILES,SYSTEM } from '../../brain/benchmarks/r01-candidates/cli-controls.mjs';
import {resolveBinary,sha} from '../../brain/benchmarks/r01-candidates/cli-attempt.mjs';
const output=resolve(process.argv[2]);mkdirSync(output);const binary=resolveBinary('codex'),results=[];
for(const scenario of [{id:'http-500',status:500,retries:0},{id:'http-429',status:429,retries:0},{id:'stream-disconnect',status:200,retries:0},{id:'positive-http-500',status:500,retries:1}]){
 const dir=join(output,scenario.id);mkdirSync(dir);const scratch=mkdtempSync(join(tmpdir(),'r01-codex-local-'));const requests=[];
 const server=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{
  requests.push({method:req.method,path:req.url,body:JSON.parse(body),dummyCredential:req.headers.authorization==='Bearer r01-local-dummy'});
  if(scenario.status===200){res.writeHead(200,{'content-type':'text/event-stream'});res.write('event: response.created\ndata: {"type":"response.created","response":{"id":"local","model":"gpt-6-luna"}}\n\n');setTimeout(()=>res.destroy(),20);}
  else {res.writeHead(scenario.status,{'content-type':'application/json','retry-after':'0'});res.end('{"error":{"message":"local test fault","type":"server_error"}}');}
 })});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try {
  const {args,env}=invocation(PROFILES['codex-current'],scratch,{});
  env.PATH=process.env.PATH;env.HOME=scratch;env.CODEX_HOME=join(scratch,'home');mkdirSync(env.CODEX_HOME);writeFileSync(join(scratch,'system.txt'),SYSTEM);
  env.R01_LOCAL_DUMMY_KEY='r01-local-dummy';
  for(const k of ['HTTPS_PROXY','HTTP_PROXY','ALL_PROXY','https_proxy','http_proxy','all_proxy'])env[k]='http://127.0.0.1:9';env.NO_PROXY=env.no_proxy='127.0.0.1,localhost';
  const at=args.indexOf('forced_login_method="chatgpt"');args.splice(at-1,2);
  args.splice(args.length-1,0,'--disable','enable_request_compression','-c','model_provider="r01-local"','-c','model_providers.r01-local.name="Local fault only"','-c',`model_providers.r01-local.base_url="http://127.0.0.1:${server.address().port}"`,'-c','model_providers.r01-local.env_key="R01_LOCAL_DUMMY_KEY"','-c',`model_providers.r01-local.request_max_retries=${scenario.retries}`,'-c','model_providers.r01-local.stream_max_retries=0','-c','model_providers.r01-local.supports_websockets=false');
  const child=spawn(binary.realPath,args,{cwd:scratch,env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);child.stdin.end('Local transport test. Reply OK.\n');
  const timer=setTimeout(()=>child.kill('SIGKILL'),45000);const result=await new Promise(ok=>child.once('exit',(exitCode,signal)=>ok({exitCode,signal})));clearTimeout(timer);
  writeFileSync(join(dir,'stdout.jsonl'),stdout);writeFileSync(join(dir,'stderr.txt'),stderr);
  if(existsSync(join(scratch,'codex-traces')))cpSync(join(scratch,'codex-traces'),join(dir,'codex-traces'),{recursive:true});
  const record={scenario,binary,args,process:result,requests};writeFileSync(join(dir,'record.json'),JSON.stringify(record,null,2)+'\n');results.push({id:scenario.id,httpRequests:requests.length,expected:1+scenario.retries,...result,dummyOnly:requests.every(r=>r.dummyCredential)});console.log(results.at(-1));
 }finally {await new Promise(ok=>server.close(ok));rmSync(scratch,{recursive:true,force:true});}
}
writeFileSync(join(output,'summary.json'),JSON.stringify({schema:'r01-codex-local-fault-exploration-v1',binary,sourceSha256:sha(readFileSync(new URL(import.meta.url))),results},null,2)+'\n');
