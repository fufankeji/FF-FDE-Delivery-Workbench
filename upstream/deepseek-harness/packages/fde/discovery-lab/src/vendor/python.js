import { spawn } from 'node:child_process';

/** Fixed, packaged calculation modules; business data goes through stdin, never executable arguments. */
export function pythonJSON(modulePath, operation, payload, {timeout=30000}={}) {
  if(!['calculate','check_discovery'].includes(operation))throw new Error('Unsupported deterministic operation');
  const code='import json,runpy,sys; m=runpy.run_path(sys.argv[1]); p=json.load(sys.stdin); print(json.dumps(m[sys.argv[2]](p["case"],p["id"],p["grants"]),ensure_ascii=False))';
  return new Promise((resolve,reject)=>{
    const env=Object.fromEntries(['PATH','LANG','LC_ALL','TMPDIR','SYSTEMROOT'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
    const child=spawn(process.env.FDE_PYTHON||'python3',['-I','-B','-c',code,modulePath,operation],{stdio:['pipe','pipe','pipe'],env});
    let out='',error='',failed=false;
    const timer=setTimeout(()=>{failed=true;child.kill();reject(new Error('确定性计算超时，请重试。'));},timeout);
    child.stdout.on('data',chunk=>{out+=chunk;if(out.length>2*1024*1024){failed=true;child.kill();reject(new Error('计算输出超出限制'));}});
    child.stderr.on('data',chunk=>{error=(error+chunk).slice(-4000);});
    child.on('error',e=>{clearTimeout(timer);failed=true;reject(new Error(`Python计算环境不可用：${e.message}`));});
    child.on('close',code=>{clearTimeout(timer);if(failed)return;if(code!==0)return reject(new Error(`原件计算未完成：${error}`));try{resolve(JSON.parse(out));}catch{reject(new Error('计算结果格式无效'));}});
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(payload));
  });
}
