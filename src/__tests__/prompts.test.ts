import { describe, it, expect } from 'vitest';
import { buildPRReviewPrompt, buildBranchComparePrompt, buildIssueSpecPrompt } from '../services/ai/prompts';
import { parseGitDiff } from '../services/github/diffParser';

describe('Prompt Builders', () => {
  it('should build structured PR review prompt with JSON system instructions', () => {
    const diff = parseGitDiff('diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-1\n+2');
    const { systemInstruction, userPrompt } = buildPRReviewPrompt('test/repo', 'Fix bug', 'Fixes #1', diff);

    expect(systemInstruction).toContain('executiveSummary');
    expect(systemInstruction).toContain('overallRisk');
    expect(userPrompt).toContain('Fix bug');
    expect(userPrompt).toContain('a.ts');
  });

  it('should build branch compare prompt', () => {
    const { systemInstruction, userPrompt } = buildBranchComparePrompt(
      'test/repo',
      'main',
      'feature',
      3,
      1,
      [{ message: 'feat: add auth' }],
      []
    );

    expect(systemInstruction).toContain('mergeReadiness');
    expect(userPrompt).toContain('Commits Ahead: 3');
  });

  it('should build issue expansion prompt', () => {
    const { systemInstruction, userPrompt } = buildIssueSpecPrompt(
      'test/repo',
      10,
      'Add dark theme toggle',
      'Support system preference',
      []
    );

    expect(systemInstruction).toContain('implementationPlan');
    expect(userPrompt).toContain('#10: Add dark theme toggle');
  });
});
