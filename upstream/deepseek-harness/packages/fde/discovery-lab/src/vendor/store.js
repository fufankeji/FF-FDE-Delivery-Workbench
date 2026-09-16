import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export const uid = prefix => `${prefix}-${randomUUID()}`;
export const now = () => new Date().toISOString();

/** SQLite contains domain state and native-log references, never a second chat log. */
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS cases (id TEXT, version TEXT, definition TEXT NOT NULL, PRIMARY KEY(id, version));
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, version TEXT NOT NULL, generation INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS active_case ON runs(case_id) WHERE status != 'archived';
      CREATE TABLE IF NOT EXISTS role_sessions (run_id TEXT, role_id TEXT, session_id TEXT UNIQUE NOT NULL, opened INTEGER NOT NULL DEFAULT 0, eval_status TEXT NOT NULL DEFAULT 'idle', eval_error TEXT, PRIMARY KEY(run_id, role_id));
      CREATE TABLE IF NOT EXISTS requests (run_id TEXT, id TEXT, role_id TEXT NOT NULL, message_id TEXT, status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL, PRIMARY KEY(run_id, id));
      CREATE UNIQUE INDEX IF NOT EXISTS role_busy ON requests(run_id,role_id) WHERE status IN ('accepted','running');
      CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, role_id TEXT NOT NULL, session_id TEXT, seq INTEGER, message_id TEXT, asset_id TEXT, kind TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(run_id,session_id,seq,kind));
      CREATE TABLE IF NOT EXISTS grants (run_id TEXT, asset_id TEXT, role_id TEXT NOT NULL, session_id TEXT NOT NULL, seq INTEGER NOT NULL, message_id TEXT NOT NULL, granted_at TEXT NOT NULL, collected INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(run_id,asset_id));
      CREATE TABLE IF NOT EXISTS asset_views (run_id TEXT, asset_id TEXT, viewed_at TEXT NOT NULL, PRIMARY KEY(run_id,asset_id));
      CREATE TABLE IF NOT EXISTS run_upgrades (old_run_id TEXT PRIMARY KEY, new_run_id TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS discovery (run_id TEXT, item_id TEXT, status TEXT NOT NULL, evidence_refs TEXT NOT NULL, explanation TEXT NOT NULL, evaluator_version TEXT NOT NULL, PRIMARY KEY(run_id,item_id));
      CREATE TABLE IF NOT EXISTS analyses (run_id TEXT, metric_id TEXT, result TEXT NOT NULL, PRIMARY KEY(run_id,metric_id));
      CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, snapshot TEXT NOT NULL, markdown TEXT, error TEXT, session_id TEXT, created_at TEXT NOT NULL, UNIQUE(run_id,version));
    `);
  }
  get(sql, ...args) { return this.db.prepare(sql).get(...args); }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  exec(sql, ...args) { return this.db.prepare(sql).run(...args); }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try {const result=fn();this.db.exec('COMMIT');return result;} catch(error){this.db.exec('ROLLBACK');throw error;} }
  run(id) { const run=this.get('SELECT * FROM runs WHERE id=?',id); if(!run)throw Object.assign(new Error('训练轮次不存在'),{status:404}); return run; }
  live(id,generation) { const run=this.run(id); return run.status!=='archived' && (generation===undefined || run.generation===generation); }
  touch(id) {this.exec('UPDATE runs SET updated_at=? WHERE id=?',now(),id);}
  close(){this.db.close();}
}
