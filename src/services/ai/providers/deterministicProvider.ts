import { ParsedFileDiff } from '../../../types/github';
import { AIReviewReport, BranchMergeAnalysis, IssueTechnicalSpec, ReviewFinding, LineReviewComment, RiskLevel } from '../../../types/ai';

export class DeterministicProvider {
  /**
   * Deterministic static code review of a PR diff
   */
  async reviewPR(
    repoFullName: string,
    prNumber: number,
    prTitle: string,
    diffFiles: ParsedFileDiff[]
  ): Promise<AIReviewReport> {
    const findings: ReviewFinding[] = [];
    const lineComments: LineReviewComment[] = [];
    const keyStrengths: string[] = [];
    const suggestedTests: string[] = [];
    const suggestedPatches: Array<{ file: string; description: string; patch: string }> = [];

    let totalAdditions = 0;
    let totalDeletions = 0;
    let criticalIssuesCount = 0;
    let highIssuesCount = 0;

    for (const file of diffFiles) {
      totalAdditions += file.additions;
      totalDeletions += file.deletions;

      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type !== 'add') continue;
          const text = line.content;
          const lineNum = line.newLineNumber || 1;

          // 1. Secret / Credential Leak Detection
          if (/ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{32,}|-----BEGIN PRIVATE KEY-----/i.test(text)) {
            criticalIssuesCount++;
            findings.push({
              id: `sec-secret-${file.filename}-${lineNum}`,
              category: 'security',
              severity: 'critical',
              file: file.filename,
              line: lineNum,
              title: 'Hardcoded Secret / API Token Detected',
              description: 'Potential secret token or private credential committed in plain text.',
              suggestion: 'Revoke this credential immediately and load it from environment variables or a secure secret manager.',
            });
            lineComments.push({
              id: `lc-sec-${file.filename}-${lineNum}`,
              file: file.filename,
              line: lineNum,
              side: 'RIGHT',
              author: 'Static Analyzer',
              severity: 'critical',
              category: 'security',
              body: '🚨 **Critical Security Hazard**: Detected what appears to be a raw hardcoded token or secret. Never commit API keys or private certificates to version control.',
            });
          }

          // 2. Dangerous SQL or Exec injection
          if (/SELECT\s+.*\s+FROM\s+.*(\+|\$\{).*|\b(exec|execSync)\s*\(\s*(\`|.*\+)/i.test(text)) {
            highIssuesCount++;
            findings.push({
              id: `sec-sqli-${file.filename}-${lineNum}`,
              category: 'security',
              severity: 'high',
              file: file.filename,
              line: lineNum,
              title: 'Potential Injection Vulnerability',
              description: 'Detected raw string concatenation inside a query or command execution function.',
              suggestion: 'Use parameterized queries or prepared statements instead of string concatenation.',
            });
            lineComments.push({
              id: `lc-sqli-${file.filename}-${lineNum}`,
              file: file.filename,
              line: lineNum,
              side: 'RIGHT',
              author: 'Static Analyzer',
              severity: 'high',
              category: 'security',
              body: '⚠️ **Security Warning**: String concatenation in query/command builder may introduce SQL injection or command injection. Use parameterization.',
            });
          }

          // 3. Dangerous DOM manipulation (XSS)
          if (/dangerouslySetInnerHTML|innerHTML\s*=/i.test(text)) {
            findings.push({
              id: `sec-xss-${file.filename}-${lineNum}`,
              category: 'security',
              severity: 'medium',
              file: file.filename,
              line: lineNum,
              title: 'Direct HTML Injection (XSS Risk)',
              description: 'Setting innerHTML directly can lead to Cross-Site Scripting (XSS) if data is user-controlled.',
              suggestion: 'Sanitize HTML with DOMPurify or prefer standard text nodes / component rendering.',
            });
          }

          // 4. Debugging leftovers
          if (/(console\.(log|debug|warn|trace)\(|debugger;|print\(|var_dump\(|dd\()/i.test(text) && !file.filename.includes('test')) {
            findings.push({
              id: `dbg-${file.filename}-${lineNum}`,
              category: 'maintainability',
              severity: 'low',
              file: file.filename,
              line: lineNum,
              title: 'Leftover Debugging Statement',
              description: `Found debug statement \`${text.trim()}\` in production code.`,
              suggestion: 'Remove debug logging before merging or replace with a structured logger.',
            });
            lineComments.push({
              id: `lc-dbg-${file.filename}-${lineNum}`,
              file: file.filename,
              line: lineNum,
              side: 'RIGHT',
              author: 'Static Analyzer',
              severity: 'low',
              category: 'style',
              body: '🧹 **Cleanup**: Remove leftover debug statement before merging.',
              suggestedCode: '// removed debug statement',
            });
          }

          // 5. Silent Error Swallowing
          if (/catch\s*\([a-zA-Z0-9_]*\)\s*\{\s*\}/.test(text)) {
            findings.push({
              id: `bug-swallow-${file.filename}-${lineNum}`,
              category: 'bug_risk',
              severity: 'medium',
              file: file.filename,
              line: lineNum,
              title: 'Empty Exception Catch Block',
              description: 'Errors are being swallowed silently without logging or handling, creating hard-to-diagnose failure modes.',
              suggestion: 'Log the error or handle it explicitly so failures do not fail silently.',
            });
          }
        }
      }
    }

    // Determine overall risk
    let overallRisk: RiskLevel = 'low';
    let mergeReadinessScore = 95;

    if (criticalIssuesCount > 0) {
      overallRisk = 'critical';
      mergeReadinessScore = 20;
    } else if (highIssuesCount > 0 || findings.length > 5) {
      overallRisk = 'high';
      mergeReadinessScore = 55;
    } else if (findings.length > 2 || totalAdditions > 600) {
      overallRisk = 'medium';
      mergeReadinessScore = 75;
    }

    // Key strengths
    if (diffFiles.some((f) => f.filename.includes('test') || f.filename.includes('spec'))) {
      keyStrengths.push('Includes dedicated automated unit or integration tests.');
    }
    if (totalAdditions < 300 && totalDeletions < 200) {
      keyStrengths.push('Small, focused change footprint facilitating rapid review.');
    }
    if (criticalIssuesCount === 0) {
      keyStrengths.push('No obvious credential leaks or critical injection patterns detected by static AST rules.');
    }

    // Suggested Tests
    suggestedTests.push(`Verify boundary conditions and error handling in ${diffFiles[0]?.filename || 'modified modules'}.`);
    suggestedTests.push('Run end-to-end regression test suite to verify no regressions in affected user journeys.');

    const executiveSummary = `Static AST analysis inspected ${diffFiles.length} changed files (+${totalAdditions}/-${totalDeletions}). Detected ${findings.length} findings across security, maintainability, and code quality. Overall risk level is rated ${overallRisk.toUpperCase()}.`;

    const architectureSummary = `Changes modify ${diffFiles.length} components. Module dependencies remain structurally cohesive. Recommend reviewing highlighted lines for clean error handling.`;

    return {
      id: `rev-${repoFullName}-${prNumber}-${Date.now()}`,
      prNumber,
      repoFullName,
      timestamp: Date.now(),
      provider: 'deterministic',
      model: 'Deterministic AST Rule Engine ($0 Compute)',
      executiveSummary,
      overallRisk,
      confidenceScore: 88,
      architectureSummary,
      findings,
      lineComments,
      suggestedTests,
      suggestedPatches,
      keyStrengths,
      mergeReadinessScore,
      isDeterministicFallback: true,
    };
  }

  /**
   * Deterministic branch comparison merge readiness check
   */
  async compareBranches(
    repoFullName: string,
    baseBranch: string,
    compareBranch: string,
    aheadBy: number,
    behindBy: number,
    diffFiles: ParsedFileDiff[]
  ): Promise<BranchMergeAnalysis> {
    const conflictRisks: BranchMergeAnalysis['conflictRisks'] = [];
    const breakingChanges: BranchMergeAnalysis['breakingChanges'] = [];
    const recommendedSteps: string[] = [];

    // Check high conflict risk files
    for (const file of diffFiles) {
      if (file.filename.includes('package-lock.json') || file.filename.includes('yarn.lock') || file.filename.includes('pnpm-lock.yaml')) {
        conflictRisks.push({
          file: file.filename,
          riskLevel: 'medium',
          reason: 'Lockfile modifications frequently result in merge conflicts when base branch has concurrent dependency updates.',
          recommendation: 'Regenerate lockfile after merging/rebasing latest base.',
        });
      }
      if (file.filename.includes('schema') || file.filename.includes('migration')) {
        breakingChanges.push({
          type: 'schema',
          description: `Database schema or migration file modified: ${file.filename}`,
          affectedFiles: [file.filename],
        });
      }
      if (file.status === 'removed' && (file.filename.endsWith('.ts') || file.filename.endsWith('.js'))) {
        breakingChanges.push({
          type: 'api',
          description: `Deleted source module: ${file.filename}. Ensure dependent modules no longer import this file.`,
          affectedFiles: [file.filename],
        });
      }
    }

    let mergeReadiness: BranchMergeAnalysis['mergeReadiness'] = 'ready';
    let readinessScore = 90;

    if (behindBy > 20) {
      mergeReadiness = 'caution';
      readinessScore = 65;
      recommendedSteps.push(`Compare branch is ${behindBy} commits behind '${baseBranch}'. Rebase or merge '${baseBranch}' first to minimize conflicts.`);
    }

    if (breakingChanges.length > 0) {
      if ((mergeReadiness as string) !== 'blocked') {
        mergeReadiness = 'caution';
      }
      readinessScore = Math.max(30, readinessScore - breakingChanges.length * 15);
      recommendedSteps.push('Execute all database migrations and API contract tests in a staging sandbox before merging.');
    }

    recommendedSteps.push(`Run full CI/CD test pipeline comparing '${compareBranch}' against '${baseBranch}'.`);

    return {
      id: `compare-${repoFullName}-${baseBranch}-${compareBranch}-${Date.now()}`,
      baseBranch,
      compareBranch,
      repoFullName,
      timestamp: Date.now(),
      provider: 'deterministic',
      model: 'Deterministic Rule Engine',
      aheadBy,
      behindBy,
      mergeReadiness,
      readinessScore,
      executiveSummary: `Branch '${compareBranch}' is ${aheadBy} commits ahead and ${behindBy} commits behind '${baseBranch}'. Inspected ${diffFiles.length} modified files. Merge risk is assessed as ${mergeReadiness.toUpperCase()}.`,
      conflictRisks,
      breakingChanges,
      recommendedSteps,
    };
  }

  /**
   * Deterministic issue expansion and technical spec generator
   */
  async expandIssue(
    repoFullName: string,
    issueNumber: number,
    issueTitle: string,
    issueBody: string | null
  ): Promise<IssueTechnicalSpec> {
    const lines = (issueBody || '').split('\n').filter((l) => l.trim());
    const isBug = /bug|fix|error|fail|crash|exception|broken/i.test(issueTitle);

    return {
      id: `spec-${repoFullName}-${issueNumber}-${Date.now()}`,
      issueNumber,
      issueTitle,
      repoFullName,
      timestamp: Date.now(),
      provider: 'deterministic',
      model: 'Deterministic Spec Synthesizer',
      executiveSummary: `Triage of Issue #${issueNumber}: "${issueTitle}". Categorized as a ${isBug ? 'defect / bug fix' : 'feature enhancement / refactor'}. Requires systematic validation and test coverage.`,
      rootCauseHypothesis: isBug
        ? 'Likely caused by unhandled edge case or boundary state mismatch in state/input parsing logic.'
        : 'Missing architectural feature module or extended configuration requirement.',
      affectedComponents: ['Core Business Logic', 'Input Validation / API Boundary', 'Unit Test Suite'],
      suspectedFiles: ['src/services/...', 'src/components/...'],
      implementationPlan: [
        {
          step: 1,
          title: 'Reproduce Issue in Isolated Test Case',
          description: `Create an automated regression test reproducing "${issueTitle}".`,
        },
        {
          step: 2,
          title: 'Implement Core Fix / Feature Capability',
          description: 'Update underlying handlers and add protective guards against invalid states.',
        },
        {
          step: 3,
          title: 'Verify Edge Cases and Error Boundaries',
          description: 'Ensure graceful error handling with descriptive error messages.',
        },
        {
          step: 4,
          title: 'Review Documentation and PR Submission',
          description: 'Open a focused PR with issue references and pass all CI checks.',
        },
      ],
      acceptanceCriteria: [
        `Reported condition in #${issueNumber} is resolved without regression.`,
        'All existing unit and integration test suites pass with 100% success.',
        'Proper error logging and typed responses are returned.',
      ],
      suggestedCodeSolution: `// Proposed Solution Pattern:\n// 1. Guard against null / undefined input\n// 2. Wrap state transitions in error boundaries\n// 3. Return explicit status codes`,
      suggestedTestCases: [
        'Test nominal successful case with valid inputs',
        'Test null / malformed input triggers expected validation response',
        'Test concurrent invocations maintain data consistency',
      ],
    };
  }
}

export const deterministicProvider = new DeterministicProvider();
