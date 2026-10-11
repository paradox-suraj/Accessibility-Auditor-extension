import Dexie, { type EntityTable } from 'dexie';
import type {
  SiteRecord,
  ScanRunRecord,
  PageResultRecord,
  PageStateRecord,
  FindingRecord,
  AiCacheRecord,
  SettingRecord,
} from './types';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export class AuditorDatabase extends Dexie {
  sites!: EntityTable<SiteRecord, 'id'>;
  scanRuns!: EntityTable<ScanRunRecord, 'id'>;
  pageResults!: EntityTable<PageResultRecord, 'id'>;
  pageStates!: EntityTable<PageStateRecord, 'id'>;
  findings!: EntityTable<FindingRecord, 'id'>;
  aiCache!: EntityTable<AiCacheRecord, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;

  constructor() {
    super('AuditorDatabase');
    this.version(1).stores({
      sites: 'id, &url, createdAt',
      scanRuns: 'id, siteId, startedAt, finishedAt, status, isAuthenticated',
      pageResults: 'id, scanRunId, url, score, status',
      pageStates: 'id, pageResultId, label, status, score, createdAt',
      findings: 'id, pageStateId, type, source, ruleId, category, impact, fingerprint, createdAt',
      aiCache: 'id, &hash, createdAt',
      settings: '&key',
    });

    this.version(2).stores({
      scanRuns: 'id, siteId, startedAt, finishedAt, status, isAuthenticated, a11yScore, securityScore',
      findings: 'id, pageStateId, type, source, ruleId, category, impact, confidence, fingerprint, createdAt',
    }).upgrade((tx) => {
      return tx.table('findings').toCollection().modify((f: any) => {
        if (!f.confidence) f.confidence = 'certain';
      });
    });
  }
}

export const db = new AuditorDatabase();
