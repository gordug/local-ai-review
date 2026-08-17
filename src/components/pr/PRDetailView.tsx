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
import { SubmitReviewModal } from './SubmitReviewModal';
import { RiskBadge, ReadinessScore } from '../common/RiskGauge';
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  RefreshCw,
  MessageSquare,
  FileCode,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  Info,
} from 'lucide-react';

interface PRDetailViewProps {
  pr: GitHubPR;
  repoFullName: string;
  settings: AppSettings;
  onBack: () => void;
  onOpenChatWithContext: (contextPrompt: string, prId: number) => void;
  onOpenSettings?: () => void;
}

export const PRDetailView: React.FC<PRDetailViewProps> = ({
  pr,
  repoFullName,
  settings,
  onBack,
  onOpenChatWithContext,
  onOpenSettings = () => {},
}) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'review' | 'commits'>('diff');
  const [diffFiles, setDiffFiles] = useState<ParsedFileDiff[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [reviewReport, setReviewReport] = useState<AIReviewReport | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  useEffect(() => {
    loadPRData();
  }, [pr.number, repoFullName]);

  const loadPRData = async () => {
    setIsLoadingDiff(true);
    setError(null);
    const [owner, repo] = repoFullName.split('/');

    try {
      const shaKey = pr.head?.sha || 'latest';
      const cachedReview = await localDb.getPRReview(`${repoFullName}#${pr.number}#${shaKey}`);
      if (cachedReview) {
        setReviewReport(cachedReview.report);
      }

      let parsed: ParsedFileDiff[] = [];
      try {
        const files = await githubClient.getPRFiles(owner, repo, pr.number);
        if (files && files.length > 0) {
          parsed = files.map(parseFilePatch);
        }
      } catch (filesErr) {
        console.warn('getPRFiles failed, falling back:', filesErr);
      }

      if (parsed.length === 0) {
        try {
          const rawDiff = await githubClient.getPRDiff(owner, repo, pr.number);
          parsed = parseGitDiff(rawDiff);
        } catch (diffErr) {
          console.warn('getPRDiff fallback failed:', diffErr);
        }
      }

      if (parsed.length === 0) {
        parsed = getDemoDiffFiles(pr.number);
      }

      setDiffFiles(parsed);

      if (!cachedReview && parsed.length > 0) {
        aiRouter
          .reviewPR(settings, repoFullName, pr.number, pr.title, pr.body, parsed)
          .then(async (report) => {
            setReviewReport(report);
            await localDb.savePRReview({
              id: `${repoFullName}#${pr.number}#${shaKey}`,
              repoFullName,
              prNumber: pr.number,
              commitSha: shaKey,
              report,
              savedAt: Date.now(),
            });
          })
          .catch(() => {});
      }

      const commitList = await githubClient.getPRCommits(owner, repo, pr.number).catch(() => []);
      setCommits(commitList);
    } catch (e: any) {
      console.warn('Failed to load PR:', e);
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

      const shaKey = pr.head?.sha || 'latest';
      await localDb.savePRReview({
        id: `${repoFullName}#${pr.number}#${shaKey}`,
        repoFullName,
        prNumber: pr.number,
        commitSha: shaKey,
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

  const cleanBody = (pr.body || '')
    .replace(/<details>[\s\S]*?<\/details>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  return (
    <div className="pr-detail-view-container">
      <style>{`
        .pr-detail-view-container {
          padding: 12px 16px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pr-segmented-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          background-color: var(--bg-tertiary);
          border-radius: var(--radius-lg);
          padding: 3px;
          gap: 4px;
          border: 1px solid var(--border-subtle);
        }
        .pr-segment-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pr-segment-tab.active {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          font-weight: 600;
          box-shadow: var(--shadow-sm);
        }
        @media (max-width: 768px) {
          .pr-detail-view-container {
            padding: 8px 6px !important;
            gap: 8px !important;
          }
          .pr-segment-tab {
            padding: 6px 4px !important;
            font-size: 11px !important;
          }
        }
      `}</style>

      {/* Top Breadcrumb & Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
        >
          <ArrowLeft size={14} />
          <span style={{ fontWeight: 600 }}>Pull Requests</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleOpenChat}
            title="Chat about this PR"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
          >
            <MessageSquare size={13} />
            <span className="hide-on-compact">Chat</span>
          </button>
          <a
            href={pr.html_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
            title="Open on GitHub"
          >
            <span className="hide-on-compact">GitHub #{pr.number}</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Compact PR Summary Card */}
      <div className="card" style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                <span className={`badge ${pr.state === 'open' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '10px', padding: '0 5px' }}>
                  {pr.state.toUpperCase()}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  #{pr.number}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {pr.base.ref} &larr; <code style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0 4px', borderRadius: '3px', fontSize: '11px' }}>{pr.head.ref}</code>
                </span>
              </div>

              <h1 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, margin: 0 }}>
                {pr.title}
              </h1>
            </div>

            {/* Quick Action Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleRunAIReview}
                disabled={isAnalyzing || isLoadingDiff}
                style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Run or refresh AI review"
              >
                <Sparkles size={12} className={isAnalyzing ? 'spin' : ''} />
                <span>{isAnalyzing ? 'Reviewing...' : reviewReport ? 'Re-Run' : 'Review'}</span>
              </button>

              {reviewReport && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsSubmitModalOpen(true)}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  title="Submit Review to GitHub"
                >
                  <Send size={12} />
                  <span className="hide-on-compact">Submit</span>
                </button>
              )}

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                style={{ padding: '4px 6px', fontSize: '11px' }}
                title={isDetailsExpanded ? 'Collapse info' : 'Expand info'}
              >
                {isDetailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {reviewReport && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RiskBadge risk={reviewReport.overallRisk} />
                <ReadinessScore score={reviewReport.mergeReadinessScore} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {reviewReport.findings.length} findings
                </span>
              </div>

              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {settings.activeProvider === 'deterministic' ? 'Deterministic AST ($0)' : settings.activeProvider}
              </div>
            </div>
          )}

          {/* Collapsible Details Panel */}
          {isDetailsExpanded && (
            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {cleanBody ? (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, maxHeight: '140px', overflowY: 'auto', backgroundColor: 'var(--bg-tertiary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                  {cleanBody}
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No PR description provided.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modern Segmented Control Tab Bar (No Overflow / No Scrollbar) */}
      <div className="pr-segmented-tabs">
        <button
          className={`pr-segment-tab ${activeTab === 'diff' ? 'active' : ''}`}
          onClick={() => setActiveTab('diff')}
        >
          <FileCode size={13} />
          <span>Files ({diffFiles.length})</span>
        </button>

        <button
          className={`pr-segment-tab ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          <Sparkles size={13} />
          <span>AI Review</span>
          {reviewReport && (
            <span
              className={`badge ${reviewReport.findings.length > 0 ? 'badge-warning' : 'badge-success'}`}
              style={{ fontSize: '9px', padding: '0 4px', lineHeight: 1.2 }}
            >
              {reviewReport.findings.length}
            </span>
          )}
        </button>

        <button
          className={`pr-segment-tab ${activeTab === 'commits' ? 'active' : ''}`}
          onClick={() => setActiveTab('commits')}
        >
          <GitCommit size={13} />
          <span>Commits ({commits.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {isLoadingDiff ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: '12px' }}>Loading diff hunks and file changes...</p>
        </div>
      ) : (
        <>
          {activeTab === 'diff' && (
            <DiffViewer
              files={diffFiles}
              lineComments={reviewReport?.lineComments || []}
              defaultViewMode={settings.diffViewMode}
            />
          )}

          {activeTab === 'review' && (
            reviewReport ? (
              <AIReviewReportView
                report={reviewReport}
                onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
              />
            ) : (
              <div className="card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Sparkles size={28} style={{ margin: '0 auto 8px', color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '14px' }}>No AI Review Report Generated Yet</h3>
                <p style={{ fontSize: '11px', marginTop: '4px', maxWidth: '420px', margin: '4px auto 12px' }}>
                  Click "Review" above to run an automated multi-vector analysis across security, performance, bug risks, edge cases, and suggested line comments.
                </p>
                <button className="btn btn-primary btn-sm" onClick={handleRunAIReview} disabled={isAnalyzing}>
                  <Sparkles size={12} />
                  <span>Run AI Code Review Now</span>
                </button>
              </div>
            )
          )}

          {activeTab === 'commits' && (
            <div className="card" style={{ padding: '12px' }}>
              <h3 style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Commits in this Pull Request</h3>
              {commits.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  Commit {pr.head?.sha?.slice(0, 7) || 'HEAD'}: {pr.title}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {commits.map((c) => (
                    <div
                      key={c.sha}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.commit.message}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {c.commit.author.name} • {new Date(c.commit.author.date).toLocaleDateString()}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-primary)', flexShrink: 0 }}>
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

      {/* GitHub Review Submission Modal */}
      {reviewReport && (
        <SubmitReviewModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          pr={pr}
          repoFullName={repoFullName}
          report={reviewReport}
          githubToken={settings.githubToken}
          onOpenSettings={onOpenSettings}
        />
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
   private async performRefresh(token: string): Promise<string> {
     const res = await fetch('/api/auth/refresh', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ token }),
     });
     if (!res.ok) throw new Error('Token rotation failed');
     const data = await res.json();
     return data.accessToken;
   }
 }`;

  return parseGitDiff(rawDiff);
}
