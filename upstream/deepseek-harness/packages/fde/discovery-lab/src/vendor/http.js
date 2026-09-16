import { readFileSync } from 'node:fs';
import { calculateMetric } from './metrics.js';

async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>32768)throw Object.assign(new Error('请求过大'),{status:413});}return raw?JSON.parse(raw):{};}
export function createApiHandler(service) {
  return async(req,res)=>{
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try{
      // Same-origin browser mutations only. No credentials are placed in this API.
      if(req.method!=='GET' && req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)throw Object.assign(new Error('跨站请求被拒绝'),{status:403});
      const url=new URL(req.url,'http://localhost');const parts=url.pathname.slice('/api/fde-discovery-lab'.length).split('/').filter(Boolean).map(decodeURIComponent);
      const [collection,id,sub,subId,action]=parts;
      if(collection==='cases'&&req.method==='GET'&&!id)return json(service.list());
      if(collection==='cases'&&req.method==='GET'&&sub==='history')return json(service.history(id));
      if(collection==='cases'&&req.method==='POST'&&sub==='start')return json(await service.start(id));
      if(collection!=='runs'||!id)return json({error:'接口不存在'},404);
      if(req.method==='POST'&&sub==='upgrade')return json(await service.upgrade(id));
      if(req.method==='GET'&&['assets','reports'].includes(sub))service.store.run(id);else service.requireLive(id);
      if(req.method==='GET'&&!sub)return json(await service.snapshot(id));
      if(req.method==='POST'&&sub==='restart')return json(await service.restart(id));
      if(req.method==='GET'&&sub==='requests')return json(service.receipt(id,subId));
      if(sub==='roles'){
        if(req.method!=='POST')return json({error:'方法不允许'},405);
        const input=await body(req);
        if(action==='messages')return json(await service.send(id,subId,input.requestId,input.text),202);
        if(action==='hints')return json(service.hints(id,subId,input));
        const row=await service.ensureRole(id,subId);
        if(action==='select')return json({sessionId:row.session_id});
        if(action==='stop'){service.native.stop(row.session_id);return json({ok:true});}
        if(action==='reevaluate'){service.queueEvaluation(id,subId);return json({ok:true});}
      }
      if(sub==='assets'){
        const {asset,path}=service.grant(id,subId,{allowArchived:req.method==='GET'});
        if(req.method==='POST'&&action==='collect'){service.store.exec('UPDATE grants SET collected=1 WHERE run_id=? AND asset_id=?',id,subId);return json({ok:true});}
        if(req.method==='GET'){
          const bytes=readFileSync(path);if(service.store.live(id))service.markViewed(id,subId);res.writeHead(200,{'Content-Type':asset.mime,'Content-Length':bytes.length,'X-Content-Type-Options':'nosniff','Content-Security-Policy':asset.mime==='application/pdf'?"frame-ancestors 'self'":"sandbox; default-src 'none'; style-src 'unsafe-inline'",'Content-Disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(asset.path.split('/').at(-1))}`});res.end(bytes);return;
        }
      }
      if(sub==='metrics'&&action==='calculate'&&req.method==='POST')return json(await calculateMetric(service,id,subId));
      if(sub==='reports'&&req.method==='POST'&&!subId)return json(await service.generateReport(id),202);
      if(sub==='reports'&&req.method==='GET'&&action==='export'){
        const format=url.searchParams.get('format')==='pdf'?'pdf':'md';const file=await service.exportReport(id,subId,format);
        res.writeHead(200,{'Content-Type':format==='pdf'?'application/pdf':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`});res.end(file.bytes);return;
      }
      json({error:'接口不存在'},404);
    }catch(error){if(!res.headersSent)json({error:error.message},error.status||400);else res.end();}
  };
}
