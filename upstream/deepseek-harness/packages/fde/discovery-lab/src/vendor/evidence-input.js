import { readFileSync } from 'node:fs';

/** Only expand already acquired evidence, using the same authorization and hash check as downloads. */
export function materialEvidence(service, runId, records) {
  const c = service.caseFor(service.requireLive(runId));
  return records.map(record => {
    if (record.kind !== 'asset') return record;
    const { asset, path } = service.grant(runId, record.asset_id);
    // Binary documents use source-located quotations compiled from that exact
    // asset. Never use the role's interpretation or another file's quotations.
    const raw = (asset.mime.startsWith('text/')||['application/json','application/x-ndjson','application/sql'].includes(asset.mime))
      ? readFileSync(path, 'utf8')
      : [...new Set(c.facts.flatMap(f => f.sources.filter(s => s.assetId === asset.id).map(s => `${s.locator}：${s.quote}`)))].join('\n');
    const excerpt = raw.slice(0,16000);
    return {...record, text:`${record.text}\n原件摘录${raw.length > excerpt.length ? '（已截断，不能据此推断完整数据统计）' : ''}：\n${excerpt}`};
  });
}
