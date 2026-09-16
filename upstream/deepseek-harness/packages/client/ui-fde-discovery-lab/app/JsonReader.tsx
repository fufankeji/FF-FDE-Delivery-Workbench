import {useMemo,useState} from 'react';

type JsonRecord=Record<string,unknown>;
const isRecord=(v:unknown):v is JsonRecord=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const scalar=(v:unknown)=>v===null?'null':v===undefined?'—（原件无此字段）':typeof v==='string'?(v===''?'""（空字符串）':v):String(v);
/** Preserve every source key and value; these views do not infer business decisions. */
function JsonValue({value}:{value:unknown}){
 if(Array.isArray(value)){
  if(!value.length)return <span className="fde-json-empty">[]（空数组）</span>;
  if(value.every(isRecord))return <RecordTable rows={value.map((data,index)=>({data,index}))}/>;
  return <ol className="fde-json-values">{value.map((v,i)=><li key={i}><JsonValue value={v}/></li>)}</ol>;
 }
 if(isRecord(value))return <dl className="fde-json-fields">{Object.entries(value).map(([key,v])=><div key={key}><dt>{key}</dt><dd><JsonValue value={v}/></dd></div>)}{!Object.keys(value).length&&<div><dd>{'{}（空对象）'}</dd></div>}</dl>;
 return <span className="fde-json-scalar">{scalar(value)}</span>;
}
type IndexedRow={data:JsonRecord;index:number};
function RecordTable({rows}:{rows:IndexedRow[]}){
 const columns=Array.from(new Set(rows.flatMap(r=>Object.keys(r.data))));
 return <div className="fde-table-scroll fde-json-table"><table><thead><tr><th>原件序号</th>{columns.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map(({data,index})=><tr key={index}><td>{index+1}</td>{columns.map(k=><td key={k}><JsonValue value={data[k]}/></td>)}</tr>)}</tbody></table></div>;
}
function RecordCollection({rows,name}:{rows:JsonRecord[];name:string}){
 const timeline=rows.length>0&&rows.every(r=>typeof r.event_at==='string');
 const versions=rows.length>0&&rows.every(r=>typeof r.version==='string'&&typeof r.claim_id==='string'&&Array.isArray(r.allocation));
 const [view,setView]=useState(timeline?'timeline':versions?'versions':'table'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const size=50;
 const all=useMemo(()=>rows.map((data,index)=>({data,index})),[rows]);
 const matches=useMemo(()=>all.filter(r=>JSON.stringify(r.data).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[all,query]);
 const pages=Math.max(1,Math.ceil(matches.length/size));
 const visible=matches.slice(page*size,(page+1)*size);
 return <section className="fde-json-collection"><header><h3>{name}</h3><span>{rows.length} 条原始记录</span></header><div className="fde-reader-controls"><label>检索记录 <input aria-label={`检索 ${name} 原始记录`} value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="编号、字段或关键词"/></label><span>匹配 {matches.length} 条</span>{(timeline||versions)&&<div className="fde-tab-row"><button className={view==='table'?'active':''} onClick={()=>setView('table')}>原字段表格</button><button className={view!=='table'?'active':''} onClick={()=>setView(timeline?'timeline':'versions')}>{timeline?'事件时间线':'版本并列'}</button></div>}</div>{!matches.length?<p className="fde-muted">没有匹配记录；清空检索可查看全部原件。</p>:view==='timeline'?<ol className="fde-json-timeline">{visible.map(({data,index})=><li key={index}><div className="fde-json-event-heading"><time>{String(data.event_at)}</time><strong>{String(data.event_id||data.action||`记录 ${index+1}`)}</strong><small>原件序号 {index+1}</small></div><JsonValue value={data}/></li>)}</ol>:view==='versions'?<div className="fde-json-versions">{Array.from(new Set(visible.map(r=>String(r.data.claim_id)))).map(claim=><section key={claim}><h4>{claim}</h4><div>{visible.filter(r=>r.data.claim_id===claim).map(({data,index})=><article key={index}><header><strong>{String(data.version)}</strong><span>原件序号 {index+1}</span></header><JsonValue value={data}/></article>)}</div></section>)}</div>:<RecordTable rows={visible}/>}<div className="fde-reader-controls"><span>原字段与原顺序保留 · 每页 {size} 条 · {page+1} / {pages} 页</span><button className="fde-button secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>上一页</button><button className="fde-button secondary" disabled={page+1>=pages} onClick={()=>setPage(p=>p+1)}>下一页</button></div></section>;
}
export function JsonReader({text}:{text:string}){
 const parsed=useMemo(()=>{try{return {value:JSON.parse(text) as unknown,error:''};}catch{return {value:undefined,error:'当前内容无法解析为 JSON，以下保留原文；也可下载完整原件。'};}},[text]);
 if(parsed.error)return <><p className="fde-error">{parsed.error}</p><pre className="fde-text-preview">{text}</pre></>;
 const data=parsed.value;
 const collections=isRecord(data)?Object.entries(data).filter(([,v])=>Array.isArray(v)&&v.length>0&&v.every(isRecord)) as [string,JsonRecord[]][]:[];
 const metadata=isRecord(data)?Object.fromEntries(Object.entries(data).filter(([k])=>!collections.some(([name])=>name===k))):null;
 return <div className="fde-json-reader"><p className="fde-json-reading-note">原件阅读视图 · 字段名、记录编号及值保持原样，页面不代作业务判断。</p>{Array.isArray(data)&&data.length>0&&data.every(isRecord)?<RecordCollection key={text} rows={data} name="原始记录"/>:collections.length?<>{metadata&&Object.keys(metadata).length>0&&<section className="fde-json-metadata"><h3>原件说明与数据时点</h3><JsonValue value={metadata}/></section>}{collections.map(([name,rows])=><RecordCollection key={`${text.length}:${name}`} name={name} rows={rows}/>)}</>:<JsonValue value={data}/>}<details className="fde-json-source"><summary>查看完整 JSON 原文</summary><pre className="fde-text-preview">{text}</pre></details></div>;
}
