import React from 'react';
import { RiskLevel } from '../../types/ai';
import { ShieldCheck, ShieldAlert, AlertTriangle, Flame } from 'lucide-react';

interface RiskBadgeProps {
  risk: RiskLevel;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk, className = '' }) => {
  switch (risk) {
    case 'low':
      return (
        <span className={`badge badge-success ${className}`}>
          <ShieldCheck size={12} />
          Low Risk
        </span>
      );
    case 'medium':
      return (
        <span className={`badge badge-warning ${className}`}>
          <AlertTriangle size={12} />
          Medium Risk
        </span>
      );
    case 'high':
      return (
        <span className={`badge badge-danger ${className}`}>
          <ShieldAlert size={12} />
          High Risk
        </span>
      );
    case 'critical':
      return (
        <span className={`badge badge-danger ${className}`} style={{ background: 'rgba(239, 68, 68, 0.25)', borderColor: '#ef4444' }}>
          <Flame size={12} />
          CRITICAL RISK
        </span>
      );
    default:
      return <span className={`badge badge-neutral ${className}`}>{risk}</span>;
  }
};

interface ReadinessScoreProps {
  score: number;
  label?: string;
}

export const ReadinessScore: React.FC<ReadinessScoreProps> = ({ score, label = 'Merge Readiness' }) => {
  let color = 'var(--success-text)';
  let bg = 'var(--success-bg)';
  if (score < 50) {
    color = 'var(--danger-text)';
    bg = 'var(--danger-bg)';
  } else if (score < 80) {
    color = 'var(--warning-text)';
    bg = 'var(--warning-bg)';
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: 'var(--radius-md)', background: bg, border: `1px solid ${color}40` }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}:</span>
      <span style={{ fontSize: '14px', fontWeight: 700, color }}>{score}%</span>
    </div>
  );
};
