/** Interpret recorded origin without inferring truth from file validity. */

/**
 * Identify explicitly synthetic or malformed provenance.
 * @param value - Optional provenance on a stage, run or result.
 * @returns A blocker when origin excludes real delivery; absence does not certify truth.
 */
export function evidenceProvenanceBlocker(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return '数据来源标记无效，需核对原始证据。'
  const kind = (value as Record<string, unknown>).kind
  if (kind === 'observed' || kind === 'human-attested') return undefined
  if (typeof kind === 'string' && /fixture|demo|synthetic|simulat|example|mock/i.test(kind)) return '当前记录含联调或模拟输入，不能作为真实交付通过证据；请补充实际运行或人工核对记录。'
  return '数据来源性质尚未明确，需核对原始证据；来源标签本身不证明事实真实。'
}
