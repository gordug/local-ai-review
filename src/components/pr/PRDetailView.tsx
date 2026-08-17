import React, { useState, useEffect } from 'react';
import { GitHubPR, ParsedFileDiff, GitHubCommit } from '../../types/github';
import { AIReviewReport } from '../../types/ai';
import { AppSettings } from '../../types/storage';
import { githubClient } from '../../services/github/githubClient';
import { parseGitDiff, parseFilePatch } from '../../services/github/diffParser';
import { aiRouter } from '../../services/ai/aiRouter';
import { localDb } from '../../services/storage/localDb';
import { DiffViewer } from './DiffViewer';
import { AIReviewReportView } from './AIReviewReportView';
import { RiskBadge, ReadinessScore } from '../common/RiskGauge';
import {
  ArrowLeft,
  GitPullRequest,
  ExternalLink,
  Sparkles,
  RefreshCw,
  MessageSquare,
  FileCode,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  Download,
} from 'lucide-react';

interface PRDetailViewProps {
  pr: GitHubPR;
  repoFullName: string;
  settings: AppSettings;
  onBack: () => void;
  onOpenChatWithContext: (contextPrompt: string, prId: number) => void;
}

export const PRDetailView: React.FC<PRDetailViewProps> = ({
  pr,
  repoFullName,
  settings,
  onBack,
  onOpenChatWithContext,
}) => {
  const [activeTab, setActiveTab] = useState<'review' | 'diff' | 'commits'>('review');
  const [diffFiles, setDiffFiles] = useState<ParsedFileDiff[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [reviewReport, setReviewReport] = useState<AIReviewReport | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Diff & Commits, plus any previously cached review
  useEffect(() => {
    loadPRData();
  }, [pr.number, repoFullName]);

  const loadPRData = async () => {
    setIsLoadingDiff(true);
    setError(null);
    const [owner, repo] = repoFullName.split('/');

    try {
      // 1. Check local IndexedDB cache for past review
      const cachedReview = await localDb.getPRReview(`${repoFullName}#${pr.number}#${pr.head.sha}`);
      if (cachedReview) {
        setReviewReport(cachedReview.report);
      }

      // 2. Fetch raw diff from GitHub
      let parsed: ParsedFileDiff[] = [];
      try {
        const rawDiff = await githubClient.getPRDiff(owner, repo, pr.number);
        parsed = parseGitDiff(rawDiff);
      } catch (diffErr) {
        // Try getting PR files list if raw diff fails
        const files = await githubClient.getPRFiles(owner, repo, pr.number).catch(() => []);
        if (files.length > 0) {
          parsed = files.map(parseFilePatch);
        }
      }

      if (parsed.length === 0) {
        // Fallback demo diff if offline/rate-limited
        parsed = getDemoDiffFiles(pr.number);
      }
      setDiffFiles(parsed);

      // 3. Fetch commits
      const commitList = await githubClient.getPRCommits(owner, repo, pr.number).catch(() => []);
      setCommits(commitList);
    } catch (e: any) {
      console.warn('Failed to load PR diff:', e);
      setDiffFiles(getDemoDiffFiles(pr.number));
    } finally {
      setIsLoadingDiff(false);
    }
  };

  const handleRunAIReview = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const report = await aiRouter.reviewPR(
        settings,
        repoFullName,
        pr.number,
        pr.title,
        pr.body,
        diffFiles
      );

      setReviewReport(report);
      setActiveTab('review');

      // Save to local IndexedDB
      await localDb.savePRReview({
        id: `${repoFullName}#${pr.number}#${pr.head.sha}`,
        repoFullName,
        prNumber: pr.number,
        commitSha: pr.head.sha,
        report,
        savedAt: Date.now(),
      });
    } catch (err: any) {
      setError(err.message || 'AI review analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpenChat = () => {
    let context = `Pull Request #${pr.number}: ${pr.title}\nDescription: ${pr.body || 'None'}\n\n`;
    if (reviewReport) {
      context += `AI Review Summary: ${reviewReport.executiveSummary}\nOverall Risk: ${reviewReport.overallRisk}\n`;
    }
    context += `Changed Files:\n${diffFiles.map((f) => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n')}`;
    onOpenChatWithContext(context, pr.number);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', width: '100%' }}>
      {/* Top Breadcrumb & Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={14} />
          <span>Back to Pull Requests</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleOpenChat}>
            <MessageSquare size={14} />
            <span>Chat about this PR</span>
          </button>
          <a
            href={pr.html_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>GitHub PR #{pr.number}</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* PR Header Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className={`badge ${pr.state === 'open' ? 'badge-success' : 'badge-info'}`}>
                {pr.state.toUpperCase()}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                #{pr.number}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {pr.base.ref} &larr; <code>{pr.head.ref}</code>
              </span>
            </div>

            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {pr.title}
            </h1>

            {pr.body && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: '80px', overflowY: 'auto' }}>
                {pr.body}
              </p>
            )}
          </div>

          {/* Action Trigger */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={handleRunAIReview}
              disabled={isAnalyzing || isLoadingDiff}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}
            >
              <Sparkles size={16} className={isAnalyzing ? 'spin' : ''} />
              <span>{isAnalyzing ? 'Analyzing Diff...' : reviewReport ? 'Re-Run AI Review' : 'Run AI Code Review'}</span>
            </button>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Provider: {settings.activeProvider === 'deterministic' ? 'Deterministic AST ($0)' : settings.activeProvider}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        {reviewReport && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <RiskBadge risk={reviewReport.overallRisk} />
              <ReadinessScore score={reviewReport.mergeReadinessScore} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {reviewReport.findings.length} findings identified
              </span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Model: <strong>{reviewReport.model}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '16px',
        }}
      >
        <button
          className={`btn ${activeTab === 'review' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('review')}
          style={{
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            borderBottom: activeTab === 'review' ? '2px solid var(--accent-primary)' : '2px solid transparent',
          }}
        >
          <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
          <span>AI Review Report</span>
          {reviewReport && (
            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
              {reviewReport.findings.length}
            </span>
          )}
        </button>

        <button
          className={`btn ${activeTab === 'diff' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('diff')}
          style={{
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            borderBottom: activeTab === 'diff' ? '2px solid var(--accent-primary)' : '2px solid transparent',
          }}
        >
          <FileCode size={14} />
          <span>Files Changed ({diffFiles.length})</span>
        </button>

        <button
          className={`btn ${activeTab === 'commits' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('commits')}
          style={{
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            borderBottom: activeTab === 'commits' ? '2px solid var(--accent-primary)' : '2px solid transparent',
          }}
        >
          <GitCommit size={14} />
          <span>Commits ({commits.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {isLoadingDiff ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
          <p>Parsing git diff hunks and file trees...</p>
        </div>
      ) : (
        <>
          {activeTab === 'review' && (
            reviewReport ? (
              <AIReviewReportView report={reviewReport} />
            ) : (
              <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Sparkles size={36} style={{ margin: '0 auto 12px', color: 'var(--accent-primary)' }} />
                <h3>No AI Review Generated Yet</h3>
                <p style={{ fontSize: '13px', marginTop: '6px', maxWidth: '500px', margin: '6px auto 16px' }}>
                  Click "Run AI Code Review" above to run an automated multi-vector analysis across security, performance, bug risks, edge cases, and suggested line comments.
                </p>
                <button className="btn btn-primary" onClick={handleRunAIReview} disabled={isAnalyzing}>
                  <Sparkles size={14} />
                  <span>Run AI Code Review Now</span>
                </button>
              </div>
            )
          )}

          {activeTab === 'diff' && (
            <DiffViewer
              files={diffFiles}
              lineComments={reviewReport?.lineComments || []}
              defaultViewMode={settings.diffViewMode}
            />
          )}

          {activeTab === 'commits' && (
            <div className="card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Commits in this Pull Request</h3>
              {commits.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Single commit PR ({pr.head.sha.slice(0, 7)}: {pr.title})
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {commits.map((c) => (
                    <div
                      key={c.sha}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.commit.message}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {c.commit.author.name} • {new Date(c.commit.author.date).toLocaleDateString()}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-primary)' }}>
                        {c.sha.slice(0, 7)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

function getDemoDiffFiles(prNumber: number): ParsedFileDiff[] {
  const rawDiff = `diff --git a/src/services/auth/tokenService.ts b/src/services/auth/tokenService.ts
index 893ab42..984fc21 100644
--- a/src/services/auth/tokenService.ts
+++ b/src/services/auth/tokenService.ts
@@ -18,12 +18,24 @@ export class TokenService {
   private refreshPromise: Promise<string> | null = null;
 
   async rotateToken(refreshToken: string): Promise<{ accessToken: string }> {
-    const res = await fetch('/api/auth/refresh', {
-      method: 'POST',
-      body: JSON.stringify({ token: refreshToken }),
-    });
-    const data = await res.json();
-    return { accessToken: data.accessToken };
+    if (!refreshToken || typeof refreshToken !== 'string') {
+      throw new Error('Invalid refresh token supplied');
+    }
+
+    // Deduplicate concurrent rotation calls
+    if (this.refreshPromise) {
+      const token = await this.refreshPromise;
+      return { accessToken: token };
+    }
+
+    this.refreshPromise = this.performRefresh(refreshToken);
+    try {
+      const token = await this.refreshPromise;
+      return { accessToken: token };
+    } finally {
+      this.refreshPromise = null;
+    }
   }
+
+  private async performRefresh(token: string): Promise<string> {
+    const res = await fetch('/api/auth/refresh', {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      body: JSON.stringify({ token }),
+    });
+    if (!res.ok) throw new Error('Token rotation failed');
+    const data = await res.json();
+    return data.accessToken;
+  }
 }
diff --git a/src/middleware/rateLimiter.ts b/src/middleware/rateLimiter.ts
new file mode 100644
index 0000000..fe4567a
--- /dev/null
+++ b/src/middleware/rateLimiter.ts
@@ -0,0 +1,18 @@
+import { Request, Response, NextFunction } from 'express';
+
+const hitMap = new Map<string, { count: number; resetAt: number }>();
+
+export function rateLimiter(maxHits = 100, windowMs = 60000) {
+  return (req: Request, res: Response, next: NextFunction) => {
+    const ip = req.ip || 'anonymous';
+    const now = Date.now();
+    const record = hitMap.get(ip) || { count: 0, resetAt: now + windowMs };
+
+    if (now > record.resetAt) {
+      record.count = 0;
+      record.resetAt = now + windowMs;
+    }
+
+    record.count++;
+    hitMap.set(ip, record);
+    if (record.count > maxHits) {
+      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
+    }
+    next();
+  };
+}`;

  return parseGitDiff(rawDiff);
}
