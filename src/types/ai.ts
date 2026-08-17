export type AIProviderType = 
  | 'deterministic'
  | 'ollama'
  | 'lmstudio'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'deepseek'
  | 'openrouter'
  | 'custom';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AIProviderConfig {
  provider: AIProviderType;
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  customHeaders?: Record<string, string>;
}

export interface ReviewFinding {
  id: string;
  category: 'security' | 'performance' | 'bug_risk' | 'maintainability' | 'breaking_change' | 'best_practice';
  severity: RiskLevel;
  file?: string;
  line?: number;
  title: string;
  description: string;
  suggestion?: string;
  patch?: string;
}

export interface LineReviewComment {
  id: string;
  file: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  author: 'AI Reviewer' | 'Static Analyzer';
  body: string;
  severity: RiskLevel;
  category: 'security' | 'performance' | 'bug_risk' | 'style' | 'logic';
  suggestedCode?: string;
}

export interface AIReviewReport {
  id: string;
  prNumber?: number;
  repoFullName: string;
  commitSha?: string;
  timestamp: number;
  provider: AIProviderType;
  model: string;
  executiveSummary: string;
  overallRisk: RiskLevel;
  confidenceScore: number; // 0 - 100
  architectureSummary: string;
  findings: ReviewFinding[];
  lineComments: LineReviewComment[];
  suggestedTests: string[];
  suggestedPatches: Array<{
    file: string;
    description: string;
    patch: string;
  }>;
  keyStrengths: string[];
  mergeReadinessScore: number; // 0 - 100
  isDeterministicFallback?: boolean;
}

export interface BranchMergeAnalysis {
  id: string;
  baseBranch: string;
  compareBranch: string;
  repoFullName: string;
  timestamp: number;
  provider: AIProviderType;
  model: string;
  aheadBy: number;
  behindBy: number;
  mergeReadiness: 'ready' | 'caution' | 'high_risk' | 'blocked';
  readinessScore: number; // 0 - 100
  executiveSummary: string;
  conflictRisks: Array<{
    file: string;
    riskLevel: RiskLevel;
    reason: string;
    recommendation: string;
  }>;
  breakingChanges: Array<{
    type: 'api' | 'schema' | 'config' | 'dependency';
    description: string;
    affectedFiles: string[];
  }>;
  recommendedSteps: string[];
}

export interface IssueTechnicalSpec {
  id: string;
  issueNumber: number;
  issueTitle: string;
  repoFullName: string;
  timestamp: number;
  provider: AIProviderType;
  model: string;
  executiveSummary: string;
  rootCauseHypothesis: string;
  affectedComponents: string[];
  suspectedFiles: string[];
  implementationPlan: Array<{
    step: number;
    title: string;
    description: string;
    completed?: boolean;
  }>;
  acceptanceCriteria: string[];
  suggestedCodeSolution?: string;
  suggestedTestCases: string[];
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  contextType?: 'pr' | 'branch_compare' | 'issue' | 'general';
  contextId?: string | number;
  codeSnippets?: Array<{
    language: string;
    code: string;
    filename?: string;
  }>;
}

export interface QuickPrompt {
  id: string;
  title: string;
  iconName: string;
  prompt: string;
  category: 'security' | 'tests' | 'explain' | 'refactor' | 'comment' | 'breaking';
}
