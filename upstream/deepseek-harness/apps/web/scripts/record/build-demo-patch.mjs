import { resolve } from 'node:path';

const app='http://127.0.0.1:3080';
const stages=['发现高价值问题','定义结果、范围与责任','调查数据、系统、接口、安全与组织','设计方案并完成端到端纵向切片','运行 PoC 与 Eval','企业集成、可靠性改造与受控 Pilot','进入生产、推动采用并验收交接','持续改进并沉淀可复用能力'];
const ids=['discovery','definition','investigation','design','evaluation','pilot','production','improvement'];
let position=0;
const caption=text=>({text,position:position++%2?'tr':'bl'});
const scene=(anchor,text,hold=6500,framing='top')=>({action:'scene',anchor,framing,scrollDuration:1200,settleMs:400,subtitle:caption(text),hold});
const click=selector=>[{action:'moveTo',selector,moveMs:550},{action:'click',selector,moveMs:120},{action:'moveTo',x:1120,y:520,moveMs:500}];
const wait=selector=>({action:'waitFor',selector,timeout:25000});
const tab=name=>click(`button[role="tab"]:has-text("${name}")`);
const stage=n=>[...click(`[data-fde-project-context-sidebar] nav button:has-text("${stages[n-1]}")`),...tab('项目工作台'),wait(`[data-stage="${ids[n-1]}"] h1`)];
const chat=(turn,prompt,promptCaption,answerCaption)=>[
  ...tab('对话'),...click(`div:has(> button[aria-label$="跳转到第 ${turn} 轮"])`),
  wait(`[data-chat-turn="${turn}"][data-turn-process-answer]`),
  scene(`[data-chat-turn="${turn}"]:has-text("${prompt}"):visible`,promptCaption,8500),
  scene(`[data-chat-turn="${turn}"][data-turn-process-answer]`,answerCaption,9000),
  {action:'scrollBy',y:300,duration:1400},{action:'wait',ms:4000},...tab('项目工作台'),
];
const preview=(selector,text)=>[
  ...click(selector),wait('[data-dockkit-pane] h1'),
  scene('[data-dockkit-pane] h1',text,8500),
  {action:'scrollBy',y:280,duration:1300},{action:'wait',ms:4000},
  ...click('button[aria-label="关闭"]:visible'),{action:'wait',ms:500},
];
const cold=(title)=>[{action:'navigate',url:'/',settleMs:2500,subtitle:{text:title,position:'mc',theme:'title-card'},subtitleHold:4500}];
const enterHistory=[...click('button:has-text("进入平台")'),wait('button:has-text("项目中心"):not(:has-text("返回"))'),...click('button:has-text("项目中心"):not(:has-text("返回"))'),wait('button:has-text("查看对话")'),...click('button:has-text("查看对话")'),wait('button[role="tab"]:has-text("对话")')];
const common={baseUrl:app,authLaunchLog:'../../../../.runtime/workbench-web.log',viewport:{width:1920,height:1080},speedup:1,subtitleColors:{text:'#ffffff',stroke:'#4036a8',glow:'rgba(90,77,210,0.3)'},zooms:[]};
position=0;
const first={...common,name:'从进入工作台到方案与产物',demonstration:{kind:'feature-overview'},steps:[
 ...cold('FF - FDE 交付工作台'),
 scene('h1:visible','脱敏案例与历史对话回看',6000),
 ...click('button:has-text("进入平台")'),wait('button:has-text("项目中心"):not(:has-text("返回"))'),
 scene('h1:has-text("工作台总览")','项目、实验与方法统一进入',6000),
 ...click('button:has-text("项目中心"):not(:has-text("返回"))'),wait('button:has-text("查看对话")'),
 scene('h1:has-text("项目中心")','在项目中心选择交付项目',6000),
 ...click('button:has-text("查看对话")'),wait('button[role="tab"]:has-text("对话")'),
 ...stage(1),scene('[data-stage-goal]','第一阶段：先还原业务问题',7000),
 ...chat(1,'我刚导入了客户原始简报','提问时明确目标与暂不做的事','回答区分客户说法与待核对事实'),
 scene('[data-evidence-output]','对话结果沉淀为阶段记录',6000),
 ...preview('li[data-evidence-row]:has-text("客户现状记录") button','打开报告核对来源与未知项'),
 ...stage(2),scene('[data-stage="definition"] h1','第二阶段：明确结果与责任',7000),
 ...chat(14,'请从阶段 1 已确认的工作流','要求明确基线、指标与验证者','候选目标不等于生产承诺'),
 ...preview('article:has-text("当前基线记录") button','目标、范围与停止条件写入产物'),
 ...stage(3),scene('[data-investigation-hero]','第三阶段：核实现场条件',7000),
 ...chat(21,'当前处于阶段 3','逐项调查系统、数据与权限','保留证据状态和负责人'),
 scene('[data-investigation-primary-grid]','把系统关系与动作边界分开看',7000),
 scene('[data-investigation-action-row]','能读取不代表有权正式执行',7000),
 ...stage(4),scene('[data-design-stage-hero]','第四阶段：选择最小实现方案',7000),
 ...chat(24,'请读取以下内容','先比较实现方式，不预设技术','依据业务证据选择合适方案'),
 scene('[data-design-route]','方案选择保留理由与不采用项',6500),
 scene('h2:has-text("从最小 Schema 到可查询")','已有图谱支持关系与来源核对',8000),
 scene('[data-design-context]','纵向切片必须留下运行结果',7500),
 scene('[data-design-run-evidence]','执行记录与人工决定分别保留',6500),
]};
position=0;
const evidence={mode:'live-result',evidenceKey:'saved-local-draft',resultDescription:'录制时完成新的报修分析与人工确认，本地服务返回新增草稿',preflight:{status:'verified',notes:'已通过正常页面分析 R-1002、核对候选、提交确认，界面显示已从本地服务读回；externalWrite=false。'},sideEffects:{kind:'local-disposable',notes:'原业务源码与资料只读；createApp 使用 mkdtemp 的独立 stateDir。每次重录停止服务并清理该目录，再启动空状态。'},fixtureDisclosure:'业务输入为用户接受的脱敏样本，规则和既有图谱产生本轮结果；不调用模型、不执行生产派单。'};
const second={...common,baseUrl:'http://127.0.0.1:4177',authLaunchLog:undefined,name:'从报修分析到本地草稿',demonstration:{kind:'journey',mode:evidence.mode,evidenceKey:evidence.evidenceKey,resultDescription:evidence.resultDescription},steps:[
 ...cold('门店分诊 · 业务操作'),wait('[data-action="select"][data-id="R-1002"]'),
 scene('h1','运行已交付的门店维修应用',6000),
 ...click('[data-action="select"][data-id="R-1002"]'),
 scene('.detail-top','选择案例，先保留故障原文',6000),
 scene('.analysis-start','本地规则与图谱，不调用模型',6000),
 {action:'captureState',key:'analysis-result',selector:'.detail-body',read:'text'},
 ...click('[data-action="analyze"]'),{action:'waitForStateChange',key:'analysis-result'},wait('[data-action="confirm"]'),
 scene('.detail-body','生成候选建议，未知项继续保留',7000),
 {action:'scrollBy',y:280,duration:1200},{action:'wait',ms:3500},
 ...click('[data-action="tab"][data-tab="context"]'),
 scene('.detail-body','查看关联与证据，核对建议依据',7000),
 ...click('[data-action="confirm"]'),wait('#draft-form'),
 scene('#draft-form','人工确认后才能保存本地草稿',6000),
 ...click('input[name="operator"]'),{action:'type',selector:'input[name="operator"]',text:'录制核对（示例）',speed:80},
 ...click('textarea[name="note"]'),{action:'type',selector:'textarea[name="note"]',text:'已核对候选与证据；仅保存演示草稿，不执行派单。',speed:50},
 ...click('input[name="confirmed"]'),
 {action:'captureState',key:'saved-local-draft',selector:'.saved-banner',read:'count'},
 ...click('#draft-form button[type="submit"]'),{action:'waitForStateChange',key:'saved-local-draft'},wait('.saved-banner'),
 scene('#sheet','草稿已读回，外部写入未执行',8500),
]};
position=0;
const third={...common,name:'从验证证据到持续改进',demonstration:{kind:'feature-overview'},steps:[
 ...cold('验证、交接与持续改进'),...enterHistory,
 ...stage(5),scene('[data-stage="evaluation"] h1','第五阶段：对照指标检查证据',6500),
 scene('[data-stage="evaluation"] table','历史测试过期时要求重新核对',7000),
 ...preview('button:has-text("验证报告")','打开报告查看结果与验证边界'),
 ...stage(6),scene('[data-stage="pilot"] h1','第六阶段：限定试点范围',6500),
 scene('[data-stage="pilot"] h2:has-text("核对试点授权")','试点示例记录，不代表生产批准',6500),
 scene('[data-stage="pilot"] h2:has-text("查看已保存")','试点范围、运行手册与结果可查',6500),
 ...stage(7),scene('[data-stage="production"] h1','第七阶段：验收与责任移交',6500),
 scene('[data-stage="production"] h2:has-text("交付与验收档案")','示例验收记录不等于客户签收',6500),
 ...stage(8),scene('[data-stage="improvement"] h1','第八阶段：从反馈进入下一轮',6500),
 scene('[data-stage="improvement"] table','逐项关联问题、负责人和处理结论',6500),
 ...preview('button[aria-label="查看改进与验证记录"]','记录改进内容、验证与发布边界'),
 ...tab('系统架构'),wait('svg'),scene('button[role="tab"]:has-text("系统架构")','系统架构与阶段产物持续关联',6500),
 ...tab('项目工作台'),scene('[data-stage="improvement"] h1','资料、对话、证据与决定可追溯',7500),
]};

