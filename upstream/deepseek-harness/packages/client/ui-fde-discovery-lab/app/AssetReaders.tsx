import {useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {api} from './api';
import type {Asset} from './api';
import {JsonReader} from './JsonReader';

export function CsvReader({rows}:{rows:string[][]}){
 const [query,setQuery]=useState(''),[page,setPage]=useState(0);const size=100;
 const matches=useMemo(()=>rows.slice(1).map((cells,i)=>({cells,row:i+2})).filter(({cells})=>!query||cells.some(c=>c.toLocaleLowerCase().includes(query.toLocaleLowerCase()))),[rows,query]);
 const pages=Math.max(1,Math.ceil(matches.length/size));
 return <><div className="fde-reader-controls"><label>检索原表 <input aria-label="检索表格原始行" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="编号、字段值或关键词"/></label><span>原表 {Math.max(0,rows.length-1)} 行 · 匹配 {matches.length} 行</span></div><div className="fde-table-scroll"><table><thead><tr><th>原件行号</th>{rows[0]?.map((c,i)=><th key={i}>{c}</th>)}</tr></thead><tbody>{matches.slice(page*size,(page+1)*size).map(({cells,row})=><tr key={row}><td>{row}</td>{cells.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table>{!matches.length&&<p className="fde-muted">没有匹配记录；清空检索可查看全部原件。</p>}</div><div className="fde-reader-controls"><span>保留原始表头与单位 · 每页 {size} 行 · {page+1} / {pages} 页</span><button className="fde-button secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>上一页</button><button className="fde-button secondary" disabled={page+1>=pages} onClick={()=>setPage(p=>p+1)}>下一页</button></div></>;
}
function ReferenceText({url,isJson=false}:{url:string;isJson?:boolean}){
 const [text,setText]=useState('读取原件…');
 useEffect(()=>{const c=new AbortController();fetch(url,{signal:c.signal,credentials:'same-origin'}).then(async r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();}).then(setText).catch(e=>{if(!c.signal.aborted)setText(`原件读取失败：${e.message}`);});return()=>c.abort();},[url]);
 return isJson?<JsonReader text={text}/>:<pre className="fde-text-preview">{text}</pre>;
}
export function ImageReader({url,title,runId,assetId,assets,renderPdf}:{url:string;title:string;runId:string;assetId:string;assets:Asset[];renderPdf:(url:string,title:string)=>ReactNode}){
 const [zoom,setZoom]=useState(100),[comparison,setComparison]=useState('');const target=assets.find(a=>a.id===comparison);const others=assets.filter(a=>a.id!==assetId&&(/^(image\/|text\/)/.test(a.mimeType)||/pdf|json|sql/.test(a.mimeType)||/\.(md|txt|csv|json|sql)$/i.test(a.title)));
 return <><div className="fde-reader-controls"><button className="fde-button secondary" disabled={zoom<=50} onClick={()=>setZoom(z=>z-25)}>缩小</button><span>{zoom}%</span><button className="fde-button secondary" disabled={zoom>=300} onClick={()=>setZoom(z=>z+25)}>放大</button><button className="fde-text-button" onClick={()=>setZoom(100)}>适应窗口</button><label>并排核对 <select aria-label="选择并排核对原件" value={comparison} onChange={e=>setComparison(e.target.value)}><option value="">仅查看图片</option>{others.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label></div><div className={`fde-image-comparison ${target?'split':''}`}><div className="fde-image-viewport"><img src={url} alt={title} style={{width:`${zoom}%`,maxWidth:'none'}} onError={e=>{e.currentTarget.alt=`图片暂时无法载入：${title}`;}}/></div>{target&&<section className="fde-comparison-original"><h3>{target.title}</h3>{target.mimeType.includes('pdf')?renderPdf(api.assetUrl(runId,target.id),target.title):target.mimeType.startsWith('image/')?<img src={api.assetUrl(runId,target.id)} alt={target.title}/>:<ReferenceText key={target.id} url={api.assetUrl(runId,target.id)} isJson={/json/.test(target.mimeType)||/\.json$/i.test(target.title)}/>}</section>}</div></>;
}
