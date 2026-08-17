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
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  useEffect(() => {
    loadPRData();
  }, [pr.number, repoFullName]);

  const loadPRData = async () => {
    setIsLoadingDiff(true);
    setError(null);
    const [owner, repo] = repoFullName.split('/');

    try {
      // 1. Check local IndexedDB cache for past review
      const shaKey = pr.head?.sha || 'latest';
      const cachedReview = await localDb.getPRReview(`${repoFullName}#${pr.number}#${shaKey}`);
      if (cachedReview) {
        setReviewReport(cachedReview.report);
      }

      // 2. Fetch PR files as primary robust CORS-safe method
      let parsed: ParsedFileDiff[] = [];
      try {
        const files = await githubClient.getPRFiles(owner, repo, pr.number);
        if (files && files.length > 0) {
          parsed = files.map(parseFilePatch);
        }
      } catch (filesErr) {
        console.warn('getPRFiles failed, attempting raw diff fallback:', filesErr);
      }

      // 3. Fallback to raw diff if files was empty
      if (parsed.length === 0) {
        try {
          const rawDiff = await githubClient.getPRDiff(owner, repo, pr.number);
          parsed = parseGitDiff(rawDiff);
        } catch (diffErr) {
          console.warn('getPRDiff failed:', diffErr);
        }
      }

      // 4. Fallback to demo files if offline or rate limited
      if (parsed.length === 0) {
        parsed = getDemoDiffFiles(pr.number);
      }

      setDiffFiles(parsed);

      // Auto-run deterministic review if none cached yet
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

      // 5. Fetch commits
      const commitList = await githubClient.getPRCommits(owner, repo, pr.number).catch(() => []);
      setCommits(commitList);
    } catch (e: any) {
      console.warn('Failed to load PR diff:', e);
      const demo = getDemoDiffFiles(pr.number);
      setDiffFiles(demo);
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

  // Clean description text
  const cleanBody = (pr.body || '')
    .replace(/<details>[\s\S]*?<\/details>/gi, '[Release Notes and Details omitted for brevity]')
    .replace(/<[^>]+>/g, '')
    .trim();

  return (
    <div className="pr-detail-view-container">
      <style>{`
        .pr-detail-view-container {
          padding: 16px 20px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }
        .pr-header-card {
          margin-bottom: 14px;
          padding: 16px;
        }
        .pr-tabs-container {
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid var(--border-subtle);
          margin-bottom: 14px;
          overflow-x: auto;
          white-space: nowrap;
          flex-wrap: nowrap;
          padding-bottom: 2px;
          -webkit-overflow-scrolling: touch;
        }
        .pr-tab-btn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          font-size: 12px;
          border-radius: var(--radius-md) var(--radius-md) 0 0;
          cursor: pointer;
        }
        @media (max-width: 768px) {
          .pr-detail-view-container {
            padding: 10px 8px !important;
          }
          .pr-header-card {
            padding: 12px 10px !important;
            margin-bottom: 10px !important;
          }
        }
      `}</style>

      {/* Top Breadcrumb & Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}>
          <ArrowLeft size={14} />
          <span>PRs</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleOpenChat} title="Chat about this PR" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MessageSquare size={13} />
            <span className="hide-on-compact">Chat</span>
          </button>
          <a
            href={pr.html_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            title="Open on GitHub"
          >
            <span className="hide-on-compact">GitHub #{pr.number}</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* PR Header Card */}
      <div className="card pr-header-card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span className={`badge ${pr.state === 'open' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                {pr.state.toUpperCase()}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                #{pr.number}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {pr.base.ref} &larr; <code style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '4px', fontSize: '11px', wordBreak: 'break-all' }}>{pr.head.ref}</code>
              </span>
            </div>

            <h1 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.3 }}>
              {pr.title}
            </h1>

            {cleanBody && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <p style={{ maxHeight: isDescriptionExpanded ? 'none' : '36px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cleanBody}
                </p>
                {cleanBody.length > 90 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    style={{ padding: '2px 0', fontSize: '11px', color: 'var(--accent-primary)', marginTop: '2px' }}
                  >
                    {isDescriptionExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    <span>{isDescriptionExpanded ? 'Show less' : 'Read description'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRunAIReview}
              disabled={isAnalyzing || isLoadingDiff}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', fontSize: '12px' }}
            >
              <Sparkles size={14} className={isAnalyzing ? 'spin' : ''} />
              <span>{isAnalyzing ? 'Analyzing...' : reviewReport ? 'Re-Run Review' : 'Run AI Review'}</span>
            </button>
            {reviewReport && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsSubmitModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '12px' }}
                title="Submit Review to GitHub"
              >
                <Send size={13} />
                <span className="hide-on-compact">Submit to GitHub</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Bar */}
        {reviewReport && (
          <div
            style={{
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <RiskBadge risk={reviewReport.overallRisk} />
              <ReadinessScore score={reviewReport.mergeReadinessScore} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {reviewReport.findings.length} findings
              </span>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Model: <strong>{reviewReport.model}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Prominent Tab Navigation (Smooth Horizontal Swipeable on Mobile) */}
      <div className="pr-tabs-container">
        <button
          className={`pr-tab-btn ${activeTab === 'diff' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('diff')}
          style={{
            borderBottom: activeTab === 'diff' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontWeight: activeTab === 'diff' ? 600 : 500,
          }}
        >
          <FileCode size={14} style={{ color: activeTab === 'diff' ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
          <span>Files & Diff ({diffFiles.length})</span>
        </button>

        <button
          className={`pr-tab-btn ${activeTab === 'review' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('review')}
          style={{
            borderBottom: activeTab === 'review' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontWeight: activeTab === 'review' ? 600 : 500,
          }}
        >
          <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
          <span>AI Review Analysis</span>
          {reviewReport && (
            <span className={`badge ${reviewReport.findings.length > 0 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '9px', padding: '0 5px' }}>
              {reviewReport.findings.length}
            </span>
          )}
        </button>

        <button
          className={`pr-tab-btn ${activeTab === 'commits' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('commits')}
          style={{
            borderBottom: activeTab === 'commits' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontWeight: activeTab === 'commits' ? 600 : 500,
          }}
        >
          <GitCommit size={14} />
          <span>Commits ({commits.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {isLoadingDiff ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={22} className="spin" style={{ margin: '0 auto 10px' }} />
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
              <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Sparkles size={32} style={{ margin: '0 auto 10px', color: 'var(--accent-primary)' }} />
                <h3>No AI Review Report Generated Yet</h3>
                <p style={{ fontSize: '12px', marginTop: '4px', maxWidth: '440px', margin: '4px auto 14px' }}>
                  Click "Run AI Review" above to run an automated multi-vector analysis across security, performance, bug risks, edge cases, and suggested line comments.
                </p>
                <button className="btn btn-primary btn-sm" onClick={handleRunAIReview} disabled={isAnalyzing}>
                  <Sparkles size={13} />
                  <span>Run AI Code Review Now</span>
                </button>
              </div>
            )
          )}

          {activeTab === 'commits' && (
            <div className="card" style={{ padding: '14px' }}>
              <h3 style={{ fontSize: '13px', marginBottom: '10px' }}>Commits in this Pull Request</h3>
              {commits.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  Commit {pr.head?.sha?.slice(0, 7) || 'HEAD'}: {pr.title}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {commits.map((c) => (
                    <div
                      key={c.sha}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
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
