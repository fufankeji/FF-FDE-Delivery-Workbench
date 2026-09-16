import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import type { Role, Snapshot } from './api';
import { sceneRects, sceneDesign } from './SceneArt';

export {Avatar, palette} from './PixelPeople';
import {characterPixels} from './PixelPeople';
export default function PixelOffice({ roles, selected, snapshot, onSelect }: { roles: Role[]; selected: string; snapshot: Snapshot; onSelect: (id: string) => void }) {
  const design=sceneDesign(snapshot.caseId);const anchors=design.anchors;
  const mount = useRef<HTMLDivElement>(null); const live = useRef({ selected, snapshot }); live.current={selected,snapshot};
  useEffect(()=>{
    let closed=false; const app = new Application(); let observer: ResizeObserver | undefined;
    const init=async()=>{
      await app.init({ width:860,height:570,background:0xd6c7aa,antialias:false,resolution:Math.min(devicePixelRatio||1,2),autoDensity:true,preference:'webgl' });
      if(closed){app.destroy(true,{children:true});return;}
      if(!mount.current)return;
      mount.current.appendChild(app.canvas);app.canvas.setAttribute('aria-hidden','true');app.canvas.style.width='100%';app.canvas.style.height='100%';
      const room=new Graphics();for(const [x,y,w,h,c] of sceneRects(snapshot.caseId))room.rect(x,y,w,h).fill(c);app.stage.addChild(room);
      const figures=roles.map((role,i)=>{
        const anchor=anchors[i%anchors.length];const container=new Container();container.position.set(anchor.x,anchor.y);const shadow=new Graphics().ellipse(0,48,23,7).fill({color:0x34483b,alpha:.2});container.addChild(shadow);
        const ring=new Graphics().ellipse(0,48,27,10).stroke({color:0xfbe59b,width:4});container.addChild(ring);
        const person=new Graphics();for(const [x,y,w,h,c]of characterPixels(i,snapshot.caseId))person.rect((x-8)*2,y*2,w*2,h*2).fill(c);container.addChild(person);
        const dots=new Graphics();container.addChild(dots);container.eventMode='static';container.cursor='pointer';container.on('pointertap',()=>onSelect(role.id));app.stage.addChild(container);return{role,person,ring,dots};
      });
      let time=0;app.ticker.maxFPS=30;app.ticker.add((ticker)=>{time+=ticker.deltaTime;figures.forEach(({role,person,ring,dots},i)=>{const active=live.current.selected===role.id;const busy=live.current.snapshot.sessions.find(s=>s.roleId===role.id)?.status==='running';ring.visible=active;ring.alpha=.8+Math.sin(time/13)*.2;person.y=Math.round(Math.sin(time/(busy?5:22)+i)*(busy?2:1));dots.clear();if(busy)for(let n=0;n<3;n++)dots.rect(-9+n*8,-9+(Math.floor(time/8)%3===n?-3:0),4,4).fill(0x426756);});});
      const visibility=()=>{if(document.hidden)app.stop();else app.start();};document.addEventListener('visibilitychange',visibility);(app as Application & {clearVisibility?:()=>void}).clearVisibility=()=>document.removeEventListener('visibilitychange',visibility);
      observer=new ResizeObserver(()=>{ /* Canvas uses the fixed scene coordinates; CSS preserves aspect ratio. */ });observer.observe(mount.current);
    };
    init().catch(err=>{if(mount.current)mount.current.dataset.error=String(err);});
    return()=>{closed=true;observer?.disconnect();(app as Application & {clearVisibility?:()=>void}).clearVisibility?.();if(app.renderer)app.destroy(true,{children:true});};
  },[snapshot.caseId,roles.map(r=>r.id).join('|')]);
  return <div className={`fde-office-scene scene-${snapshot.caseId}`}><div ref={mount} className="fde-office-canvas"/><div className="fde-office-sign"><span>▰</span><strong>{snapshot.case.company}</strong><small>BUSINESS DISCOVERY LAB</small></div>{design.labels.map(label=><div key={label.text} className="fde-scene-zone" style={{left:`${label.x/860*100}%`,top:`${label.y/570*100}%`}}>{label.text}</div>)}{roles.map((r,i)=>{const items=snapshot.discovery.filter(d=>d.roleId===r.id&&d.required);const completed=items.filter(d=>d.status==='completed'||d.status==='verified_currently_unknown').length;const session=snapshot.sessions.find(s=>s.roleId===r.id);const p=anchors[i%anchors.length];return <button key={r.id} className={`fde-person-label ${selected===r.id?'selected':''}`} style={{left:`${p.x/860*100}%`,top:`${(p.y+51)/570*100}%`}} onClick={()=>onSelect(r.id)} title={`${r.name} · ${r.title}`} aria-label={`访问${r.name}，${r.title}，已发现${completed}/${items.length}项`} aria-pressed={selected===r.id}><strong>{r.name}<i className={session?.status==='running'?'busy':''}/></strong><span>{r.title}</span><b><em style={{width:`${items.length?completed/items.length*100:0}%`}}/></b></button>;})}</div>;
}
