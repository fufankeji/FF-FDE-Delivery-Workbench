---
document: feature-plan
feature: F008
status: ready
updated: "2026-08-26"
---

# F008 · FDE 品牌壳实施计划

## 现有上下文与复用

- 当前实现与入口：官方 Web `apps/web` 构建静态文件；`ui-brand-official` 同时占用 Sidebar/Hero 品牌 Slot；`ui-sidebar` 独立渲染提交短 SHA；`ui-conversation` 的 Hero 标题和 Preview 来自 locale 与 `EmptyHero`。
- 直接复用点：官方 `sidebar.brand.mark`、`sidebar.brand.name`、`conversation.hero.brand.mark` Slot；官方三栏布局、Conversation、Workspace、Preset 与 Composer 保持原样。
- 必须保持的现有行为：新会话、工作区选择、Preset、输入框、发送、折叠侧栏和首次启动流程。
- 必须保持的 Product Spec 合同：PSC-013。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `frontend/public/brand/ff-logo.png` | 唯一 FF Logo 原始资产 | 只读来源，复制原始字节 | AC-F008-001, AC-F008-002 |
| `upstream/deepseek-harness/apps/web/public/ff-brand/ff-logo.png` | 官方 Web 静态资源 | 新增同字节 FF Logo | AC-F008-001, AC-F008-002 |
| `packages/client/ui-brand-official/src/client/index.ts` | 官方品牌 occupant 的注册条件 | 在当前 FDE 发行中始终注册 FF 品牌 occupant，使 Sidebar fallback 及其提交徽标不再出现 | AC-F008-001, AC-F008-002 |
| `packages/client/ui-brand-official/src/client/Brand.tsx` | Sidebar/Hero 品牌 occupant | 渲染统一小圆角 FF Logo 与 `FF-FDE工作台` | AC-F008-001, AC-F008-002 |
| `packages/client/ui-conversation/src/client/locales.ts` | Hero 与 Composer 文案 | Hero 标题改为 `见所未见，成所未成`，Preview 文案置空 | AC-F008-002 |
| `packages/client/ui-conversation/src/client/skeleton/EmptyHero.tsx` | Hero 结构 | Preview 文案为空时不渲染徽标 | AC-F008-002 |
| 相关 Client/Web tests | 品牌和空白页回归 | 更新精确文案、Logo 和行为断言 | AC-F008-001～AC-F008-003 |

## 实现方案

保留官方 Slot 和三栏结构，仅替换现有品牌 occupant 的展示内容，并使该 occupant 在 FDE 发行中始终注册；Sidebar fallback 不再渲染，因此官方名称与提交短 SHA 同时消失，无需修改 Sidebar 壳。Logo 作为 Web 静态资源由同一官方 Host 提供；React 组件只引用稳定绝对路径，不嵌入另一份重绘资产。Hero Preview 通过组件条件渲染消失，不使用 CSS 遮挡。

## 实施顺序

1. 校验并复制唯一 FF Logo 到官方 Web public 目录。
2. 修改品牌注册条件与集中品牌组件，统一两处 Logo 小圆角。
3. 修改 Hero 精确文案与 Preview 条件渲染。
4. 更新受影响测试，执行最窄 Client 检查。
5. 完整构建 Web、重启锁定官方服务并确认页面可访问，随后交由用户人工验收。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 官方 Web public 资源路径 | Logo 404 会直接破坏品牌 | 构建后用 HTTP 验证资源和页面 | Web 构建后 |
| 官方 Snapshot 固定旧文案 | 测试会按预期失败 | 只更新受本 Feature 影响的精确断言 | Client/Web 测试 |
| Hero 无独立标题 Slot | 需要小型上游补丁 | 只改 locale 与空徽标条件，不替换 Conversation | 实现时 |
| 官方服务正在运行旧构建 | 用户浏览器看不到改动 | 构建成功后受控重启同一 3080 服务 | 最终验收前 |

## 回退策略

保留 Git diff 作为唯一改动集合；若构建或验收失败，停止服务并通过反向补丁逐文件恢复本 Feature 改动，不使用破坏性工作区回滚。恢复后重新构建并确认官方基线页面可用。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F008-001 | Sidebar 小圆角 FF Logo、产品名及无 SHA | 聚焦品牌组件测试＋用户人工观察 | 测试结果与人工反馈 |
| AC-F008-002 | Hero 小圆角 FF Logo、标题及无 Preview | 聚焦 Hero 组件测试＋用户人工观察 | 测试结果与人工反馈 |
| AC-F008-003 | 原有空白页关键控件保持 | 成功构建、服务 HTTP 200＋用户人工操作 | 构建/运行结果与人工反馈 |
