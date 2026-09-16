/** Public projections only. Hidden role facts and evaluation rubrics never enter this contract. */
export interface Role { id: string; name: string; title: string; intro: string; greeting?: string; color?: string }
export interface CaseIntro { id: string; title: string; industry: string; company: string; summary: string; initialRequest: string; snapshotAt: string; version: string; roles: Role[]; currentRunId?: string; progress?: {completed:number;total:number;percent:number}; runStatus?: Snapshot['status']; investigationFocus?: string[] | string; latestVersion?: string; upgradeAvailable?: boolean; materialScope?: string; simulationNotice?: string }
export type DiscoveryState = 'untouched' | 'needs_deeper' | 'completed' | 'verified_currently_unknown';
export interface DiscoveryItem { id: string; roleId: string; topic: string; status: DiscoveryState; required: boolean; explanation?: string; evidenceRefs: string[]; requiredAssetTitles?: string[]; missingAssetTitles?: string[] }
export interface Evidence { id: string; roleId: string; messageId?: string; assetId?: string; text: string; kind: 'interview' | 'asset' | 'calculation'; createdAt: string }
export interface Asset { id: string; title: string; mimeType: string; size?: number; version: string; roleId: string; messageId?: string; grantedAt: string; description?: string; collected?: boolean }
export interface Message { id: string; role: 'user' | 'assistant'; text: string; createdAt: string; assetIds?: string[]; requestId?: string; evidenceIds?: string[] }
export interface RoleSession { roleId: string; sessionId?: string; status: 'idle' | 'queued' | 'running' | 'error'; messages: Message[]; streamingText?: string; error?: string; activeRequestId?: string; evaluationStatus?: 'idle' | 'pending' | 'error'; evaluationError?: string }
export interface Metric { id: string; title: string; description: string; available: boolean; missingAssetTitles?: string[]; value?: number | string; unit?: string; numerator?: number; denominator?: number; formula?: string; filters?: string; inputAssetIds: string[]; columns?: string[]; version: string; calculatedAt?: string; details?: Record<string, unknown>; inputHashes?: Record<string, string> }
export interface Report { id: string; version: number; status: 'generating' | 'completed' | 'error'; markdown?: string; createdAt: string; error?: string }
export interface Snapshot { runId: string; generation: number; caseId: string; status: 'investigating' | 'ready' | 'reporting' | 'passed' | 'archived'; case: CaseIntro; sessions: RoleSession[]; discovery: DiscoveryItem[]; evidence: Evidence[]; assets: Asset[]; metrics: Metric[]; reports: Report[]; progress: { completed: number; total: number; percent: number }; updatedAt: string }
export interface RunHistory { runId:string; version:string; status:Snapshot['status']; createdAt:string; progress:Snapshot['progress']; reports:Report[] }
export interface Hint { itemId: string; roleId: string; level: 1 | 2; topic: string; text: string }
export interface SendReceipt { requestId: string; status: 'accepted' | 'running' | 'completed' | 'failed' | 'not_found'; error?: string }
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); this.name = 'ApiError'; } }
const base = '/api/fde-discovery-lab';
export async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal, credentials: 'same-origin' });
  const value = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(value?.error?.message || value?.error || value?.message || `请求未完成（HTTP ${res.status}）`, res.status);
  return value as T;
}
const part = encodeURIComponent;
export const api = {
  cases: () => request<CaseIntro[]>('/cases'),
  history: (id:string) => request<RunHistory[]>(`/cases/${part(id)}/history`),
  upgrade: (run:string) => request<Snapshot>(`/runs/${part(run)}/upgrade`, {}),
  start: (id: string) => request<Snapshot>(`/cases/${part(id)}/start`, {}),
  snapshot: (id: string, signal?: AbortSignal) => request<Snapshot>(`/runs/${part(id)}`, undefined, signal),
  select: (run: string, role: string) => request<{ sessionId: string }>(`/runs/${part(run)}/roles/${part(role)}/select`, {}),
  send: (run: string, role: string, requestId: string, text: string) => request<SendReceipt>(`/runs/${part(run)}/roles/${part(role)}/messages`, { requestId, text }),
  receipt: (run: string, requestId: string) => request<SendReceipt>(`/runs/${part(run)}/requests/${part(requestId)}`),
  stop: (run: string, role: string) => request<{ ok: boolean }>(`/runs/${part(run)}/roles/${part(role)}/stop`, {}),
  restart: (run: string) => request<Snapshot>(`/runs/${part(run)}/restart`, {}),
  hints: (run: string, role: string, level: 1 | 2, itemId?: string) => request<Hint[]>(`/runs/${part(run)}/roles/${part(role)}/hints`, { level, itemId }),
  reevaluate: (run: string, role: string) => request<{ ok: boolean }>(`/runs/${part(run)}/roles/${part(role)}/reevaluate`, {}),
  collect: (run: string, asset: string) => request<{ ok: boolean }>(`/runs/${part(run)}/assets/${part(asset)}/collect`, {}),
  calculate: (run: string, metric: string) => request<Metric>(`/runs/${part(run)}/metrics/${part(metric)}/calculate`, {}),
  report: (run: string) => request<{ reportId: string }>(`/runs/${part(run)}/reports`, {}),
  assetUrl: (run: string, asset: string, download = false) => `${base}/runs/${part(run)}/assets/${part(asset)}${download ? '?download=1' : ''}`,
  reportUrl: (run: string, report: string, format: 'md' | 'pdf') => `${base}/runs/${part(run)}/reports/${part(report)}/export?format=${format}`,
};
