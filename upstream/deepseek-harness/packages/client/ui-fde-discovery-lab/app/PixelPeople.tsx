export const palette = ['#598778','#bf7960','#687fa2','#8b7295','#aa904f','#567b85','#7f8a56'];

const skin = ['#e7bb96','#e4b394','#c89675','#eec5a5','#caa286','#ddb28e','#e8be98'];
/** Original pixel geometry, authored for this product. Each tuple is x,y,w,h,color in a 16×24 grid. */
export function characterPixels(index: number, caseId = 'finance'): [number, number, number, number, string][] {
  const i = index % 7; const c = palette[i]; const hair = ['#28312d','#39312d','#554235','#263139','#614a38','#293638','#776c59'][i];
  const p: [number, number, number, number, string][] = [
    [4,2,8,2,hair],[3,4,10,7,hair],[2,6,2,3,hair],[12,6,2,3,hair],
    [4,6,8,7,skin[i]],[3,7,1,3,skin[i]],[12,7,1,3,skin[i]],
    [5,5,7,2,hair],[4,6,2,2,hair],[5,8,1,1,'#263238'],[10,8,1,1,'#263238'],[7,11,2,1,'#b77365'],
    [6,13,4,2,skin[i]],[4,14,8,6,c],[2,15,2,5,c],[12,15,2,5,c],
    [2,20,2,2,skin[i]],[12,20,2,2,skin[i]],[6,14,4,4,'#edf0e7'],[7,16,2,4,i===2||i===3?'#ba754c':c],
    [4,20,3,3,'#394548'],[9,20,3,3,'#394548'],[3,23,4,1,'#283537'],[9,23,4,1,'#283537'],
  ];
  if (i===1 || i===5) p.push([2,9,2,5,hair],[12,9,2,5,hair],[4,3,7,2,hair]);
  if (i===2 || i===4) p.push([4,8,3,2,'#3e5152'],[9,8,3,2,'#3e5152'],[7,8,2,1,'#3e5152'],[5,8,1,1,'#c2d8cf'],[10,8,1,1,'#c2d8cf']);
  if (i===3) p.push([6,1,5,2,hair],[3,4,3,3,hair]);
  if (i===6) p.push([3,3,10,3,'#d5a945'],[2,5,12,2,'#edc86c']);
  if(caseId==='manufacturing') {p.push([4,15,8,5,'#5d7a89'],[5,15,2,5,'#e3ab52'],[9,15,2,5,'#e3ab52'],[2,3,12,3,'#e8c266'],[4,1,8,3,'#f2d68a']);if(i===1||i===2)p.push([12,17,3,5,'#697575'],[12,16,3,2,'#bcc5bb']);}
  if(caseId==='operations'){p.push([4,14,8,6,['#c28279','#7a8fbb','#ad915b','#7b9b80','#a785aa','#566c90','#687f8c'][i]],[6,14,4,2,'#e9e6dc']);if(i===0||i===5)p.push([11,17,4,5,'#364958'],[12,18,2,3,'#c2d8dc']);}
  if(caseId==='internal-service'){p.push([4,14,8,6,'#84869f'],[7,14,2,4,'#ddc7a4'],[6,18,4,3,'#f4ecd8'],[7,19,2,1,'#64758a']);if(i===1)p.push([2,7,2,4,'#48545c'],[2,10,4,1,'#48545c']);}
  if(caseId==='logistics'){p.push([4,14,8,6,'#dcab54'],[4,17,8,1,'#f6e4a5'],[7,14,2,6,'#756146'],[3,2,10,3,'#526f7f'],[2,5,12,1,'#708f9b']);if(i===2||i===3)p.push([11,17,4,5,'#5f665a'],[12,18,2,3,'#d8e3c5']);}
  return p;
}
export function Avatar({ index, size = 44, caseId = 'finance' }: { index: number; size?: number; caseId?: string }) {
  return <span className="fde-avatar" style={{ width: size, height: size, background: `${palette[index % 7]}21` }}><svg viewBox="0 0 24 28" aria-hidden="true" shapeRendering="crispEdges">{characterPixels(index,caseId).map(([x,y,w,h,c],n)=><rect key={n} x={x+4} y={y+2} width={w} height={h} fill={c}/>)}</svg></span>;
}
