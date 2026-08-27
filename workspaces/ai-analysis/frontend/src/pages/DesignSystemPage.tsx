import { Sparkles } from "lucide-react";

import { AppearanceControls } from "../components/AppearanceControls";
import { PageHeader, StatusPill } from "../components/Ui";

export function DesignSystemPage() {
  return <div className="page appearance-page"><PageHeader eyebrow="APPEARANCE" title="选择你的分析空间" description="切换工作台的视觉背景。你的项目、数据与报告内容不会受到影响。" actions={<StatusPill tone="good"><Sparkles size={13} />即时生效</StatusPill>} />
    <AppearanceControls />
  </div>;
}
