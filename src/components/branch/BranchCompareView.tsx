import React, { useState, useEffect } from 'react';
import { GitHubBranch, GitHubCompareResult, ParsedFileDiff } from '../../types/github';
import { BranchMergeAnalysis } from '../../types/ai';
import { AppSettings } from '../../types/storage';
import { githubClient } from '../../services/github/githubClient';
import { parseGitDiff, parseFilePatch } from '../../services/github/diffParser';
import { aiRouter } from '../../services/ai/aiRouter';
import { localDb } from '../../services/storage/localDb';
import { DiffViewer } from '../pr/DiffViewer';
import { ReadinessScore, RiskBadge } from '../common/RiskGauge';
import {
  GitCompare,
  ArrowRight,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Flame,
  CheckCircle2,
  FileCode,
  GitCommit,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface BranchCompareViewProps {
  repoFullName: string;
  settings: AppSettings;
  onOpenChatWithContext: (contextPrompt: string, compareId: string) => void;
}

export const BranchCompareView: React.FC<BranchCompareViewProps> = ({
  repoFullName,
  settings,
  onOpenChatWithContext,
}) => {
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [baseBranch, setBaseBranch] = useState('main');
  const [compareBranch, setCompareBranch] = useState('');
  const [compareResult, setCompareResult] = useState<GitHubCompareResult | null>(null);
  const [diffFiles, setDiffFiles] = useState<ParsedFileDiff[]>([]);
  const [analysis, setAnalysis] = useState<BranchMergeAnalysis | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load branches
  useEffect(() => {
    loadBranches();
  }, [repoFullName]);

  const loadBranches = async () => {
    setIsLoadingBranches(true);
    setError(null);
    const [owner, repo] = repoFullName.split('/');

    try {
      const branchList = await githubClient.getBranches(owner, repo);
      setBranches(branchList);
      if (branchList.length > 0) {
        setBaseBranch(branchList.some((b) => b.name === 'main') ? 'main' : branchList[0].name);
        const secondBranch = branchList.find((b) => b.name !== 'main') || branchList[0];
        setCompareBranch(secondBranch.name);
      }
    } catch (e: any) {
      console.warn('Failed to load branches:', e);
      // Fallback demo branches
      const demoBranches = [
        { name: 'main', commit: { sha: 'a11111', url: '' } },
        { name: 'develop', commit: { sha: 'b22222', url: '' } },
        { name: 'feature/payment-v2', commit: { sha: 'c33333', url: '' } },
        { name: 'bugfix/auth-leak', commit: { sha: 'd44444', url: '' } },
      ];
      setBranches(demoBranches);
      setBaseBranch('main');
      setCompareBranch('feature/payment-v2');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleCompare = async () => {
    if (!baseBranch || !compareBranch) return;
    if (baseBranch === compareBranch) {
      setError('Base branch and Compare branch must be different.');
      return;
    }

    setIsComparing(true);
    setError(null);
    const [owner, repo] = repoFullName.split('/');

    try {
      // Check cache first
      const cached = await localDb.getBranchCompare(`${repoFullName}#${baseBranch}..${compareBranch}`);
      if (cached) {
        setAnalysis(cached.analysis);
      } else {
        setAnalysis(null);
      }

      let res: GitHubCompareResult | null = null;
      let rawDiff = '';

      try {
        res = await githubClient.compareBranches(owner, repo, baseBranch, compareBranch);
        rawDiff = await githubClient.getCompareDiff(owner, repo, baseBranch, compareBranch).catch(() => '');
      } catch (compareErr) {
        console.warn('Compare API fallback to demo comparison:', compareErr);
      }

      if (res && res.files) {
        setCompareResult(res);
        const parsed = rawDiff ? parseGitDiff(rawDiff) : res.files.map(parseFilePatch);
        setDiffFiles(parsed);
      } else {
        // Mock comparison data
        const demoRes = getDemoCompareResult(baseBranch, compareBranch);
        setCompareResult(demoRes);
        setDiffFiles(demoRes.files.map(parseFilePatch));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to compare branches');
    } finally {
      setIsComparing(false);
    }
  };

  const handleRunAIMergeAnalysis = async () => {
    if (!compareResult) return;
    setIsAnalyzingAI(true);
    setError(null);

    try {
      const result = await aiRouter.compareBranches(
        settings,
        repoFullName,
        baseBranch,
        compareBranch,
        compareResult.ahead_by,
        compareResult.behind_by,
        compareResult.commits.map((c) => ({
          message: c.commit.message,
          author: c.commit.author.name,
        })),
        diffFiles
      );

      setAnalysis(result);

      // Save to IndexedDB
      await localDb.saveBranchCompare({
        id: `${repoFullName}#${baseBranch}..${compareBranch}`,
        repoFullName,
        baseBranch,
        compareBranch,
        analysis: result,
        savedAt: Date.now(),
      });
    } catch (e: any) {
      setError(e.message || 'AI merge analysis failed.');
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const handleOpenChat = () => {
    if (!analysis) return;
    const prompt = `Branch Comparison: ${baseBranch} <- ${compareBranch} in ${repoFullName}
Ahead: ${analysis.aheadBy}, Behind: ${analysis.behindBy}
Merge Readiness: ${analysis.mergeReadiness.toUpperCase()} (${analysis.readinessScore}%)
Executive Summary: ${analysis.executiveSummary}
Breaking Changes: ${analysis.breakingChanges.map((b) => b.description).join(', ')}`;
    onOpenChatWithContext(prompt, `${baseBranch}..${compareBranch}`);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', width: '100%' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitCompare size={22} style={{ color: 'var(--accent-primary)' }} />
          <span>Branch Merge Comparator</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
          Evaluate merge readiness, conflict hotspots, and breaking schema/API changes before merging branches in <strong>{repoFullName}</strong>
        </p>
      </div>

      {/* Branch Selection Bar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Base Branch */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Base Target Branch (into)
            </label>
            <select
              className="select"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '20px' }}>
            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* Compare Branch */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Compare Feature Branch (from)
            </label>
            <select
              className="select"
              value={compareBranch}
              onChange={(e) => setCompareBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Compare Button */}
          <div style={{ paddingTop: '20px' }}>
            <button
              className="btn btn-primary"
              onClick={handleCompare}
              disabled={isComparing || !baseBranch || !compareBranch}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
            >
              <GitCompare size={15} />
              <span>{isComparing ? 'Comparing...' : 'Compare Branches'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '12px',
            color: 'var(--danger-text)',
          }}
        >
          {error}
        </div>
      )}

      {/* Comparison Results */}
      {compareResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Comparison Status Card */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>COMMITS AHEAD</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success-text)' }}>
                  +{compareResult.ahead_by}
                </span>
              </div>
              <div style={{ height: '30px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>COMMITS BEHIND</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: compareResult.behind_by > 10 ? 'var(--warning-text)' : 'var(--text-secondary)' }}>
                  -{compareResult.behind_by}
                </span>
              </div>
              <div style={{ height: '30px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>MODIFIED FILES</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {diffFiles.length}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {analysis && (
                <button className="btn btn-secondary btn-sm" onClick={handleOpenChat}>
                  <span>Chat about this Merge</span>
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={handleRunAIMergeAnalysis}
                disabled={isAnalyzingAI}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} className={isAnalyzingAI ? 'spin' : ''} />
                <span>{isAnalyzingAI ? 'Analyzing Merge Safety...' : analysis ? 'Re-Analyze Merge Risk' : 'Run AI Merge Safety Analysis'}</span>
              </button>
            </div>
          </div>

          {/* AI Merge Intelligence Report */}
          {analysis && (
            <div
              className="card"
              style={{
                borderLeft: `4px solid ${
                  analysis.mergeReadiness === 'ready'
                    ? 'var(--success-text)'
                    : analysis.mergeReadiness === 'caution'
                    ? 'var(--warning-text)'
                    : 'var(--danger-text)'
                }`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className={`badge ${
                      analysis.mergeReadiness === 'ready'
                        ? 'badge-success'
                        : analysis.mergeReadiness === 'caution'
                        ? 'badge-warning'
                        : 'badge-danger'
                    }`}
                    style={{ fontSize: '12px', padding: '4px 10px', textTransform: 'uppercase' }}
                  >
                    {analysis.mergeReadiness === 'ready' && <CheckCircle2 size={13} />}
                    {analysis.mergeReadiness === 'caution' && <AlertTriangle size={13} />}
                    {analysis.mergeReadiness === 'high_risk' && <Flame size={13} />}
                    Status: {analysis.mergeReadiness.replace('_', ' ')}
                  </span>
                  <ReadinessScore score={analysis.readinessScore} label="Merge Safety Score" />
                </div>

                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Evaluated via {analysis.model}
                </span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Executive Merge Summary</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {analysis.executiveSummary}
                </p>
              </div>

              {/* Conflict Risks & Breaking Changes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                {/* Conflict risks */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '12px', color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <AlertTriangle size={14} />
                    <span>Conflict Hotspots ({analysis.conflictRisks.length})</span>
                  </h4>
                  {analysis.conflictRisks.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No high probability file collisions predicted.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {analysis.conflictRisks.map((cr, i) => (
                        <div key={i} style={{ fontSize: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                          <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{cr.file}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{cr.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Breaking Changes */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '12px', color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Flame size={14} />
                    <span>Breaking Changes ({analysis.breakingChanges.length})</span>
                  </h4>
                  {analysis.breakingChanges.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No public API or schema breaking modifications detected.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {analysis.breakingChanges.map((bc, i) => (
                        <div key={i} style={{ fontSize: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--danger-text)', textTransform: 'uppercase', fontSize: '11px' }}>
                            [{bc.type}]
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>{bc.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recommended Steps */}
              {analysis.recommendedSteps.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Recommended Merge Workflow:
                  </h4>
                  <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {analysis.recommendedSteps.map((step, i) => (
                      <li key={i} style={{ marginBottom: '2px' }}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Cumulative Diff Viewer */}
          <div>
            <h3 style={{ fontSize: '15px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCode size={16} style={{ color: 'var(--accent-primary)' }} />
              <span>Cumulative Branch Diff ({diffFiles.length} files)</span>
            </h3>
            <DiffViewer files={diffFiles} defaultViewMode={settings.diffViewMode} />
          </div>
        </div>
      )}
    </div>
  );
};

function getDemoCompareResult(base: string, compare: string): GitHubCompareResult {
  return {
    url: '',
    html_url: '',
    status: 'ahead',
    ahead_by: 4,
    behind_by: 2,
    total_commits: 4,
    commits: [
      {
        sha: '7f8a91b',
        commit: {
          author: { name: 'Alex Dev', email: 'alex@example.com', date: new Date().toISOString() },
          message: 'feat(payments): add idempotent stripe webhook handler',
        },
        author: null,
        html_url: '',
      },
      {
        sha: '6e5d4c3',
        commit: {
          author: { name: 'Sarah Core', email: 'sarah@example.com', date: new Date().toISOString() },
          message: 'refactor(schema): migrate customer balance column to bigint',
        },
        author: null,
        html_url: '',
      },
    ],
    files: [
      {
        sha: '112233',
        filename: 'src/services/payments/webhookHandler.ts',
        status: 'added',
        additions: 82,
        deletions: 0,
        changes: 82,
        patch: `@@ -0,0 +1,15 @@\n+export async function handleStripeWebhook(event: any) {\n+  if (!event || !event.type) throw new Error('Malformed payload');\n+  // Process idempotent event\n+  return { received: true };\n+}`,
      },
      {
        sha: '445566',
        filename: 'prisma/migrations/20260817_balance_bigint/migration.sql',
        status: 'added',
        additions: 12,
        deletions: 2,
        changes: 14,
        patch: `@@ -1,4 +1,4 @@\n-ALTER TABLE customers ALTER COLUMN balance TYPE INTEGER;\n+ALTER TABLE customers ALTER COLUMN balance TYPE BIGINT;`,
      },
    ],
  };
}
