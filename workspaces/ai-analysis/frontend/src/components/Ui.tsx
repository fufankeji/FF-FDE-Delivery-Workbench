import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle, Sparkles } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-orbit"><Sparkles size={20} /></span>
      <h3>{title}</h3><p>{text}</p>{action}
    </div>
  );
}

export function LoadingState({ label = "正在加载" }: { label?: string }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={18} />{label}</div>;
}

export function ErrorState({ error }: { error: unknown }) {
  return <div className="error-state"><AlertCircle size={18} /><span>{error instanceof Error ? error.message : "出现未知错误"}</span></div>;
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}

export function formatNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(numeric) : String(value ?? "—");
}
