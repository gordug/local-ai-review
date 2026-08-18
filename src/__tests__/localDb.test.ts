import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock `idb` before importing localDb so that no real IndexedDB is needed.
// ---------------------------------------------------------------------------

const stores: Record<string, Map<string, unknown>> = {};

function getStore(name: string): Map<string, unknown> {
  if (!stores[name]) stores[name] = new Map();
  return stores[name];
}

const mockDb = {
  get: vi.fn(async (storeName: string, key: string) => getStore(storeName).get(key)),
  put: vi.fn(async (storeName: string, value: unknown, key?: string) => {
    const store = getStore(storeName);
    if (key !== undefined) {
      store.set(key, value);
    } else {
      // keyPath-based stores: value must have an 'id' field
      const record = value as Record<string, unknown>;
      store.set(record.id as string, value);
    }
  }),
  getAll: vi.fn(async (storeName: string) => Array.from(getStore(storeName).values())),
  getAllFromIndex: vi.fn(async (storeName: string, _index: string, query: string) => {
    return Array.from(getStore(storeName).values()).filter(
      (v) => (v as Record<string, unknown>).repoFullName === query
    );
  }),
  transaction: vi.fn((storeNames: string[], _mode: string) => {
    const txStores: Record<string, { put: (v: unknown, k?: string) => Promise<void>; clear: () => Promise<void> }> = {};
    for (const name of storeNames) {
      txStores[name] = {
        put: async (value: unknown, key?: string) => {
          const store = getStore(name);
          if (key !== undefined) {
            store.set(key, value);
          } else {
            const record = value as Record<string, unknown>;
            store.set(record.id as string, value);
          }
        },
        clear: async () => {
          getStore(name).clear();
        },
      };
    }
    return {
      objectStore: (name: string) => txStores[name],
      done: Promise.resolve(),
    };
  }),
};

vi.mock('idb', () => ({
  openDB: vi.fn(async () => mockDb),
}));

// Import after mocking
import { LocalDatabaseService } from '../internal/localDb';
import { DEFAULT_SETTINGS } from '../services/storage/localDb';
import type { CachedPRReview, CachedBranchCompare, CachedIssueSpec } from '../types/storage';
import type { AIReviewReport, BranchMergeAnalysis, IssueTechnicalSpec } from '../types/ai';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReview(id: string): CachedPRReview {
  return {
    id,
    repoFullName: 'test/repo',
    prNumber: 1,
    commitSha: 'abc123',
    savedAt: Date.now(),
    report: {
      id,
      prNumber: 1,
      repoFullName: 'test/repo',
      timestamp: Date.now(),
      provider: 'deterministic',
      model: 'static',
      executiveSummary: 'Test summary',
      overallRisk: 'low',
      confidenceScore: 90,
      architectureSummary: 'Clean',
      findings: [],
      lineComments: [],
      suggestedTests: [],
      suggestedPatches: [],
      keyStrengths: [],
      mergeReadinessScore: 85,
      isDeterministicFallback: false,
    } as AIReviewReport,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LocalDatabaseService – settings', () => {
  let db: LocalDatabaseService;

  beforeEach(() => {
    // Clear all stores and create a fresh service instance
    for (const key of Object.keys(stores)) delete stores[key];
    db = new LocalDatabaseService();
  });

  it('returns DEFAULT_SETTINGS when nothing has been saved', async () => {
    const settings = await db.getSettings();
    expect(settings.activeProvider).toBe(DEFAULT_SETTINGS.activeProvider);
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('persists and retrieves settings changes', async () => {
    await db.saveSettings({ theme: 'light', activeProvider: 'ollama' });
    const settings = await db.getSettings();
    expect(settings.theme).toBe('light');
    expect(settings.activeProvider).toBe('ollama');
  });
});

describe('LocalDatabaseService – backup & restore round-trip', () => {
  let db: LocalDatabaseService;

  beforeEach(() => {
    for (const key of Object.keys(stores)) delete stores[key];
    db = new LocalDatabaseService();
  });

  it('exports valid JSON with the expected top-level schema', async () => {
    const json = await db.exportFullBackup();
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty('version');
    expect(parsed).toHaveProperty('exportedAt');
    expect(parsed).toHaveProperty('data');
    expect(parsed.data).toHaveProperty('reviews');
    expect(parsed.data).toHaveProperty('branchCompares');
    expect(parsed.data).toHaveProperty('issueSpecs');
    expect(parsed.data).toHaveProperty('chats');
    expect(parsed.data).toHaveProperty('repoRules');
  });

  it('restores data written before export and retrieves it after import', async () => {
    const review = makeReview('rev-test/repo-1-ts-01');

    await db.savePRReview(review);

    const backupJson = await db.exportFullBackup();

    // Wipe and re-import
    await db.clearAllData();
    const success = await db.importFullBackup(backupJson);
    expect(success).toBe(true);

    const restored = await db.getPRReview(review.id);
    expect(restored).toBeDefined();
    expect(restored!.id).toBe(review.id);
    expect(restored!.prNumber).toBe(1);
  });

  it('returns false and does not throw when given invalid JSON', async () => {
    const result = await db.importFullBackup('this is not json');
    expect(result).toBe(false);
  });

  it('returns false when backup JSON is missing the data key', async () => {
    const result = await db.importFullBackup(JSON.stringify({ version: 1 }));
    expect(result).toBe(false);
  });

  it('correctly restores settings during a round-trip', async () => {
    await db.saveSettings({ theme: 'light', activeRepo: 'facebook/react' });

    const backupJson = await db.exportFullBackup();
    await db.clearAllData();
    await db.importFullBackup(backupJson);

    const settings = await db.getSettings();
    expect(settings.theme).toBe('light');
    expect(settings.activeRepo).toBe('facebook/react');
  });
});

describe('LocalDatabaseService – PR reviews CRUD', () => {
  let db: LocalDatabaseService;

  beforeEach(() => {
    for (const key of Object.keys(stores)) delete stores[key];
    db = new LocalDatabaseService();
  });

  it('saves and retrieves a PR review by id', async () => {
    const review = makeReview('rev-id-001');
    await db.savePRReview(review);
    const found = await db.getPRReview('rev-id-001');
    expect(found).toBeDefined();
    expect(found!.commitSha).toBe('abc123');
  });

  it('returns reviews for a specific repo', async () => {
    await db.savePRReview(makeReview('rev-test/repo-1'));
    await db.savePRReview(makeReview('rev-test/repo-2'));

    const reviews = await db.getReviewsForRepo('test/repo');
    expect(reviews.length).toBeGreaterThanOrEqual(2);
  });
});
