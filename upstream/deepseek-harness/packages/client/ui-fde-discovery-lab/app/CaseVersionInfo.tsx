import {useState} from 'react';
import {api} from './api';
import type {CaseIntro,RunHistory} from './api';

export function CaseVersionInfo({caseInfo:c,runId,busy,onUpgrade}:{caseInfo:CaseIntro;runId?:string;busy:boolean;onUpgrade:(runId:string)=>Promise<void>}){
 const notice=c.simulationNotice||(c.id==='finance'?'本案例使用模拟企业调查材料，访谈与计算用于教学调查，不会操作真实报销或支付。':'');
 const scope=c.materialScope||(c.id==='finance'&&c.version==='1.0.0'?'基础资料：8 笔当前材料；180 笔历史队列与 12 笔工时样本分别核实。':'');
 return <section className="fde-case-version" aria-label="本轮案例版本与资料范围"><div className="fde-version-line"><strong>{runId?'本轮案例':'案例'} v{c.version}</strong>{c.upgradeAvailable&&<span>深化版本 v{c.latestVersion} 已可用</span>}</div>{scope&&<p className="fde-material-scope">{scope}</p>}{notice&&<p className="fde-simulation-notice">{notice}</p>}{c.upgradeAvailable&&runId&&<div className="fde-upgrade-entry"><p>本轮仍使用原有资料与调查项。开启深化调查后，旧轮次的记录、完成进度和报告会保留。</p><button className="fde-button secondary" disabled={busy} onClick={()=>void onUpgrade(runId)}>保留旧报告，开启深化调查</button>{busy&&<small>请在当前访谈、证据核对和报告生成结束后开启。</small>}</div>}</section>;
}
export function RunHistoryPanel({caseId,currentRunId}:{caseId:string;currentRunId?:string}){
 const [open,setOpen]=useState(false),[items,setItems]=useState<RunHistory[]|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=async()=>{setLoading(true);setError('');try{setItems(await api.history(caseId));}catch(e){setError(e instanceof Error?e.message:'旧轮次暂时无法读取');}finally{setLoading(false);}};
 const old=items?.filter(r=>r.runId!==currentRunId)||[];
 return <section className="fde-run-history"><button className="fde-text-button" aria-expanded={open} onClick={()=>{setOpen(v=>!v);if(!open)void load();}}>{open?'收起旧轮次':'查看旧轮次进度与报告'}</button>{open&&<div className="fde-history-content">{loading?<p className="fde-muted">正在读取已保留的轮次…</p>:error?<div className="fde-error">{error}<button className="fde-text-button" onClick={()=>void load()}>重新读取</button></div>:!old.length?<p className="fde-muted">当前没有其他已保留的调查轮次。</p>:old.map(r=><article key={r.runId}><header><strong>案例 v{r.version}</strong><span>调查完成 {r.progress.completed} / {r.progress.total} 项</span><time>{new Date(r.createdAt).toLocaleString('zh-CN')}</time></header><div>{r.reports.length?r.reports.map(report=><div className="fde-history-report" key={report.id}><span>报告 v{report.version} · {report.status==='completed'?'已生成':report.status==='error'?'生成未完成':'生成中'}</span>{report.status==='completed'&&<><a className="fde-text-button" href={api.reportUrl(r.runId,report.id,'md')} download>下载 Markdown</a><a className="fde-text-button" href={api.reportUrl(r.runId,report.id,'pdf')} download>下载 PDF</a></>}</div>):<p className="fde-muted">该轮次未生成报告，原调查记录仍保留。</p>}</div></article>)}</div>}</section>;
}
