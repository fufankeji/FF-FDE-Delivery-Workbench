import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '/Users/muyu/FDE-Agent/fde-agent/backend/server.mjs';

const stateDir = await mkdtemp(join(tmpdir(), 'fde-video-maintenance-'));
const server = await createApp({root:'/Users/muyu/FDE-Agent/fde-agent', stateDir});
server.listen(4177, '127.0.0.1', () => console.log(JSON.stringify({url:'http://127.0.0.1:4177',stateDir,source:'existing business application',mode:'disposable recording state'})));
let closing=false;
async function close(){
  if(closing)return;closing=true;
  await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  await rm(stateDir,{recursive:true,force:true});
  process.exit(0);
}
process.on('SIGINT',close);
process.on('SIGTERM',close);
