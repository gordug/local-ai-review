import React, { useState, useEffect } from 'react';
import { CachedPRReview } from '../../types/storage';
import { localDb } from '../../services/storage/localDb';
import { RiskBadge, ReadinessScore } from '../common/RiskGauge';
import {
  BookmarkCheck,
  GitPullRequest,
  Trash2,
  ExternalLink,
  Sparkles,
  Search,
  Download,
  Copy,
  Check,
} from 'lucide-react';

interface SavedReviewsViewProps {
  repoFullName: string;
  onOpenPRReview: (review: CachedPRReview) => void;
}

export const SavedReviewsView: React.FC<SavedReviewsViewProps> = ({ repoFullName, onOpenPRReview }) => {
  const [reviews, setReviews] = useState<CachedPRReview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSavedReviews();
  }, [repoFullName]);

  const loadSavedReviews = async () => {
    setIsLoading(true);
    try {
      const data = await localDb.getReviewsForRepo(repoFullName);
      setReviews(data.sort((a, b) => b.savedAt - a.savedAt));
    } catch {
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = reviews.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.report.executiveSummary.toLowerCase().includes(q) ||
      (r.prNumber && r.prNumber.toString().includes(q)) ||
      r.report.model.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookmarkCheck size={22} style={{ color: 'var(--accent-primary)' }} />
            <span>Saved Offline Reviews</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Browse past AI reviews and audit reports cached locally for <strong>{repoFullName}</strong>
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <BookmarkCheck size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <h3>No Cached Reviews Yet</h3>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Run an AI Code Review on any Pull Request to automatically cache the full report for offline viewing.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((r) => (
            <div
              key={r.id}
              onClick={() => onOpenPRReview(r)}
              className="card"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <GitPullRequest size={16} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>
                    Pull Request #{r.prNumber || 'Review'}
                  </span>
                  <RiskBadge risk={r.report.overallRisk} />
                  <ReadinessScore score={r.report.mergeReadinessScore} />
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '8px' }}>
                  {r.report.executiveSummary.slice(0, 180)}...
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Model: {r.report.model}</span>
                  <span>Findings: {r.report.findings.length}</span>
                  <span>Saved: {new Date(r.savedAt).toLocaleString()}</span>
                </div>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={() => onOpenPRReview(r)}>
                <span>View Report</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
