import {characterPixels} from './PixelPeople';
export type PixelRect = [number,number,number,number,number];
function financeRoom(): PixelRect[] {
  const rects: PixelRect[] = [];
  const box = (x:number,y:number,w:number,h:number,c:number)=>{rects.push([x,y,w,h,c]);};
  box(0,0,860,570,0xd6c7aa);
  for(let y=0;y<570;y+=18) for(let x=0;x<860;x+=62) { box(x+(y%36?31:0),y,60,17,(x+y)%5===0?0xd8c7a7:0xd3c09f); box(x+(y%36?31:0),y+17,60,1,0xc4b18f); }
  // Window wall, daylight and quiet meeting area.
  box(0,0,860,15,0x59675e); box(0,15,860,7,0xe2ded0);
  box(171,23,365,118,0x647c79); box(178,29,351,106,0xbdd6d5);
  for(let i=0;i<9;i++){ const h=30+(i*23)%57; box(180+i*40,135-h,28,h,i%2?0xa0b9bb:0xabc3c3); }
  for(let x=181;x<534;x+=70) {box(x,29,3,106,0xe9ede0);box(x+3,30,3,106,0x859994);} box(180,90,349,4,0xe4eadf);
  box(14,33,135,91,0xe9e2ce);box(20,39,123,79,0xf4efdF);
  box(11,130,134,11,0xc0ac88);
  // Lounge, rug, sofa and coffee table.
  box(14,167,135,119,0x758a77);box(21,174,121,105,0x81937e);
  box(24,165,107,45,0x414e4a);box(24,158,107,13,0x52615b);box(20,161,10,58,0x46564f);box(126,161,10,58,0x46564f);
  for(let x=33;x<126;x+=30) box(x,174,28,22,0x607168);box(32,211,4,8,0x344039);box(119,211,4,8,0x344039);
  box(49,236,68,21,0xa1784b);box(45,229,76,20,0xb8935c);box(51,249,5,13,0x735b3e);box(108,249,5,13,0x735b3e);
  box(75,223,14,10,0xe1e7d6);box(80,218,5,8,0x5b7f52);
  // Conference table and chairs.
  box(233,161,200,70,0x775c40);box(228,152,210,72,0xb48c58);box(234,158,198,58,0xcba973);
  const chair=(x:number,y:number)=>{box(x+8,y+29,3,9,0x424f48);box(x+30,y+29,3,9,0x424f48);box(x,y,40,15,0x56665d);box(x+3,y+15,34,18,0x66786b);box(x+1,y+31,38,4,0x394b43);};
  chair(244,112);chair(311,112);chair(378,112);chair(246,222);chair(380,222);
  box(310,172,35,20,0xe8e8d9);box(355,180,24,11,0xf1e9d8);box(328,155,14,15,0x667849);box(323,147,23,15,0x688758);
  // Department divider and shelving.
  box(544,20,9,144,0x69736b);box(554,150,292,10,0x72796c);box(798,19,8,132,0x717568);
  const shelf=(x:number,y:number)=>{box(x,y,45,95,0x775b3b);for(let k=0;k<3;k++){box(x+4,y+5+k*29,37,24,0xb39466);for(let j=0;j<5;j++)box(x+7+j*6,y+10+k*29,4,18,[0x617c79,0xa57255,0xd9caa6,0x728359,0x9c987b][j]);}};
  shelf(737,33);shelf(15,320);
  // Low wall separates work pods; entrance and technical room.
  box(163,338,681,9,0x657c70);box(164,347,681,6,0xa6b5a3);box(392,348,8,222,0x74877a);box(392,357,8,59,0xb3cec2);
  box(162,350,230,220,0xadc1b8);for(let x=167;x<391;x+=32)box(x,351,1,219,0x9dafaa);for(let y=350;y<570;y+=32)box(163,y,229,1,0x9dafaa);
  box(160,348,7,220,0x6c7b70);box(22,481,119,70,0x8c9c8b);box(29,488,105,55,0xa4afa0);
  box(436,359,400,195,0xc5af89);for(let y=365;y<550;y+=19)box(441,y,390,1,0xb79f7d);
  const desk=(x:number,y:number,wide=110)=>{box(x+6,y+45,6,25,0x655f4b);box(x+wide-12,y+45,6,25,0x655f4b);box(x,y,wide,50,0x8e7954);box(x+1,y+1,wide-2,44,0xd1bb8f);box(x+9,y-25,43,30,0x3e5350);box(x+13,y-21,35,21,0xb6d7d3);box(x+25,y+5,12,5,0x53665e);box(x+12,y+14,40,8,0xe2e1cb);box(x+68,y+7,27,25,0xf0ecdd);box(x+74,y+11,15,2,0xb9bfae);box(x+74,y+16,15,2,0xb9bfae);};
  desk(197,291);desk(400,290,114);desk(591,299,126);desk(585,124,127);desk(221,483,123);desk(568,482,145);
  // Server rack, document cabinet and printer.
  box(175,406,32,132,0x4d625c);for(let y=414;y<536;y+=21){box(179,y,24,16,0x6d8378);box(196,y+6,3,3,0xb8d298);}
  box(753,245,53,81,0x7e8b7b);for(let y=251;y<318;y+=22){box(757,y,45,19,0xa8b2a0);box(774,y+5,12,3,0x627369);}
  box(751,225,59,27,0xd4d8c6);box(760,219,39,10,0x4c6159);box(763,212,33,13,0xf2f0df);
  const plant=(x:number,y:number)=>{box(x+6,y+20,20,26,0x9c8158);box(x+3,y+19,26,7,0xb79b72);box(x+14,y-10,4,33,0x607945);box(x+4,y-13,16,12,0x6c8c50);box(x+14,y-2,20,13,0x567d44);box(x-2,y+3,18,12,0x76954d);box(x+15,y-22,13,15,0x779750);};
  [[137,119],[15,283],[826,115],[533,276],[355,438],[775,447],[115,389],[452,80]].forEach(([x,y])=>plant(x,y));
  box(0,561,860,9,0x5d7367);box(0,0,8,570,0x677b6c);box(852,0,8,570,0x677b6c);
  return rects;
}

