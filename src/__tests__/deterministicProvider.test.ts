import { describe, it, expect } from 'vitest';
import { deterministicProvider } from '../services/ai/providers/deterministicProvider';
import { parseGitDiff } from '../services/github/diffParser';

describe('Deterministic Static Analysis Provider', () => {
  it('should detect hardcoded secret tokens and assign critical risk', async () => {
    const rawDiff = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,2 +1,3 @@
-const token = process.env.GITHUB_TOKEN;
+const token = "ghp_123456789012345678901234567890123456";`;

    const diffFiles = parseGitDiff(rawDiff);
    const report = await deterministicProvider.reviewPR('test/repo', 1, 'Add secret', diffFiles);

    expect(report.overallRisk).toBe('critical');
    expect(report.mergeReadinessScore).toBeLessThan(50);
    expect(report.findings.some((f) => f.category === 'security' && f.severity === 'critical')).toBe(true);
    expect(report.lineComments.some((c) => c.severity === 'critical')).toBe(true);
  });

  it('should flag leftover console.log and empty catch blocks', async () => {
    const rawDiff = `diff --git a/src/handler.ts b/src/handler.ts
--- a/src/handler.ts
+++ b/src/handler.ts
@@ -1,5 +1,9 @@
 export function processData() {
+  console.log("processing data");
+  try {
+    runTask();
+  } catch (e) {}
 }`;

    const diffFiles = parseGitDiff(rawDiff);
    const report = await deterministicProvider.reviewPR('test/repo', 2, 'Refactor handler', diffFiles);

    expect(report.findings.some((f) => f.category === 'maintainability')).toBe(true);
    expect(report.findings.some((f) => f.category === 'bug_risk')).toBe(true);
  });

  it('should evaluate branch comparison merge safety score and identify breaking changes', async () => {
    const rawDiff = `diff --git a/prisma/migrations/01_init/migration.sql b/prisma/migrations/01_init/migration.sql
--- a/prisma/migrations/01_init/migration.sql
+++ b/prisma/migrations/01_init/migration.sql
@@ -1,2 +1,2 @@
-ALTER TABLE users ADD COLUMN age INT;
+ALTER TABLE users ADD COLUMN age BIGINT;`;

    const diffFiles = parseGitDiff(rawDiff);
    const analysis = await deterministicProvider.compareBranches(
      'test/repo',
      'main',
      'feature/schema-change',
      2,
      0,
      diffFiles
    );

    expect(analysis.breakingChanges.length).toBeGreaterThan(0);
    expect(analysis.breakingChanges[0].type).toBe('schema');
  });

  it('should generate technical specifications for issues', async () => {
    const spec = await deterministicProvider.expandIssue(
      'test/repo',
      42,
      'Bug: token refresh loop on expired session',
      'When token expires, client enters infinite redirect loop.'
    );

    expect(spec.issueNumber).toBe(42);
    expect(spec.implementationPlan.length).toBeGreaterThan(0);
    expect(spec.acceptanceCriteria.length).toBeGreaterThan(0);
  });
});
