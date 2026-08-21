import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIRouter } from '../services/ai/aiRouter';
import { AppSettings } from '../types/storage';
import { ParsedFileDiff } from '../types/github';
import { DEFAULT_SETTINGS, DEFAULT_PROVIDERS } from '../services/storage/localDb';

// ---------------------------------------------------------------------------
// Minimal helpers
// ---------------------------------------------------------------------------

const makeSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

const emptyDiff: ParsedFileDiff[] = [];

// ---------------------------------------------------------------------------
// Mocks for external AI providers
// ---------------------------------------------------------------------------

vi.mock('../services/ai/providers/ollamaProvider', () => ({
  ollamaProvider: {
    generateJSON: vi.fn(),
    chat: vi.fn(),
  },
}));

vi.mock('../services/ai/providers/lmStudioProvider', () => ({
  lmStudioProvider: {
    generateJSON: vi.fn(),
    chat: vi.fn(),
  },
}));

vi.mock('../services/ai/providers/geminiProvider', () => ({
  geminiProvider: {
    generateJSON: vi.fn(),
    chat: vi.fn(),
  },
}));

vi.mock('../services/ai/providers/openaiProvider', () => ({
  openAICompatibleProvider: {
    generateJSON: vi.fn(),
    chat: vi.fn(),
  },
}));

vi.mock('../services/ai/providers/anthropicProvider', () => ({
  anthropicProvider: {
    generateJSON: vi.fn(),
    chat: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AIRouter – reviewPR', () => {
  let router: AIRouter;

  beforeEach(() => {
    router = new AIRouter();
    vi.clearAllMocks();
  });

  it('uses deterministicProvider when activeProvider is "deterministic"', async () => {
    const settings = makeSettings({ activeProvider: 'deterministic' });
    const report = await router.reviewPR(settings, 'owner/repo', 1, 'Test PR', null, emptyDiff);

    expect(report.isDeterministicFallback).toBe(true);
    expect(report.provider).toBe('deterministic');
  });

  it('uses deterministicProvider when the active provider config is missing', async () => {
    const settings = makeSettings({ activeProvider: 'nonexistent' });
    const report = await router.reviewPR(settings, 'owner/repo', 2, 'Test PR', null, emptyDiff);

    expect(report.provider).toBe('deterministic');
  });

  it('falls back to deterministicProvider and sets isDeterministicFallback=true when provider throws', async () => {
    const { ollamaProvider } = await import('../services/ai/providers/ollamaProvider');
    (ollamaProvider.generateJSON as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Connection refused'));

    const settings = makeSettings({
      activeProvider: 'ollama',
      providers: {
        ...DEFAULT_PROVIDERS,
        ollama: { ...DEFAULT_PROVIDERS.ollama, enabled: true },
      },
    });

    const report = await router.reviewPR(settings, 'owner/repo', 3, 'Test PR', null, emptyDiff);

    expect(report.isDeterministicFallback).toBe(true);
    expect(report.executiveSummary).toContain('ollama connection failed');
  });

  it('returns a properly shaped report from a successful provider call', async () => {
    const mockJson = {
      executiveSummary: 'Looks good',
      overallRisk: 'low',
      confidenceScore: 95,
      architectureSummary: 'Clean',
      findings: [],
      lineComments: [],
      suggestedTests: [],
      suggestedPatches: [],
      keyStrengths: ['Well structured'],
      mergeReadinessScore: 90,
    };

    const { ollamaProvider } = await import('../services/ai/providers/ollamaProvider');
    (ollamaProvider.generateJSON as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockJson);

    const settings = makeSettings({
      activeProvider: 'ollama',
      providers: {
        ...DEFAULT_PROVIDERS,
        ollama: { ...DEFAULT_PROVIDERS.ollama, enabled: true },
      },
    });

    const report = await router.reviewPR(settings, 'owner/repo', 4, 'Test PR', null, emptyDiff);

    expect(report.isDeterministicFallback).toBe(false);
    expect(report.executiveSummary).toBe('Looks good');
    expect(report.overallRisk).toBe('low');
    expect(report.mergeReadinessScore).toBe(90);
  });
});

describe('AIRouter – compareBranches fallback', () => {
  let router: AIRouter;

  beforeEach(() => {
    router = new AIRouter();
    vi.clearAllMocks();
  });

  it('falls back silently when gemini throws during compareBranches', async () => {
    const { geminiProvider } = await import('../services/ai/providers/geminiProvider');
    (geminiProvider.generateJSON as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Rate limited'));

    const settings = makeSettings({
      activeProvider: 'gemini',
      providers: {
        ...DEFAULT_PROVIDERS,
        gemini: { ...DEFAULT_PROVIDERS.gemini, enabled: true, apiKey: 'fake-key' },
      },
    });

    const analysis = await router.compareBranches(
      settings,
      'owner/repo',
      'main',
      'feature',
      3,
      1,
      [],
      emptyDiff
    );

    // Deterministic fallback does not throw and returns a valid object
    expect(analysis).toHaveProperty('mergeReadiness');
    expect(analysis.repoFullName).toBe('owner/repo');
  });
});

describe('AIRouter – expandIssue fallback', () => {
  let router: AIRouter;

  beforeEach(() => {
    router = new AIRouter();
    vi.clearAllMocks();
  });

  it('falls back to deterministic when anthropic throws during expandIssue', async () => {
    const { anthropicProvider } = await import('../services/ai/providers/anthropicProvider');
    (anthropicProvider.generateJSON as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('API key invalid'));

    const settings = makeSettings({
      activeProvider: 'anthropic',
      providers: {
        ...DEFAULT_PROVIDERS,
        anthropic: { ...DEFAULT_PROVIDERS.anthropic, enabled: true, apiKey: 'bad-key' },
      },
    });

    const spec = await router.expandIssue(settings, 'owner/repo', 99, 'Crash on startup', null);

    expect(spec.issueNumber).toBe(99);
    expect(spec.implementationPlan.length).toBeGreaterThan(0);
  });
});

describe('AIRouter – chat deterministic mode', () => {
  let router: AIRouter;

  beforeEach(() => {
    router = new AIRouter();
    vi.clearAllMocks();
  });

  it('returns a deterministic response string when no provider is configured', async () => {
    const settings = makeSettings({ activeProvider: 'deterministic' });
    const result = await router.chat(settings, [{ id: '1', role: 'user', content: 'Hello', timestamp: 0 }]);

    expect(typeof result).toBe('string');
    expect(result).toContain('Deterministic Local Mode');
  });

  it('returns an error message string when the active provider chat throws', async () => {
    const { geminiProvider } = await import('../services/ai/providers/geminiProvider');
    (geminiProvider.chat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const settings = makeSettings({
      activeProvider: 'gemini',
      providers: {
        ...DEFAULT_PROVIDERS,
        gemini: { ...DEFAULT_PROVIDERS.gemini, enabled: true, apiKey: 'fake' },
      },
    });

    const result = await router.chat(settings, [{ id: '2', role: 'user', content: 'Hello', timestamp: 0 }]);

    expect(result).toContain('AI Chat Error');
    expect(result).toContain('gemini');
  });
});
