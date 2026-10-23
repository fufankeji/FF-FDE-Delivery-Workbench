# 运行结果演示合同

用于区分“功能概览”和“运行演示”。按钮可以点击、页面可以切换，只能证明入口存在；
主演示视频还必须证明一次操作确实产生了新的可见结果。

## 1. 两类视频

| 类型 | 可以包含什么 | 能否作为完整项目主片 |
| --- | --- | --- |
| `feature-overview` | 导航、切 Tab、展开设置、浏览已有内容 | 否，只能作为补充短片 |
| `journey` / `operation` | 输入或选择 → 触发 → 等待 → 新结果出现或既有状态改变 | 是 |

`full-project` 至少包含一条 `journey`。不能把若干 `feature-overview` 串起来冒充完整项目演示。

## 2. 允许的结果来源

- `live-result`：录制时真实触发当前项目的操作，结果由本次运行生成。
- `fixture-result`：通过产品正常界面加载作者提供、已脱敏的本地演示数据。必须得到用户明确
  接受并在文案中披露“演示数据”；不能表述成当前实时生成。

如果真实结果需要凭证、计费调用、不可逆写入或外部数据修改：

1. 先列出动作、副作用、预计成本和复位方式，取得用户明确授权；
2. 或使用作者确认的脱敏 fixture；
3. 两者都不成立时，将该素材降为 `feature-overview`，并报告主片阻塞。不得用“不提交”
   的点击过程替代运行结果。

## 3. recording-plan 合同

`recordings[]` 的 `kind` 只能是 `journey`、`operation` 或 `feature-overview`。
`journey` / `operation` 必须包含：

```json
{
  "kind": "journey",
  "operationEvidence": {
    "mode": "live-result",
    "evidenceKey": "generated-report",
    "resultDescription": "结果区出现本轮新生成的报告",
    "preflight": {
      "status": "verified",
      "notes": "已用同一测试数据实际触发并复位"
    },
    "sideEffects": {
      "kind": "local-disposable",
      "notes": "创建一条可删除的本地演示记录"
    }
  }
}
```

`sideEffects.kind`：

- `none`
- `local-disposable`
- `external-authorized`

使用 `external-authorized` 时还必须写 `authorizationEvidence`，记录用户授权语义；不得记录密钥。
使用 `fixture-result` 时还必须写 `fixtureDisclosure`。

## 4. 剧本运行证据

剧本顶层写与 plan 一致的 `demonstration`：

```json
{
  "demonstration": {
    "kind": "journey",
    "mode": "live-result",
    "evidenceKey": "generated-report",
    "resultDescription": "结果区出现本轮新生成的报告"
  }
}
```

在触发动作前捕获基线，触发后等待同一状态发生变化：

```json
[
  {
    "action": "captureState",
    "key": "generated-report",
    "selector": "[data-testid='report-card']",
    "read": "count"
  },
  {
    "action": "click",
    "selector": "[data-testid='run-research']"
  },
  {
    "action": "waitForStateChange",
    "key": "generated-report",
    "timeout": 60000
  }
]
```

可读取 `count`、`text`、`value`、`checked`、`attribute` 或 `url`。读取 `attribute` 时同时提供
`attribute` 字段。

普通 `waitFor` 只能证明 selector 此刻可见；如果它在触发前已经存在，不能证明运行结果。
`journey` / `operation` 必须有同 key 的 `captureState → 真实交互 → waitForStateChange`。

生成剧本后运行：

```bash
node scripts/record/validate-recording-contract.mjs \
  --plan scripts/record/recording-plan.json
```

校验不通过不得执行 `record:raw`，也不得把素材称为“完整运行演示”。

## 5. 确认模式

`recording-plan.json` 还必须声明：

```json
{
  "confirmationMode": "pipeline-batched",
  "approval": {
    "status": "approved",
    "notes": "用户已确认旅程、结果来源、副作用、成片范围与视觉处理策略",
    "visualPolicy": "agent-select",
    "reviewPolicy": "self-check-then-final-delivery"
  }
}
```

- `standalone-staged`：用户单独调用录制 Skill；项目可用、计划和素材按阶段确认，
  `reviewPolicy` 必须是 `staged`。
- `pipeline-batched`：由完整项目展示、课程项目预处理或发布流水线调用；先完成只读发现，
  再把旅程、结果来源、成本/副作用、复位、字幕和 `visualPolicy` 合并成一次开工前授权。
  批准后依靠 `record:validate`、慢速预演、抽帧/拼图和视觉审计跑到成品，过程中不重复停下；
  `reviewPolicy` 必须是 `self-check-then-final-delivery`。

`visualPolicy` 只能是 `no-zoom`、`agent-select` 或 `specified`。批量授权没有覆盖新的计费、
凭证、不可逆外部动作或产品范围变化时，仍必须停下取得新增授权。
