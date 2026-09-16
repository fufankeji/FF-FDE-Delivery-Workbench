import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TrainingService} from '../src/vendor/training.js';
import {calculateMetric} from '../src/vendor/metrics.js';
const root=fileURLToPath(new URL('../.assets/',import.meta.url));
test('All packaged calculations retain input grant gates and export Markdown/PDF without a model',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'fde-lab-calculations-'));
  const service=new TrainingService({on(){}},{root,dataDir:dir});
  t.after(async()=>{await service.dispose();rmSync(dir,{recursive:true,force:true});});
  let calculations=0;
  for(const c of service.cases.values()){
    const run=await service.start(c.id);
    await assert.rejects(calculateMetric(service,run.runId,c.calculations[0].id),/尚未取得/);
    // Explicit synthetic fixture grants; not claimed as a completed learner journey.
    for(const asset of c.assets)service.store.exec('INSERT INTO grants VALUES(?,?,?,?,?,?,?,?)',run.runId,asset.id,asset.roleIds[0],'fixture',0,'fixture',new Date().toISOString(),0);
    for(const definition of c.calculations){
      const result=await calculateMetric(service,run.runId,definition.id);
      assert.ok(result.details);
      assert.ok(result.inputHashes);
      assert.equal(service.store.get('SELECT COUNT(*) AS n FROM evidence WHERE run_id=? AND id=?',run.runId,'metric-'+run.runId+'-'+definition.id).n,1);
      calculations++;
    }
    if(c.id==='finance'){
      const markdown='# 业务现状诊断\n\n离线导出格式验证，不代表模型生成。\n\n|项目|结论|\n|---|---|\n|范围|仅用于导出测试|';
      service.store.exec('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)','fixture-report',run.runId,1,'completed','{}',markdown,null,null,new Date().toISOString());
      assert.equal((await service.exportReport(run.runId,'fixture-report','md')).bytes.toString(),markdown);
      const pdf=await service.exportReport(run.runId,'fixture-report','pdf');
      assert.equal(pdf.bytes.subarray(0,5).toString(),'%PDF-');
      assert.ok(pdf.bytes.length>1000);
    }
  }
  assert.equal(calculations,18);
});
