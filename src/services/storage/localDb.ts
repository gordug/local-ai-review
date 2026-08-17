import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AppSettings, CachedPRReview, CachedBranchCompare, CachedIssueSpec, StoredChatSession, RepoRule } from '../../types/storage';
import { AIProviderConfig } from '../../types/ai';

interface RevFlowDB extends DBSchema {
  settings: {
    key: string;
    value: any;
  };
  reviews: {
    key: string;
    value: CachedPRReview;
    indexes: { 'by-repo': string };
  };
  branchCompares: {
    key: string;
    value: CachedBranchCompare;
    indexes: { 'by-repo': string };
  };
  issueSpecs: {
    key: string;
    value: CachedIssueSpec;
    indexes: { 'by-repo': string };
  };
  chats: {
    key: string;
    value: StoredChatSession;
    indexes: { 'by-repo': string };
  };
  repoRules: {
    key: string;
    value: RepoRule;
    indexes: { 'by-repo': string };
  };
}

const DB_NAME = 'revflow-local-storage';
const DB_VERSION = 1;

export const DEFAULT_PROVIDERS: Record<string, AIProviderConfig> = {
  deterministic: {
    provider: 'deterministic',
    enabled: true,
    model: 'Zero-Compute Static Analyzer',
  },
  ollama: {
    provider: 'ollama',
    enabled: false,
    endpoint: 'http://127.0.0.1:11434',
    model: 'qwen2.5-coder:7b',
    temperature: 0.2,
  },
  lmstudio: {
    provider: 'lmstudio',
    enabled: false,
    endpoint: 'http://127.0.0.1:1234/v1',
    model: 'default',
    temperature: 0.2,
  },
  gemini: {
    provider: 'gemini',
    enabled: false,
    apiKey: '',
    model: 'gemini-2.5-flash',
    temperature: 0.2,
  },
  openai: {
    provider: 'openai',
    enabled: false,
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.2,
  },
  anthropic: {
    provider: 'anthropic',
    enabled: false,
    apiKey: '',
    model: 'claude-3-5-sonnet-latest',
    temperature: 0.2,
  },
  groq: {
    provider: 'groq',
    enabled: false,
    apiKey: '',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
  },
  deepseek: {
    provider: 'deepseek',
    enabled: false,
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.2,
  },
  openrouter: {
    provider: 'openrouter',
    enabled: false,
    apiKey: '',
    model: 'anthropic/claude-3.5-sonnet',
    temperature: 0.2,
  },
  custom: {
    provider: 'custom',
    enabled: false,
    endpoint: 'http://127.0.0.1:8000/v1',
    apiKey: '',
    model: 'default',
    temperature: 0.2,
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  githubToken: '',
  githubOAuthClientId: '',
  theme: 'dark',
  activeProvider: 'deterministic',
  providers: DEFAULT_PROVIDERS,
  activeRepo: 'facebook/react',
  customGuidelines: 'Prioritize security, catch null/undefined hazards, suggest concrete TypeScript types, avoid boilerplate, keep review comments friendly and actionable.',
  autoAnalyzePRs: false,
  diffViewMode: 'split',
  syntaxTheme: 'dracula',
};

class LocalDatabaseService {
  private dbPromise: Promise<IDBPDatabase<RevFlowDB>> | null = null;

  private async getDB(): Promise<IDBPDatabase<RevFlowDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<RevFlowDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
          if (!db.objectStoreNames.contains('reviews')) {
            const reviewStore = db.createObjectStore('reviews', { keyPath: 'id' });
            reviewStore.createIndex('by-repo', 'repoFullName');
          }
          if (!db.objectStoreNames.contains('branchCompares')) {
            const branchStore = db.createObjectStore('branchCompares', { keyPath: 'id' });
            branchStore.createIndex('by-repo', 'repoFullName');
          }
          if (!db.objectStoreNames.contains('issueSpecs')) {
            const issueStore = db.createObjectStore('issueSpecs', { keyPath: 'id' });
            issueStore.createIndex('by-repo', 'repoFullName');
          }
          if (!db.objectStoreNames.contains('chats')) {
            const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
            chatStore.createIndex('by-repo', 'repoFullName');
          }
          if (!db.objectStoreNames.contains('repoRules')) {
            const ruleStore = db.createObjectStore('repoRules', { keyPath: 'id' });
            ruleStore.createIndex('by-repo', 'repoFullName');
          }
        },
      });
    }
    return this.dbPromise;
  }

  // --- Settings ---
  async getSettings(): Promise<AppSettings> {
    try {
      const db = await this.getDB();
      const saved = await db.get('settings', 'app-settings');
      if (saved) {
        return {
          ...DEFAULT_SETTINGS,
          ...saved,
          providers: {
            ...DEFAULT_PROVIDERS,
            ...(saved.providers || {}),
          },
        };
      }
    } catch (e) {
      console.warn('Failed to load settings from IndexedDB, falling back to defaults', e);
    }
    return DEFAULT_SETTINGS;
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...settings,
      providers: {
        ...current.providers,
        ...(settings.providers || {}),
      },
    };
    const db = await this.getDB();
    await db.put('settings', updated, 'app-settings');
    return updated;
  }

  // --- PR Reviews ---
  async savePRReview(review: CachedPRReview): Promise<void> {
    const db = await this.getDB();
    await db.put('reviews', review);
  }

  async getPRReview(id: string): Promise<CachedPRReview | undefined> {
    const db = await this.getDB();
    return db.get('reviews', id);
  }

  async getReviewsForRepo(repoFullName: string): Promise<CachedPRReview[]> {
    const db = await this.getDB();
    return db.getAllFromIndex('reviews', 'by-repo', repoFullName);
  }

  // --- Branch Compare ---
  async saveBranchCompare(compare: CachedBranchCompare): Promise<void> {
    const db = await this.getDB();
    await db.put('branchCompares', compare);
  }

  async getBranchCompare(id: string): Promise<CachedBranchCompare | undefined> {
    const db = await this.getDB();
    return db.get('branchCompares', id);
  }

  // --- Issue Specs ---
  async saveIssueSpec(spec: CachedIssueSpec): Promise<void> {
    const db = await this.getDB();
    await db.put('issueSpecs', spec);
  }

  async getIssueSpec(id: string): Promise<CachedIssueSpec | undefined> {
    const db = await this.getDB();
    return db.get('issueSpecs', id);
  }

  // --- Chat Sessions ---
  async saveChatSession(session: StoredChatSession): Promise<void> {
    const db = await this.getDB();
    await db.put('chats', session);
  }

  async getChatSession(id: string): Promise<StoredChatSession | undefined> {
    const db = await this.getDB();
    return db.get('chats', id);
  }

  // --- Repo Rules ---
  async saveRepoRule(rule: RepoRule): Promise<void> {
    const db = await this.getDB();
    await db.put('repoRules', rule);
  }

  async getRepoRules(repoFullName: string): Promise<RepoRule[]> {
    const db = await this.getDB();
    return db.getAllFromIndex('repoRules', 'by-repo', repoFullName);
  }

  // --- Backup & Restore ---
  async exportFullBackup(): Promise<string> {
    const db = await this.getDB();
    const settings = await db.get('settings', 'app-settings');
    const reviews = await db.getAll('reviews');
    const branchCompares = await db.getAll('branchCompares');
    const issueSpecs = await db.getAll('issueSpecs');
    const chats = await db.getAll('chats');
    const repoRules = await db.getAll('repoRules');

    const backup = {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        settings,
        reviews,
        branchCompares,
        issueSpecs,
        chats,
        repoRules,
      },
    };
    return JSON.stringify(backup, null, 2);
  }

  async importFullBackup(jsonString: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.data) throw new Error('Invalid backup schema');

      const db = await this.getDB();
      const tx = db.transaction(['settings', 'reviews', 'branchCompares', 'issueSpecs', 'chats', 'repoRules'], 'readwrite');

      if (parsed.data.settings) {
        await tx.objectStore('settings').put(parsed.data.settings, 'app-settings');
      }

      for (const review of parsed.data.reviews || []) {
        await tx.objectStore('reviews').put(review);
      }
      for (const comp of parsed.data.branchCompares || []) {
        await tx.objectStore('branchCompares').put(comp);
      }
      for (const spec of parsed.data.issueSpecs || []) {
        await tx.objectStore('issueSpecs').put(spec);
      }
      for (const chat of parsed.data.chats || []) {
        await tx.objectStore('chats').put(chat);
      }
      for (const rule of parsed.data.repoRules || []) {
        await tx.objectStore('repoRules').put(rule);
      }

      await tx.done;
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    const stores = ['settings', 'reviews', 'branchCompares', 'issueSpecs', 'chats', 'repoRules'] as const;
    const tx = db.transaction(stores, 'readwrite');
    for (const store of stores) {
      await tx.objectStore(store).clear();
    }
    await tx.done;
  }
}

export const localDb = new LocalDatabaseService();