const designs:Record<string,{name:string;accent:string;focus:string[];anchors:{x:number;y:number}[];labels:{x:number;y:number;text:string}[]}>= {
 finance:{name:'财务共享办公室',accent:'#598778',focus:['单据流转','岗位协作','规则与口径'],anchors:[{x:239,y:255},{x:443,y:255},{x:616,y:91},{x:638,y:265},{x:276,y:425},{x:622,y:425}],labels:[{x:275,y:35,text:'单据核验'},{x:53,y:308,text:'资料归档'},{x:450,y:375,text:'流程协作'}]},
 manufacturing:{name:'现场服务工坊',accent:'#658394',focus:['现场响应','设备与文档','服务协作'],anchors:[{x:145,y:110},{x:440,y:180},{x:270,y:300},{x:685,y:100},{x:690,y:340},{x:435,y:440},{x:100,y:435}],labels:[{x:55,y:80,text:'服务调度'},{x:325,y:75,text:'设备检修'},{x:635,y:275,text:'备件与发运'},{x:310,y:415,text:'技术资料'}]},
 operations:{name:'运营分析室',accent:'#8980a7',focus:['经营波动','指标口径','分析与行动'],anchors:[{x:170,y:130},{x:410,y:175},{x:665,y:175},{x:150,y:370},{x:400,y:385},{x:650,y:390},{x:700,y:40}],labels:[{x:230,y:35,text:'经营观察'},{x:370,y:290,text:'分析协作岛'},{x:38,y:300,text:'商品与渠道'},{x:560,y:340,text:'数据工作台'}]},
 'internal-service':{name:'内部服务中心',accent:'#9c8465',focus:['办事经历','文件与权限','转交与跟进'],anchors:[{x:165,y:205},{x:405,y:185},{x:665,y:195},{x:165,y:435},{x:425,y:430},{x:690,y:435},{x:690,y:40}],labels:[{x:55,y:130,text:'员工服务台'},{x:345,y:110,text:'咨询与转交'},{x:50,y:385,text:'项目协作'},{x:575,y:360,text:'制度与文件'}]},
 logistics:{name:'物流协作仓',accent:'#a18153',focus:['库存与可售','在途与时效','供货协作'],anchors:[{x:140,y:140},{x:410,y:130},{x:705,y:170},{x:140,y:410},{x:410,y:380},{x:700,y:405}],labels:[{x:45,y:100,text:'采购与到货'},{x:330,y:55,text:'批次调度'},{x:620,y:110,text:'拣选与包装'},{x:290,y:315,text:'库存核对'},{x:600,y:365,text:'履约协作'}]},
};
export const sceneDesign=(id:string)=>designs[id]||designs.finance;
const cache=new Map<string,PixelRect[]>();
export function sceneRects(id:string):PixelRect[]{
 if(cache.has(id))return cache.get(id)!;
 if(id==='finance'||!designs[id]){const r=financeRoom();cache.set(id,r);return r;}
 const r:PixelRect[]=[];const b=(x:number,y:number,w:number,h:number,c:number)=>{r.push([x,y,w,h,c]);};
 const floors:Record<string,number>={manufacturing:0xbcc4be,operations:0xd8cfbf,'internal-service':0xded5c2,logistics:0xcab68e};
 b(0,0,860,570,floors[id]);
 for(let y=14;y<570;y+=28)for(let x=8;x<860;x+=56){b(x,y,55,1,0xffffff);b(x,y,1,27,0xffffff);}
 b(0,0,860,16,0x52665f);b(0,16,860,9,0xe3e2d4);b(0,0,8,570,0x52665f);b(852,0,8,570,0x52665f);b(0,560,860,10,0x52665f);
 const rug=(x:number,y:number,w:number,h:number,c:number)=>{b(x,y,w,h,c);b(x+5,y+5,w-10,2,0xffffff);b(x+5,y+h-7,w-10,2,0xffffff);};
 const chair=(x:number,y:number,c=0x657d75)=>{b(x+4,y+22,4,12,0x475853);b(x+29,y+22,4,12,0x475853);b(x,y,38,13,c);b(x+2,y+14,34,16,c);b(x+3,y+16,31,2,0xa1b1a4);};
 const papers=(x:number,y:number)=>{b(x+2,y+3,27,20,0xafa98c);b(x,y,27,20,0xf6f0db);for(let i=0;i<3;i++)b(x+5,y+5+i*4,17,1,0x8e9b91);};
 const monitor=(x:number,y:number,w=48,h=33)=>{b(x,y,w,h,0x344b51);b(x+4,y+4,w-8,h-9,0x98bec0);b(x+w/2-3,y+h,6,8,0x53666a);b(x+w/2-13,y+h+7,26,4,0x53666a);b(x+8,y+8,w-20,3,0xd1e3d5);for(let i=0;i<3;i++)b(x+8,y+15+i*4,w-25-i*4,2,0x6c9c9d);};
 const desk=(x:number,y:number,w=130,c=0xc3a77d)=>{b(x+5,y+44,7,21,0x726650);b(x+w-12,y+44,7,21,0x726650);b(x,y,w,48,0x8d7c5f);b(x+2,y+2,w-4,40,c);monitor(x+10,y-24);papers(x+w-40,y+10);b(x+12,y+20,43,8,0xe2dfc9);};
 const plant=(x:number,y:number)=>{b(x,y+17,24,25,0xb59872);b(x-2,y+14,28,8,0xd1b991);b(x+10,y-16,5,32,0x647850);b(x-5,y-8,22,12,0x6b8c5e);b(x+10,y-20,19,14,0x82a270);b(x+12,y,21,12,0x597d59);};
 const shelf=(x:number,y:number,w=126,boxes=false)=>{b(x,y,w,106,0x596c66);for(let k=0;k<3;k++){b(x+5,y+5+k*33,w-10,27,0x9da78f);for(let j=0;j<Math.floor((w-14)/(boxes?32:13));j++){const xx=x+9+j*(boxes?32:13);b(xx,y+11+k*33,boxes?27:9,21,boxes?0xc29d62:[0x6d8b83,0xa68571,0xb2b6a3,0xd6c6a0][(j+k)%4]);if(boxes)b(xx+11,y+11+k*33,4,21,0xe2c490);else b(xx+2,y+14+k*33,5,3,0xece8d4);}}};
 const window=(x:number,y:number,w:number)=>{b(x,y,w,91,0x7d9590);b(x+5,y+5,w-10,80,0xc2d7d2);for(let i=0;i<w-30;i+=36)b(x+8+i,y+40-(i%29),24,43+i%29,0xa4bcb8);for(let i=5;i<w;i+=58)b(x+i,y+5,4,80,0xf3efe0);b(x+5,y+48,w-10,4,0xf3efe0);};
 const crate=(x:number,y:number,w=42,h=32)=>{b(x+3,y+h,w,5,0x8e7753);b(x,y,w,h,0xcaa064);b(x+3,y+3,w-6,3,0xe0bc7e);b(x+w/2-3,y,6,h,0xe5cc96);b(x+5,y+h-11,12,6,0xf1e5c5);};
 if(id==='manufacturing'){
  // A central machine bay, separated from dispatch and the spare-parts aisle.
  rug(310,72,250,280,0x829799);b(321,84,228,4,0xe6bc63);b(321,337,228,4,0xe6bc63);
  b(351,103,159,100,0x516a72);b(360,111,141,79,0xc1cebf);b(383,126,97,50,0x768a89);b(405,134,49,34,0x2c4852);b(366,193,135,15,0x879b93);b(377,207,14,21,0x4d666c);b(471,207,14,21,0x4d666c);b(490,116,7,9,0xe7bd66);b(490,132,7,9,0xc07957);
  b(568,43,8,211,0x657c7b);b(25,324,278,8,0x738b88);b(25,331,278,5,0xe4be68);
  desk(70,64,145,0xaebfbb);monitor(30,36,70,42);papers(233,63);shelf(45,235,140);
  b(171,359,142,60,0x52787b);b(177,365,130,42,0x91aaa3);for(let i=0;i<5;i++){b(187+i*23,375,9,21,0xd6cbb0);b(190+i*23,368,4,14,0x5b6c69);}crate(220,423);
  shelf(614,37,180,true);desk(628,216,160,0xb4c3ba);shelf(602,448,185,true);crate(765,355,50,43);crate(785,409,42,31);
  desk(340,489,170);desk(52,485,105);plant(807,88);plant(320,365);chair(385,235,0x617c8a);chair(86,129);chair(648,276);
  for(let y=282;y<434;y+=22)b(566,y,7,13,0xf2d18a);
 }else if(id==='operations'){
  // Dashboard wall and central hex-like discussion island, with sample products.
  rug(260,145,295,290,0xb7b0c3);b(270,155,275,5,0xd9d4e0);
  b(231,27,344,100,0x525b77);b(240,35,326,82,0xd5dddb);
  for(let j=0;j<3;j++){b(250+j*102,45,93,61,0xa1b7b9);for(let i=0;i<5;i++){const h=15+(i*13+j*7)%36;b(258+j*102+i*16,98-h,10,h,[0x718ba1,0x9a87a5,0xb39c73][j]);}}
  b(329,227,168,102,0x8c788b);b(318,239,190,77,0xceb7a1);b(331,230,165,94,0xceb7a1);papers(357,250);papers(435,279);b(396,259,25,27,0x9caa87);chair(278,261,0x8c86a2);chair(514,261,0x8c86a2);chair(390,333,0x8c86a2);
  desk(103,194,125,0xc6b6c8);desk(600,238,165,0xc6b6c8);desk(572,452,180,0xc6b6c8);monitor(640,27,125,61);
  shelf(35,39,124);window(27,440,177);plant(209,365);plant(793,290);plant(591,105);
  b(36,319,167,14,0x8e7d68);b(42,336,6,45,0x8e7d68);b(184,336,6,45,0x8e7d68);
  b(48,294,40,25,0xc8a379);b(51,298,34,4,0xead3a8);b(52,306,32,3,0x9b8467);b(104,278,29,41,0x8caab1);for(let i=0;i<3;i++)b(108,285+i*10,21,3,0xd0ddd8);b(150,279,35,40,0xb7be98);b(155,284,25,28,0xe0e2c3);
  desk(325,480,145,0xc6b6c8);b(26,281,185,5,0xa697ab);b(549,340,282,7,0xa697ab);
 }else if(id==='internal-service'){
  // U-shaped reception, a waiting area and three distinct project consultation rooms.
  window(50,27,245);shelf(554,32,91);monitor(719,35,62,43);plant(806,46);
  rug(37,139,224,172,0xcbb89b);b(64,161,169,48,0x9a7b5b);b(70,165,157,36,0xe1cba4);b(64,167,28,125,0x9a7b5b);b(68,170,19,115,0xd9bc8c);monitor(102,140);papers(172,179);
  b(312,139,204,104,0xb7b5c5);b(321,150,188,90,0xd8d2df);desk(344,260,125,0xc8b6c2);chair(351,200,0x90899e);chair(441,200,0x90899e);
  b(594,147,184,50,0x786e7b);b(594,139,184,14,0x9e8b9a);for(let i=0;i<3;i++)b(603+i*57,157,50,26,0xb6a5b6);b(627,250,113,35,0xb99874);papers(660,255);plant(548,271);
  b(23,344,818,8,0x8d8a83);b(282,346,8,210,0x8d8a83);b(553,346,8,210,0x8d8a83);
  for(const x of [32,304,575]){b(x,365,249,155,0xe9dfcd);b(x+4,369,241,3,0xafa69b);}
  desk(98,483,135,0xc9bcaf);desk(358,482,143,0xc9bcaf);desk(625,483,153,0xc9bcaf);shelf(38,389,43);shelf(477,370,53);shelf(591,381,42);papers(384,381);plant(773,355);plant(29,289);
  b(319,49,178,55,0x838899);b(326,56,164,41,0xd5d2d8);for(let i=0;i<4;i++)b(338+i*38,64,27,26,[0xbbb290,0x9dafab,0xa495b3,0xc2a59b][i]);
 }else{
  // Long warehouse racks, striped travel aisle, packing conveyor and dispatch station.
  rug(310,28,245,527,0xb8ad8d);for(let y=38;y<549;y+=27){b(320,y,5,16,0xf4d787);b(538,y,5,16,0xf4d787);}
  shelf(29,30,233,true);shelf(30,294,225,true);shelf(604,29,222,true);crate(52,423,64,48);crate(209,441,46,40);
  desk(75,213,156);desk(353,65,155,0xb7b797);b(361,25,119,26,0x586e70);for(let i=0;i<5;i++)b(367+i*21,31,16,13,[0xabc2ad,0xc4b081,0x9eb6c1][i%3]);
  b(600,238,220,66,0x687b72);b(605,244,210,51,0xa4ad98);for(let x=609;x<814;x+=19)b(x,249,9,39,0xd3d1b4);crate(631,225,50,43);crate(737,224,48,43);b(612,305,8,31,0x6e7665);b(798,305,8,31,0x6e7665);
  b(340,281,152,50,0x8f8266);b(344,285,144,42,0xc2b292);crate(357,268,50,41);crate(422,271,40,38);b(368,334,7,21,0x9a794f);b(452,334,7,21,0x9a794f);
  desk(625,477,165,0xb7b797);desk(340,454,155,0xb7b797);chair(391,185,0x7b8b6c);chair(670,362,0x7b8b6c);plant(272,94);
  b(27,152,230,6,0xc19755);b(605,141,213,6,0xc19755);for(let i=0;i<4;i++){b(40+i*57,43,25,14,0xf0dcac);b(614+i*54,41,25,14,0xf0dcac);}b(585,357,248,5,0xa68d63);
 }
 cache.set(id,r);return r;
}

/** Each cover is the corresponding original floor plan, never a recoloured stock facade. */
export function SceneCover({caseId}:{caseId:string}){
 const d=sceneDesign(caseId);
 return <svg className="fde-scene-cover" viewBox="0 0 860 570" role="img" aria-label={`${d.name}像素场景`} shapeRendering="crispEdges">{sceneRects(caseId).map(([x,y,w,h,c],i)=><rect key={i} x={x} y={y} width={w} height={h} fill={`#${c.toString(16).padStart(6,'0')}`}/>)}{d.anchors.map((p,i)=><g key={i} transform={`translate(${p.x} ${p.y})`}><rect x="-23" y="43" width="46" height="10" fill="#526459" opacity=".25"/>{characterPixels(i,caseId).map(([x,y,w,h,c],j)=><rect key={j} x={(x-8)*2} y={y*2} width={w*2} height={h*2} fill={c}/>)}</g>)}</svg>;
}
