import React, { useState } from 'react';
import { AIReviewReport, ReviewFinding } from '../../types/ai';
import { RiskBadge, ReadinessScore } from '../common/RiskGauge';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle2,
  FileCheck,
  Copy,
  Check,
  Download,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  Send,
} from 'lucide-react';

interface AIReviewReportViewProps {
  report: AIReviewReport;
  onExportMarkdown?: () => void;
  onOpenSubmitModal?: () => void;
}

export const AIReviewReportView: React.FC<AIReviewReportViewProps> = ({
  report,
  onExportMarkdown,
  onOpenSubmitModal,
}) => {
  const [copiedPatchIdx, setCopiedPatchIdx] = useState<number | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const copyPatch = (idx: number, patch: string) => {
    navigator.clipboard.writeText(patch);
    setCopiedPatchIdx(idx);
    setTimeout(() => setCopiedPatchIdx(null), 2000);
  };

  const copyFullMarkdown = () => {
    const md = generateMarkdownSummary(report);
    navigator.clipboard.writeText(md);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const downloadMarkdown = () => {
    const md = generateMarkdownSummary(report);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-report-${report.repoFullName.replace('/', '-')}-pr-${report.prNumber || 'review'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const securityFindings = report.findings.filter((f) => f.category === 'security');
  const performanceFindings = report.findings.filter((f) => f.category === 'performance');
  const bugFindings = report.findings.filter((f) => f.category === 'bug_risk');
  const otherFindings = report.findings.filter(
    (f) => !['security', 'performance', 'bug_risk'].includes(f.category)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Banner & Highlights */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          borderLeft: `4px solid ${
            report.overallRisk === 'critical' || report.overallRisk === 'high'
              ? 'var(--danger-text)'
              : report.overallRisk === 'medium'
              ? 'var(--warning-text)'
              : 'var(--success-text)'
          }`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RiskBadge risk={report.overallRisk} />
            <ReadinessScore score={report.mergeReadinessScore} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Confidence: {report.confidenceScore}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenSubmitModal && (
              <button
                className="btn btn-primary btn-sm"
                onClick={onOpenSubmitModal}
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                title="Post structured AI review to GitHub"
              >
                <Send size={13} />
                <span>Submit to GitHub</span>
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={copyFullMarkdown}>
              {copiedReport ? <Check size={13} style={{ color: 'var(--success-text)' }} /> : <Copy size={13} />}
              <span className="hide-on-compact">{copiedReport ? 'Copied' : 'Copy Report'}</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={downloadMarkdown} title="Download .md report">
              <Download size={13} />
              <span className="hide-on-compact">Download .md</span>
            </button>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '15px', marginBottom: '6px' }}>Executive Summary</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '13px', whiteSpace: 'pre-wrap' }}>
            {report.executiveSummary}
          </p>
        </div>

        {report.isDeterministicFallback && (
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Cpu size={13} style={{ color: 'var(--info-text)' }} />
            <span>Generated using 100% client-side AST Static Analysis engine ($0 compute).</span>
          </div>
        )}
      </div>

      {/* Architecture Summary & Key Strengths Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
            <h4 style={{ fontSize: '13px' }}>Architecture & Impact</h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {report.architectureSummary}
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--success-text)' }} />
            <h4 style={{ fontSize: '13px' }}>Key Strengths</h4>
          </div>
          {report.keyStrengths.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No specific strengths highlighted.</p>
          ) : (
            <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {report.keyStrengths.map((str, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>{str}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Findings Sections */}
      {/* 0 Findings Clean Code Celebration State */}
      {report.findings.length === 0 && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--success-bg)',
            borderColor: 'var(--success-border)',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <CheckCircle2 size={20} style={{ color: 'var(--success-text)' }} />
            <h3 style={{ fontSize: '15px', color: 'var(--success-text)' }}>
              Clean Review: All Security & Quality Checks Passed
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px', lineHeight: 1.4 }}>
            No critical security vulnerabilities, secret leaks, raw injection hazards, or unhandled exceptions were identified in this changeset.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} style={{ color: 'var(--success-text)' }} />
              <span>Zero hardcoded secrets or API tokens</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} style={{ color: 'var(--success-text)' }} />
              <span>Zero SQL / command injection patterns</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} style={{ color: 'var(--success-text)' }} />
              <span>Safe dependency & workflow changes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} style={{ color: 'var(--success-text)' }} />
              <span>No silent exception swallows</span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Security Findings */}
      {securityFindings.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--danger-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--danger-text)' }} />
            <h3 style={{ fontSize: '14px', color: 'var(--danger-text)' }}>
              Security Findings ({securityFindings.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {securityFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        </div>
      )}

      {/* 2. Performance Findings */}
      {performanceFindings.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Zap size={18} style={{ color: 'var(--warning-text)' }} />
            <h3 style={{ fontSize: '14px' }}>Performance & Concurrency ({performanceFindings.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {performanceFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        </div>
      )}

      {/* 3. Bug Risks & Code Quality */}
      {(bugFindings.length > 0 || otherFindings.length > 0) && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--info-text)' }} />
            <h3 style={{ fontSize: '14px' }}>
              Bug Risks & Code Smells ({bugFindings.length + otherFindings.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...bugFindings, ...otherFindings].map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        </div>
      )}

      {/* Suggested Tests */}
      {report.suggestedTests.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <FileCheck size={16} style={{ color: 'var(--accent-primary)' }} />
            <h4 style={{ fontSize: '13px' }}>Recommended Test Coverage</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {report.suggestedTests.map((test, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>#{idx + 1}</span>
                <span>{test}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Patches */}
      {report.suggestedPatches.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Terminal size={16} style={{ color: 'var(--success-text)' }} />
            <h4 style={{ fontSize: '13px' }}>Ready-to-Apply Patches ({report.suggestedPatches.length})</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report.suggestedPatches.map((patch, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{patch.file}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => copyPatch(idx, patch.patch)}
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                  >
                    {copiedPatchIdx === idx ? <Check size={12} style={{ color: 'var(--success-text)' }} /> : <Copy size={12} />}
                    <span>{copiedPatchIdx === idx ? 'Copied Patch' : 'Copy Patch'}</span>
                  </button>
                </div>
                <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {patch.description}
                </div>
                <pre
                  style={{
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--bg-secondary)',
                    overflowX: 'auto',
                    color: 'var(--text-primary)',
                  }}
                >
                  {patch.patch}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FindingCard: React.FC<{ finding: ReviewFinding }> = ({ finding }) => {
  return (
    <div
      style={{
        padding: '10px 14px',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{finding.title}</span>
          {finding.file && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              {finding.file}{finding.line ? `:${finding.line}` : ''}
            </span>
          )}
        </div>
        <RiskBadge risk={finding.severity} />
      </div>

      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: finding.suggestion ? '6px' : 0 }}>
        {finding.description}
      </p>

      {finding.suggestion && (
        <div
          style={{
            marginTop: '4px',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '3px solid var(--accent-primary)',
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--accent-primary)', marginRight: '6px' }}>Recommendation:</span>
          {finding.suggestion}
        </div>
      )}
    </div>
  );
};

function generateMarkdownSummary(report: AIReviewReport): string {
  let md = `# AI Code Review: ${report.repoFullName} (PR #${report.prNumber || ''})\n\n`;
  md += `**Overall Risk:** ${report.overallRisk.toUpperCase()} | **Merge Readiness:** ${report.mergeReadinessScore}%\n`;
  md += `**Model:** ${report.model} | **Timestamp:** ${new Date(report.timestamp).toLocaleString()}\n\n`;
  md += `## Executive Summary\n${report.executiveSummary}\n\n`;
  md += `## Architecture & Maintainability\n${report.architectureSummary}\n\n`;

  if (report.findings.length > 0) {
    md += `## Key Findings (${report.findings.length})\n\n`;
    for (const f of report.findings) {
      md += `### [${f.severity.toUpperCase()}] ${f.title}\n`;
      if (f.file) md += `**File:** \`${f.file}${f.line ? `:${f.line}` : ''}\`\n`;
      md += `${f.description}\n\n`;
      if (f.suggestion) md += `> **Recommendation:** ${f.suggestion}\n\n`;
    }
  }

  if (report.suggestedTests.length > 0) {
    md += `## Recommended Tests\n`;
    for (const t of report.suggestedTests) {
      md += `- ${t}\n`;
    }
    md += '\n';
  }

  return md;
}
