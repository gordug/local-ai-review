import { describe, it, expect } from 'vitest';
import { AIReviewReport } from '../types/ai';
import { GitHubReviewSubmissionPayload } from '../types/github';

describe('GitHub Review Submission Payload Generator', () => {
  const mockReport: AIReviewReport = {
    id: 'rev-1',
    repoFullName: 'gordug/local-ai-review',
    prNumber: 42,
    timestamp: Date.now(),
    provider: 'deterministic',
    overallRisk: 'low',
    mergeReadinessScore: 92,
    confidenceScore: 95,
    executiveSummary: 'Clean, modular changes with solid test coverage.',
    architectureSummary: 'Extends PR review capabilities.',
    keyStrengths: ['No hardcoded secrets', 'Clean TypeScript types'],
    findings: [],
    suggestedTests: ['Test submitPRReview endpoint payload structure'],
    suggestedPatches: [],
    lineComments: [
      {
        id: 'lc-1',
        file: 'src/services/auth.ts',
        line: 15,
        side: 'RIGHT',
        category: 'logic',
        severity: 'low',
        author: 'AI Reviewer',
        body: 'Consider caching token response.',
        suggestedCode: 'const token = await cache.getOrSet(key, fetchToken);',
      },
    ],
    model: 'Deterministic AST',
  };

  it('formats review submission payload with COMMENT event', () => {
    const payload: GitHubReviewSubmissionPayload = {
      commit_id: 'abc1234',
      event: 'COMMENT',
      body: mockReport.executiveSummary,
      comments: [
        {
          path: mockReport.lineComments![0].file,
          line: mockReport.lineComments![0].line!,
          side: 'RIGHT',
          body: `**[RevFlow AI]**\n\n${mockReport.lineComments![0].body}\n\n\`\`\`suggestion\n${mockReport.lineComments![0].suggestedCode}\n\`\`\``,
        },
      ],
    };

    expect(payload.event).toBe('COMMENT');
    expect(payload.commit_id).toBe('abc1234');
    expect(payload.comments).toHaveLength(1);
    expect(payload.comments![0].path).toBe('src/services/auth.ts');
    expect(payload.comments![0].body).toContain('```suggestion');
  });

  it('formats review submission with APPROVE event when risk is low', () => {
    const payload: GitHubReviewSubmissionPayload = {
      event: mockReport.overallRisk === 'low' ? 'APPROVE' : 'COMMENT',
      body: `### Merge Readiness: ${mockReport.mergeReadinessScore}/100\n${mockReport.executiveSummary}`,
    };

    expect(payload.event).toBe('APPROVE');
    expect(payload.body).toContain('Merge Readiness: 92/100');
  });

  it('formats review submission with REQUEST_CHANGES event when risk is critical', () => {
    const criticalReport: AIReviewReport = {
      ...mockReport,
      overallRisk: 'critical',
      mergeReadinessScore: 30,
    };

    const event = criticalReport.overallRisk === 'critical' ? 'REQUEST_CHANGES' : 'COMMENT';
    expect(event).toBe('REQUEST_CHANGES');
  });
});
