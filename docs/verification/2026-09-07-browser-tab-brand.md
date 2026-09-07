# 浏览器标签品牌修复

- 浏览器初始 HTML 与运行期默认标题统一为 `FF - FDE 交付工作台`。当前会话名保留在产品名之后，切换、取消选择及卸载沿用既有标题生命周期，构建指定标题仍有效。
- 标签图标和安装清单引用既有 `/ff-brand/ff-logo.png` 原始 PNG；安装名称同步正式产品名。不重绘、不裁切、不改变 Logo 字节，未删除上游旧静态资源。
- `DocumentTitle` 与组装 App 的两份定向测试共 6 项通过；构建产物清单与原图校验 2 项通过（纯文件检查，不启动浏览器）。同步了相关浏览器 smoke 的标题断言，但本轮未运行该自动化。
- renderer TypeScript、bundle、Web Vite build、README 配对检查及本轮 diff whitespace 检查通过。
- 3081 已重启为 PID 84230，显式隔离 `DSH_HOME`；三个 Workspace 均在当前 worktree 隔离区，main 3080 返回 200。
- 在线 HTML 标题及 icon 链接已更新；在线 renderer revision `0640a1aabcd9` 含正式产品名。线上图标 SHA-256 为 `522944bbaee48d98190c8c5a0a0ac80f05b71b1975838807742a782e2aeceedc`，与唯一品牌源一致。
- 未执行浏览器 UI 自动化；用户刷新后确认标签观感。若浏览器保留旧图标，可关闭旧标签并重新打开 3081，不要求清理全站数据。
