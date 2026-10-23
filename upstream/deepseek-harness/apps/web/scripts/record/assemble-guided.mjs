/** 合并三段字幕确认素材，裁掉第三段重复入口，并导出对应 SRT 与章节。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

const sources = process.argv.slice(2).map(path => resolve(path));
if (sources.length !== 3 || sources.some(path => !path.endsWith('.mp4'))) throw new Error('按顺序提供历史、业务操作、交付记录三段 MP4');
const out = resolve('artifacts/recordings/fde-workbench-store-triage-guided');
const probe = path => JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration,size','-of','json',path], {encoding:'utf8'})).format;
const timelines = sources.map(path => JSON.parse(readFileSync(path.replace(/\.mp4$/, '-captions.json'), 'utf8')).subtitles);
const stageFive = timelines[2].find(c => c.text.startsWith('阶段五：'));
if (!stageFive) throw new Error('缺少第五阶段时间锚点，拒绝猜测剪辑位置');
const cuts = [0, 0, Math.max(0, stageFive.startT - 0.4)];
const durations = sources.map((path, i) => Number(probe(path).duration) - cuts[i]);
let offset = 0;
const captions = timelines.flatMap((list, i) => {
  const shifted = list.filter(c => c.endT > cuts[i]).map(c => ({...c, startT:offset + Math.max(0, c.startT-cuts[i]), endT:offset + Math.min(durations[i], c.endT-cuts[i])}));
  offset += durations[i];
  return shifted;
});
const time = value => {
  const ms = Math.round(value*1000);
  return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
};
writeFileSync(out+'.srt', captions.map((c,i) => `${i+1}\n${time(c.startT)} --> ${time(c.endT)}\n${c.text}\n`).join('\n'));
const chapters = [{start:0,title:'进入平台与选择项目'}];
for (const c of captions) {
  if (/^阶段[一二三四五六七八]：/.test(c.text)) chapters.push({start:c.startT,title:c.text});
  if (c.text === '门店维修应用 · 本地操作') chapters.push({start:durations[0],title:'业务应用：报修分析与本地草稿'});
  if (c.text.startsWith('切到系统架构')) chapters.push({start:c.startT,title:'系统架构与使用路径'});
}
chapters.sort((a,b) => a.start-b.start);
const metadata = [';FFMETADATA1','title=FF - FDE 交付工作台｜门店设备故障分诊操作演示','comment=紧凑字幕修改版。历史对话回看与脱敏示例；本地规则分析及草稿保存，无模型调用、无生产派单；后四阶段含联调示例，不代表生产批准。',...chapters.map((c,i) => `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.floor(c.start*1000)}\nEND=${Math.floor((chapters[i+1]?.start ?? offset)*1000)}\ntitle=${c.title}`)].join('\n')+'\n';
writeFileSync(out+'.ffmetadata',metadata);
writeFileSync(out+'-edit.json',JSON.stringify({sources:sources.map(path=>basename(path)),cuts,durations,totalDuration:offset,subtitles:captions,chapters},null,2)+'\n');
const filters = sources.map((_,i) => `[${i}:v]trim=start=${cuts[i]},setpts=PTS-STARTPTS[v${i}]`).join(';')+';[v0][v1][v2]concat=n=3:v=1:a=0[out]';
execFileSync('ffmpeg',['-y','-v','warning',...sources.flatMap(path=>['-i',path]),'-i',out+'.ffmetadata','-filter_complex',filters,'-map','[out]','-map_metadata','3','-map_chapters','3','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','30','-an','-movflags','+faststart',out+'.mp4'],{stdio:'inherit'});
console.log(JSON.stringify({video:out+'.mp4',srt:out+'.srt',captions:captions.length,chapters:chapters.length,trimmedRepeatEntry:cuts[2],...probe(out+'.mp4')},null,2));
