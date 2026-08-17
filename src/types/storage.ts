import { AIProviderConfig, AIReviewReport, BranchMergeAnalysis, IssueTechnicalSpec, ChatMessage } from './ai';

export interface AppSettings {
  githubToken: string;
  githubOAuthClientId: string;
  theme: 'dark' | 'light' | 'system';
  activeProvider: string;
  providers: Record<string, AIProviderConfig>;
  activeRepo: string; // "owner/name"
  customGuidelines: string;
  autoAnalyzePRs: boolean;
  diffViewMode: 'unified' | 'split';
  syntaxTheme: 'dracula' | 'github-dark' | 'github-light';
}

export interface RepoRule {
  id: string;
  repoFullName: string;
  name: string;
  guidelines: string;
  enforceTypeScript: boolean;
  maxFunctionLines: number;
  blockSecretLeaks: boolean;
  createdAt: number;
}

export interface CachedPRReview {
  id: string; // `${repoFullName}#${prNumber}#${commitSha}`
  repoFullName: string;
  prNumber: number;
  commitSha: string;
  report: AIReviewReport;
  savedAt: number;
}

export interface CachedBranchCompare {
  id: string; // `${repoFullName}#${baseBranch}..${compareBranch}`
  repoFullName: string;
  baseBranch: string;
  compareBranch: string;
  analysis: BranchMergeAnalysis;
  savedAt: number;
}

export interface CachedIssueSpec {
  id: string; // `${repoFullName}#issue#${issueNumber}`
  repoFullName: string;
  issueNumber: number;
  spec: IssueTechnicalSpec;
  savedAt: number;
}

export interface StoredChatSession {
  id: string; // `${repoFullName}#${contextType}#${contextId}`
  repoFullName: string;
  contextType: 'pr' | 'branch_compare' | 'issue' | 'general';
  contextId: string | number;
  messages: ChatMessage[];
  updatedAt: number;
}