const featureTitles=['平台进入与项目选择','需求发现与历史对话','业务结果与责任','系统数据与权限调查','方案图谱与纵向切片','报修分析与证据','人工确认与本地草稿','PoC 与 Eval 记录','Pilot 范围与恢复','验收移交记录','持续改进记录','模型设置与新对话','独立实验室与技能中心'];
const features=featureTitles.map((title,i)=>({key:`feat-${String(i+1).padStart(2,'0')}`,title,core:i<11,recordability:i>=11?'ready':i>=7?'mock-visible':'ready',visibleResult:title+'的真实界面与已有记录'}));
const journey={key:'journey-repair-to-local-draft',title:'从门店报修到有依据的人工确认草稿',featureKeys:['feat-06','feat-07'],proves:['本轮分析生成候选、缺口和来源','未经确认不保存；确认后独立读回本地草稿'],selectionRationale:'让观众看到已交付业务系统真正完成一条可复现操作，不把浏览阶段页面当作本轮生成结果。',precondition:'只读既有门店案例与图谱，录制状态目录为空，4177 服务独立本机运行。',setup:['启动 maintenance-preview.mjs，分配独立临时 stateDir'],reset:['停止录制服务；finally 清理专属临时状态目录；重启得到空状态'],feasibility:{status:'verified',dependencies:['本机 4177 业务服务','35 份现有资料与图谱快照'],notes:evidence.preflight.notes},operationEvidence:evidence,recordability:'ready',steps:[{action:'选择 R-1002 并核对原文',visibleFeedback:'应急提示和待分析状态出现'},{action:'点击分析并查看证据',visibleFeedback:'新的分析结果、候选和未知项出现'},{action:'填写操作人与备注并确认',visibleFeedback:'保存后显示已从本地服务读回及 externalWrite=false'}],visibleResult:evidence.resultDescription,moneyShot:{step:3,description:'已保存的本地草稿、操作人、运行编号与未执行外部写入同屏'},clip:{mode:'single',durationTargetSec:110},plainTakeaway:'建议有来源，保存要确认，结果可读回。',boundary:'脱敏样本；本地规则与图谱快照，不是实时模型推理，不执行派单或费用承诺。'};
const standalone=features.filter((_,i)=>i<5||i>=7&&i<11).map(f=>({featureKey:f.key,reason:'按阶段回看既有对话与产物，不声称本轮生成',plainTakeaway:f.title,durationTargetSec:40}));
const journeyMap={schemaVersion:'1.0',project:{name:'FF - FDE 交付工作台'},features,journeys:[journey],standaloneFeatures:standalone,coverage:features.map((f,i)=>({featureKey:f.key,disposition:i===5||i===6?'journey':i<11?'standalone':'excluded',targetKey:i===5||i===6?journey.key:f.key,reason:i>=11?'不属于本次选定的门店项目交付主线；不新增计费调用':i===5||i===6?'进入真实本地操作闭环':'既有案例回看，配合阶段字幕说明'}))};
const recordingMap={project:'FF - FDE 交付工作台',routes:[{path:'/',title:'工作台',purpose:'同一 SPA 中通过项目、阶段与 Tab 导航'},{path:'http://127.0.0.1:4177/',title:'门店维修工作台',purpose:'独立业务应用中的本地闭环'}],features:features.map(f=>({...f,entry:{clickPath:f.key==='feat-06'||f.key==='feat-07'?['[data-action="select"][data-id="R-1002"]','[data-action="analyze"]','[data-action="confirm"]']:['button:has-text("进入平台")','button:has-text("项目中心"):not(:has-text("返回"))','button:has-text("查看对话")']}})),sources:['project Session 6dc88e20，31 轮历史对话','项目 .fde/stages 和 fde-deliverables','项目 backend/server.mjs 与 frontend/app.js'],risk:'后续阶段部分证据过期及人工联调输入如实呈现，不修改为通过。'};
const plan={mode:'full-project',confirmationMode:'standalone-staged',approval:{status:'approved',notes:'用户选择推荐的已有对话回看＋脱敏示例产物＋实际业务操作，并要求关键字幕说明和引导。只批准素版；字幕/放大按后续关卡确认。',visualPolicy:'no-zoom',reviewPolicy:'staged'},visualPolicyStatus:'素版暂不放大；是否放大需用户观看素版后决定',durationTargetSec:450,format:'1920×1080，30fps；中文说明字幕，无配音',journeyMap:'scripts/record/journey-map.json',recordings:[{key:'case-history',kind:'feature-overview',script:'scripts/record/scripts/01-history.json',featureKeys:features.slice(0,5).map(f=>f.key)},{key:'repair-operation',kind:'journey',journeyKey:journey.key,script:'scripts/record/scripts/02-operation.json',featureKeys:journey.featureKeys,operationEvidence:evidence},{key:'delivery-records',kind:'feature-overview',script:'scripts/record/scripts/03-delivery.json',featureKeys:features.slice(7,11).map(f=>f.key)}],preservation:'不提交付费模型，不更改八阶段状态、真实资料或原业务运行数据；新草稿只写临时状态目录。',subtitlePolicy:'关键字幕指出操作、结果与边界；历史对话不是实时生成，示例不代表生产批准。',output:'artifacts/recordings；素材不入 Git；验收后可删除烟雾测试和 QA 帧，保留成片及源剧本。'};
const md=`# 门店项目全流程录制计划\n\n用户已确认已有对话与示例产物的推荐方案，并要求关键字幕说明和引导。采用 showreel-recorder 的 standalone-staged 流程：本轮只录制无字幕素版，下一步确认节奏、放大范围，再录制字幕确认版。\n\n## 叙事与顺序\n\n1. 从产品首页进入总览与项目中心，打开门店项目的历史会话。\n2. 前四阶段依次展示：阶段目标、代表性用户提问、Agent 已有回答、已保存产物。\n3. 使用真实业务应用完成 R-1002 分析、来源核对、人工确认及新草稿读回。\n4. 后四阶段展示版本与测试证据、限定 Pilot、验收与责任移交、运行反馈与改进。\n5. 以系统架构和当前项目工作台结束，突出资料、对话、产物及人工决定的连续关系。\n\n## 数据与副作用\n\n主会话 31 轮，阶段 1/2/3/4 分别选第 1/14/21/24 轮回看；不新增模型调用。第五至八阶段包含已披露的联调记录与过期证据，按实际画面说明，不宣称生产上线或客户签收。业务操作用已有脱敏数据，执行真实本地规则与图谱查询；createApp 使用独立 mkdtemp 状态目录，退出清理，不碰原运行数据。\n\n## 字幕\n\n每章标识阶段与目的；操作前说明怎么做，操作后说明结果和限制。字幕正文在各 JSON 的 scene 中，角落轮换、单条不超过 22 字符。用户明确要求说明和引导，因此内容优先解释操作，不使用夸大宣传句式。\n\n## 验证与清理\n\n专用浏览器使用全新临时 profile，授权令牌只在后台请求、不进入脚本或画面。预演已通过报修分析与草稿保存；录制过程要求 captureState → 提交 → waitForStateChange。保持唯一源码，不创建仓库副本或 worktree。成片与 QA 位于被 Git 忽略的 artifacts/recordings。\n`;
const outputs={'scripts/record/recording-map.json':recordingMap,'scripts/record/journey-map.json':journeyMap,'scripts/record/recording-plan.json':plan,'scripts/record/recording-plan.md':md,'scripts/record/recording-map.md':'# 录制入口与可录性\n\n'+features.map(f=>`- ${f.key}：${f.title}；${f.recordability}`).join('\n')+'\n\n主项目 3080，通过首页、项目中心、阶段与对话轮次导航；业务应用 4177，通过 data-action 选择、分析、确认与保存。完整选择器和等待点以已确认剧本为准。\n','scripts/record/journey-map.md':'# 实际业务操作旅程\n\n'+journey.title+'\n\n'+journey.steps.map((x,i)=>`${i+1}. ${x.action}：${x.visibleFeedback}`).join('\n')+'\n\n'+journey.boundary+'\n','scripts/record/scripts/01-history.json':first,'scripts/record/scripts/02-operation.json':second,'scripts/record/scripts/03-delivery.json':third};
// 用户反馈：缩短无效停顿，字幕说明入口、动作和结果。
const guidance = new Map([
 ['脱敏案例与历史对话回看','脱敏案例：回看已有对话与产物'],
 ['项目、实验与方法统一进入','点击项目中心，选择交付项目'],
 ['在项目中心选择交付项目','点击查看对话，打开门店项目'],
 ['第一阶段：先还原业务问题','阶段一：点击对话，梳理业务现状'],
 ['提问时明确目标与暂不做的事','提问示例：梳理原始简报与业务问题'],
 ['回答区分客户说法与待核对事实','查看回答：区分客户说法与待核对事实'],
 ['对话结果沉淀为阶段记录','返回项目工作台，打开客户现状记录'],
 ['打开报告核对来源与未知项','产物预览：核对现状、来源与未知项'],
 ['第二阶段：明确结果与责任','阶段二：定义结果、范围与责任'],
 ['要求明确基线、指标与验证者','提问示例：要求基线、指标与验证者'],
 ['候选目标不等于生产承诺','查看回答：明确验收目标与责任人'],
 ['目标、范围与停止条件写入产物','打开基线记录，核对目标与停止条件'],
 ['第三阶段：核实现场条件','阶段三：调查数据、系统与权限'],
 ['逐项调查系统、数据与权限','提问示例：逐项调查接口与访问权限'],
 ['保留证据状态和负责人','查看回答：保留证据状态与负责人'],
 ['把系统关系与动作边界分开看','返回项目工作台，查看系统关系'],
 ['能读取不代表有权正式执行','核对动作边界：可读取不等于可执行'],
 ['第四阶段：选择最小实现方案','阶段四：比较方案并完成纵向切片'],
 ['先比较实现方式，不预设技术','提问示例：比较方案，不预设技术'],
 ['依据业务证据选择合适方案','查看回答：依据业务证据选择方案'],
 ['方案选择保留理由与不采用项','返回方案页，查看选择理由与排除项'],
 ['已有图谱支持关系与来源核对','查看已有图谱，核对实体关系与来源'],
 ['纵向切片必须留下运行结果','查看纵向切片：核对端到端运行结果'],
 ['执行记录与人工决定分别保留','运行记录与人工决定分别留存'],
 ['运行已交付的门店维修应用','业务应用：从报修列表选择门店案例'],
 ['选择案例，先保留故障原文','先读故障原文，核对营业与安全影响'],
 ['本地规则与图谱，不调用模型','点击分析这条报修，运行本地规则'],
 ['生成候选建议，未知项继续保留','查看分析结果：候选建议与待确认项'],
 ['查看关联与证据，核对建议依据','关联与证据：核对来源后点击存草稿'],
 ['人工确认后才能保存本地草稿','填写操作人和备注，勾选核对确认'],
 ['草稿已读回，外部写入未执行','保存后读回草稿；未执行正式派单'],
 ['第五阶段：对照指标检查证据','阶段五：对照指标检查验证证据'],
 ['历史测试过期时要求重新核对','证据过期需复核，再打开验证报告'],
 ['打开报告查看结果与验证边界','验证报告：查看测试结果与适用范围'],
 ['第六阶段：限定试点范围','阶段六：核对试点授权与范围'],
 ['试点示例记录，不代表生产批准','联调示例：试点记录不代表生产批准'],
 ['试点范围、运行手册与结果可查','查看试点范围、运行手册与结果'],
 ['第七阶段：验收与责任移交','阶段七：查看验收与责任移交'],
 ['示例验收记录不等于客户签收','查看交付档案；示例不代表客户签收'],
 ['第八阶段：从反馈进入下一轮','阶段八：查看反馈与持续改进'],
 ['逐项关联问题、负责人和处理结论','核对问题、负责人，再打开改进记录'],
 ['记录改进内容、验证与发布边界','改进记录：查看验证结论与发布边界'],
 ['系统架构与阶段产物持续关联','切到系统架构，查看方案整体关系'],
 ['资料、对话、证据与决定可追溯','使用路径：资料、对话、产物、人工审阅'],
]);
for (const [index, script] of [first, second, third].entries()) {
  script.name += ' · 紧凑字幕修改版';
  let corner = 0;
  for (const step of script.steps) {
    if (step.action === 'scene') {
      step.hold = step.hold >= 8000 ? 5000 : step.hold >= 7000 ? 4200 : 3600;
      step.scrollDuration = 900;
      step.settleMs = 300;
    }
    if (step.action === 'wait') step.ms = Math.min(step.ms, 600);
    if (step.action === 'scrollBy') step.duration = 1000;
    if (step.action === 'moveTo') { step.moveMs = 320; step.steps = 16; }
    if (step.action === 'click') { step.moveMs = 80; step.steps = 8; step.preClickMs = 100; }
    if (step.action === 'navigate') { step.settleMs = 1500; step.subtitleHold = 1800; }
    if (step.subtitle) {
      step.subtitle.text = guidance.get(step.subtitle.text) ?? step.subtitle.text;
      if (step.subtitle.position !== 'mc') step.subtitle.position = corner++ % 2 ? 'tr' : 'bl';
    }
  }
  if (index === 0) {
    // 首页只保留开场与点击入口；披露随点击出现，不再额外空等一整幕。
    script.steps.splice(1, 1);
    const entry = script.steps.find(s => s.action === 'moveTo' && s.selector?.includes('进入平台'));
    entry.subtitle = {text:'点击进入平台；本片回看脱敏案例',position:'bl'};
    entry.subtitleHold = 4500;
    for (const step of script.steps) {
      if (step.action === 'scene' && /工作台总览|项目中心/.test(step.anchor)) step.hold = 3000;
    }
  }
  if (index === 1) {
    script.steps[0].subtitle.text = '门店维修应用 · 本地操作';
    // 模型和外部派单边界保持可见，不把规则运行说成模型生成。
    const detail = script.steps.find(s => s.action === 'scene' && s.anchor === '.detail-top');
    detail.subtitle.text = '脱敏案例；本地规则与图谱，不调用模型';
  }
  if (index === 2) script.steps[0].subtitleHold = 800;
  // 按最终出现顺序交替位置（入口提示也计入）。
  corner = 0;
  for (const step of script.steps) if(step.subtitle && step.subtitle.position !== 'mc') step.subtitle.position = corner++ % 2 ? 'tr' : 'bl';
}

let patch='*** Begin Patch\n';
for(const[path,value]of Object.entries(outputs)){if(process.argv.includes('--scripts-only')&&!path.startsWith('scripts/record/scripts/'))continue;const text=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';patch+='*** Add File: '+resolve(path)+'\n'+text.trimEnd().split('\n').map(line=>'+'+line).join('\n')+'\n';}
process.stdout.write(patch+'*** End Patch\n');
