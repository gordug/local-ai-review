import { ParsedFileDiff } from '../../types/github';

export function buildPRReviewPrompt(
  repoFullName: string,
  prTitle: string,
  prBody: string | null,
  diffFiles: ParsedFileDiff[],
  guidelines?: string
): { systemInstruction: string; userPrompt: string } {
  const systemInstruction = `You are an elite, highly experienced Principal Software Architect and Lead Security Auditor.
Your task is to conduct an ultra-rigorous, constructive, and actionable code review of a GitHub Pull Request.

You must respond ONLY with a strictly valid JSON object adhering precisely to this structure:
{
  "executiveSummary": "Concise 2-3 sentence overview of what this PR does and key takeaways.",
  "overallRisk": "low" | "medium" | "high" | "critical",
  "confidenceScore": number (0 to 100),
  "architectureSummary": "Brief analysis of the architectural impact, maintainability, and design patterns used.",
  "mergeReadinessScore": number (0 to 100),
  "keyStrengths": ["string", "string"],
  "findings": [
    {
      "id": "f-1",
      "category": "security" | "performance" | "bug_risk" | "maintainability" | "breaking_change" | "best_practice",
      "severity": "low" | "medium" | "high" | "critical",
      "file": "path/to/file.ts",
      "line": 42,
      "title": "Short finding title",
      "description": "Detailed explanation of why this is a concern.",
      "suggestion": "How to resolve this issue with exact recommended code or approach.",
      "patch": "optional diff patch snippet"
    }
  ],
  "lineComments": [
    {
      "id": "c-1",
      "file": "path/to/file.ts",
      "line": 42,
      "side": "RIGHT",
      "author": "AI Reviewer",
      "body": "Constructive markdown comment for line 42",
      "severity": "low" | "medium" | "high" | "critical",
      "category": "security" | "performance" | "bug_risk" | "style" | "logic",
      "suggestedCode": "replacement line or block"
    }
  ],
  "suggestedTests": [
    "Specific unit or integration test case description 1",
    "Specific edge case test description 2"
  ],
  "suggestedPatches": [
    {
      "file": "path/to/file.ts",
      "description": "Fix null hazard in user lookup",
      "patch": "@@ -40,4 +40,5 @@\\n-  const user = users[id];\\n+  const user = users[id];\\n+  if (!user) throw new NotFoundError('User missing');"
    }
  ]
}

Guidelines to enforce:
${guidelines || 'Emphasize security, null-safety, error handling, clean architecture, and performance.'}
`;

  // Build condensed diff representation
  let diffSummary = '';
  for (const file of diffFiles) {
    diffSummary += `\n--- File: ${file.filename} (${file.status}, +${file.additions}, -${file.deletions}) ---\n`;
    for (const hunk of file.hunks) {
      diffSummary += `${hunk.header}\n`;
      for (const line of hunk.lines) {
        if (line.type === 'hunk-header') continue;
        const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' ';
        const lineNum = line.newLineNumber || line.oldLineNumber || '';
        diffSummary += `${lineNum.toString().padStart(4, ' ')} ${prefix} ${line.content}\n`;
      }
    }
  }

  const userPrompt = `Repository: ${repoFullName}
Pull Request Title: ${prTitle}
Description:
${prBody || 'No description provided.'}

DIFF CHANGES:
${diffSummary}

Please analyze this diff thoroughly and return your review as the requested JSON object.`;

  return { systemInstruction, userPrompt };
}

export function buildBranchComparePrompt(
  repoFullName: string,
  baseBranch: string,
  compareBranch: string,
  aheadBy: number,
  behindBy: number,
  commits: Array<{ message: string; author?: string }>,
  diffFiles: ParsedFileDiff[],
  guidelines?: string
): { systemInstruction: string; userPrompt: string } {
  const systemInstruction = `You are an expert Release Engineer and DevOps Architect.
Analyze the differences between two branches to determine merge safety, conflict potential, and architectural breaking changes.

Respond ONLY with a valid JSON object matching this schema:
{
  "mergeReadiness": "ready" | "caution" | "high_risk" | "blocked",
  "readinessScore": number (0 to 100),
  "executiveSummary": "2-3 sentence overview of branch status and merge risks.",
  "conflictRisks": [
    {
      "file": "path/to/file.ts",
      "riskLevel": "low" | "medium" | "high" | "critical",
      "reason": "Why this file has a high probability of merge conflicts or divergence.",
      "recommendation": "Action to avoid conflict"
    }
  ],
  "breakingChanges": [
    {
      "type": "api" | "schema" | "config" | "dependency",
      "description": "Explanation of the breaking change.",
      "affectedFiles": ["file1.ts", "file2.ts"]
    }
  ],
  "recommendedSteps": [
    "Step 1: Rebase compare branch on latest base",
    "Step 2: Run migration verification tests"
  ]
}

Guidelines:
${guidelines || 'Strict verification of schema stability, exported API signatures, and dependency conflicts.'}
`;

  let commitLog = commits.slice(0, 20).map((c) => `- ${c.message}`).join('\n');
  let diffSummary = diffFiles.slice(0, 15).map((f) => `File: ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n');

  const userPrompt = `Repository: ${repoFullName}
Base Branch: ${baseBranch}
Compare Branch: ${compareBranch}
Commits Ahead: ${aheadBy}, Commits Behind: ${behindBy}

Commit Log:
${commitLog || 'No individual commits listed.'}

Modified Files:
${diffSummary}

Evaluate merge safety and return the JSON object.`;

  return { systemInstruction, userPrompt };
}

export function buildIssueSpecPrompt(
  repoFullName: string,
  issueNumber: number,
  issueTitle: string,
  issueBody: string | null,
  comments: Array<{ author: string; body: string }>
): { systemInstruction: string; userPrompt: string } {
  const systemInstruction = `You are a Principal Product Architect and Senior Tech Lead.
Your goal is to triage this GitHub Issue and expand it into a comprehensive, highly actionable Technical Specification and Product Requirements Document (PRD).

Respond ONLY with a valid JSON object matching this schema:
{
  "executiveSummary": "2-3 sentence crystal-clear summary of the reported issue, feature request, or problem statement.",
  "rootCauseHypothesis": "Technical explanation of why this issue occurs or what fundamental architectural capability is missing.",
  "affectedComponents": ["Component A", "Database Service", "Auth Middleware"],
  "suspectedFiles": ["src/services/auth.ts", "src/controllers/userController.ts"],
  "implementationPlan": [
    {
      "step": 1,
      "title": "Isolate token renewal bug in auth service",
      "description": "Add regression test reproducing expired token loop."
    },
    {
      "step": 2,
      "title": "Implement backoff retry handler",
      "description": "Update client network interceptor."
    }
  ],
  "acceptanceCriteria": [
    "User session persists seamlessly across token rotation",
    "Failed renewals trigger clean redirect to login"
  ],
  "suggestedCodeSolution": "Optional TypeScript/JavaScript snippet illustrating proposed fix",
  "suggestedTestCases": [
    "Test expired refresh token returns 401 and clears local cache",
    "Test concurrent requests during token rotation share single refresh promise"
  ]
}
`;

  let commentsSummary = comments.slice(0, 10).map((c) => `${c.author}: ${c.body}`).join('\n\n');

  const userPrompt = `Repository: ${repoFullName}
Issue #${issueNumber}: ${issueTitle}

Issue Description:
${issueBody || 'No description provided.'}

Discussion / Comments:
${commentsSummary || 'No comments yet.'}

Expand this issue into a full technical specification in JSON.`;

  return { systemInstruction, userPrompt };
}
