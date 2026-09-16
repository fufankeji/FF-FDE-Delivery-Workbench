# Agent Note: 独立业务挖掘实验室

Status: implemented

[English](2026-09-16-independent-discovery-lab.md) | 中文

## Problem

用户提供的训练产品包含五案例完整旅程、像素办公室、岗位工具、证据核对和报告。工作台已有项目阶段必须仍可独立使用。原插件面向更新的 Harness，其 UI 和 Session API 与当前固定基座不同。

## Decision

全屏首页和项目中心会遮住侧栏，因此由页面归属插件声明 `fde.workbench.module.action`，实验室向其中注册可见入口，同时保留侧栏入口。所有入口共享实验室自身 Store，不依赖项目控制器，返回后恢复下方原页面。

[Host 插件](../../../../packages/fde/discovery-lab/README.zh.md) 负责训练接口、SQLite 和自身原生 Agent。[Client 插件](../../../../packages/client/ui-fde-discovery-lab/README.zh.md) 新增导航，并在同源 iframe 中挂载独立构建的原应用。训练不登记项目 Workspace、不写阶段决定。集成只适配原生事件快照、单 Session 持久化刷新、空会话延迟写入恢复与插件退出，不修改 Agent Loop。

仅将固定运行包的授权资料导入被忽略、可重建的素材目录。可变训练数据保存在显式 `DSH_HOME`，原生日志仍由 Host 负责。训练作用域排除全局工作区工具和工作区合成指令。仅打开或恢复训练不调用模型。

## Alternatives considered

**把案例作为项目阶段中的静态资料** 会失去访谈、发放和报告体验，也把训练与真实交付决定混在一起。

**将 Harness 升级到原交付使用的新版本** 会使回归范围超出独立模块的授权边界。

**按当前 Slots 重写原应用** 会改变原界面和渲染行为。外壳使用现有 Slots，iframe 保留原应用。

**启动原交付的独立 LAN Host 或代理** 会重复运行时和持久化职责；当前 Host 已能提供需要的同源接口。

## Consequences

已有入口和状态保留，原桌面布局与独立视觉风格继续存在。同一 Host 每案例共享一个当前轮次，没有项目回流或账号隔离。素材不进入 Git，须从授权交付包导入。真实 Loader、原生工具拒绝、持久化恢复、计算和导航有离线测试；脚本化模型回答不等同于真实模型质量或人工视觉验收。
