# Agent Note: 完整的项目创建目录交互

Status: implemented

[English](2026-09-18-project-creation-picker.md) | 中文

## 问题

FDE Web profile 固定了 browse Host backend，却遗漏其 Client surface。项目中心发出创建请求，而 WorkspaceBrowser 只有在界面存在时才注册接收器，因此组合缺失时没有可见反馈。自行插入选择器两端的测试掩盖了默认 profile 的缺陷。

## 决定

Web bundle 声明 browse 两端。Desktop 先禁用继承的两个配置项，再挂载 native 两端，保留唯一目录流 owner。Web preset fixture 使用默认配对，不再用临时 insert 补齐。

WorkspaceBrowser 始终接收项目中心创建请求。已有表单会说明目录界面不可用，禁用创建、位置选择和导入，并阻止写入；能力变化后同一表单恢复，草稿不丢失。侧栏自身不可用的添加控件仍保持隐藏。

## 考虑过的替代方案

**恢复自动选择。** Native 选择不提供 FDE Web 表单所需的子目录创建能力，宿主 OS 对话框也不适合局域网浏览器。

**只插入 Client 配置项。** 它修复 Web 名录，却会让 Desktop 覆盖后出现重复 Client 交互，并保留能力缺失时的静默失败。

**新增创建表单或替换导航架构。** 现有 owner 已管理校验、目录创建、Workspace 注册和元数据；复用它可以补齐行为，不引入第二套流程。

## 影响

全新 Web profile 无须用户补丁。升级时应移除旧临时 insert，避免重复配置项。默认 profile 组合检查覆盖 Web 配对和 Desktop 替换；组件检查覆盖既有创建、能力缺失与恢复；无密钥 preset 冒烟不再自行提供缺失配置。未引入模型调用、鉴权变更或项目数据迁移。
