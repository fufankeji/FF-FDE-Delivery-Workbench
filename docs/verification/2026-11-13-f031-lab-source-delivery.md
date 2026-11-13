# F031 · 实验室完整源码交付验证

2026-11-13 用户明确要求将缺失的运行素材纳入代码、提交现有 GitHub，并交付桌面新版源码 ZIP。此前源码的 `.assets` 被 Git 与学员包排除，新安装会返回素材未安装的 503；本机已有素材不能作为新用户可用性的证据。

## 实现与内容边界

`packages/fde/discovery-lab/assets/` 成为受版本管理的固定素材源，包含原运行白名单的 248 文件、36,654,779 字节、5 案例、234 份引用资料及固定计算脚本、字体和许可。逐文件清单为 `assets-manifest.json`；源码校验命令、完整构建、Host 初始化与学员包检查共用同一检查逻辑。案例引用也必须进入清单，不能仅检查 finance 的一个文件。

素材初始化失败仍返回真实 503 和“重新获取完整源码、构建后重启”的恢复信息；训练数据库错误没有被素材检查吞掉。没有移除认证、改角色授权、发起模型请求或复制 DSH_HOME。用户授权仅覆盖此运行白名单，不包含原 ZIP 的教师材料、未来事件、个人历史和凭据，原第三方与字体许可保留。

本机旧桌面进程仍使用原 `.assets` 路径，因此暂时保留这份约 36 MiB 的旧缓存；它被 Git 与打包器排除，不再是源码事实源。旧实例退出、新实例使用 assets 后，且确认与固定清单相同，即可安全删除旧缓存。新资源目录不是可删构建缓存。

## 已完成的技术检查

| 检查 | 结果 | 证据 |
|---|---|---|
| PRD、Product Spec、F031 规格校验 | 通过，用户指令确认新的完整交付合同 | 相应 Skill 校验器 |
| `node packages/fde/discovery-lab/scripts/verify-assets.mjs` | 5 案例、234 份资料、248 文件完整，未调用模型 | 素材清单及命令输出 |
| `vitest run .../assets.spec.ts .../loader-composition.spec.ts` | 7 项通过：完整、缺失、损坏、漏清单、角色权限与恢复 | `.runtime/f031-lab-tests.log` |
| `node --test .../five_cases.test.mjs .../calculations-and-export.test.mjs` | 7 项通过，使用真实固定 Python 计算和 PDF 导出路径 | `.runtime/f031-calculations-tests.log` |
| `corepack pnpm run build --serial` | 11/11 通过，422 份 Client 产物登记 | `.runtime/f031-build.log` |
| 发布就绪扫描 | 无凭据、敏感文件或超限文件 blocker；只有默认排除 docs 的规则提示，按用户既有明确要求与仓库合同保留 docs | `.runtime/f031-publish-check.json` |
| 通用打包器 dry-run | 因既有 `CLAUDE.md` 内部符号链接拒绝；使用本项目原打包器的受控链接物化，不放宽路径或秘密检查 | `.runtime/f031-generic-package-dry-run.log` |

## 发布与独立验包

当前等待冻结源码提交后执行项目打包器 dry-run、最终 ZIP 构建、独立解压安装/构建和五案例 API 验收。尚未将候选状态宣称为可发放。最终记录将补充提交、远端核验、ZIP 大小、独立运行结果及临时目录清理。

前一轮 F030 的完整交互与真实模型调用仍未做全量验收；原上游全组合源码测试第三方导入限制见 [F030 记录](2026-11-12-harness-022-compatibility.md)。本次不为这一素材问题重跑或修复无关全量 UI 测试。
