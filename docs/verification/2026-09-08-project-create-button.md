# 项目中心“新建项目”按钮样式

- 范围：仅修改项目中心页头按钮的样式，不改变侧栏入口、创建表单或项目数据。
- 调整：使用现有主题色混合为青绿色，图标与文字整体水平、垂直居中；保留悬停、按下和键盘焦点反馈，以及窄屏尺寸规则。
- 构建：在 `upstream/deepseek-harness` 执行 `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle`，退出码 0。
- 行为回归：执行 `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/project-progress-page.client.spec.tsx -t 'shows every real project by default'`，1 项通过，10 项未选择；现有“新建项目”点击仍调用原创建入口。
- 在线资源：3080 首页返回 200；Boot Manifest 指向 `/plugins/@deepseek-ai/dsh-client-ui-fde-project/client.js?rev=b722e2ee0b95`，该资源返回 200 且包含新按钮样式 `--project-create-accent`。沿用原监听进程，无需重启服务。
- 未执行浏览器自动化或截图对比，实际视觉效果待用户刷新后确认。未提交或推送 Git。
