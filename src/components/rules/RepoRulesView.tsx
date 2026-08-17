import React, { useState, useEffect } from 'react';
import { AppSettings, RepoRule } from '../../types/storage';
import { localDb } from '../../services/storage/localDb';
import {
  FileCode2,
  Shield,
  Save,
  Check,
  Sparkles,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

interface RepoRulesViewProps {
  repoFullName: string;
  settings: AppSettings;
  onSaveSettings: (settings: Partial<AppSettings>) => void;
}

export const RepoRulesView: React.FC<RepoRulesViewProps> = ({
  repoFullName,
  settings,
  onSaveSettings,
}) => {
  const [guidelines, setGuidelines] = useState(settings.customGuidelines);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setGuidelines(settings.customGuidelines);
  }, [settings.customGuidelines]);

  const handleSave = () => {
    onSaveSettings({ customGuidelines: guidelines });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const applyTemplate = (tpl: string) => {
    setGuidelines(tpl);
  };

  const templates = [
    {
      name: 'Strict TypeScript & Zero Any',
      text: 'Enforce strict TypeScript type safety. Flag any usage of `any` type, recommend explicit interfaces, require readonly arrays where appropriate, and ensure all async functions handle error states.',
    },
    {
      name: 'High Security & OWASP Top 10',
      text: 'Conduct high-rigor security checks. Scrutinize input validation, SQL/NoSQL injection risks, SSRF, XSS hazards, prototype pollution, hardcoded credentials, and missing rate-limiting or authorization guards.',
    },
    {
      name: 'Junior-Friendly Mentorship',
      text: 'Provide friendly, encouraging, and educational feedback. Clearly explain why certain design patterns are preferred, provide concrete before/after code examples, and celebrate clean implementations.',
    },
    {
      name: 'High-Performance & Concurrency',
      text: 'Focus on memory usage, algorithmic complexity (O(N^2) loops), avoidable allocations, unindexed database queries, race conditions, and unoptimized React re-renders.',
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileCode2 size={22} style={{ color: 'var(--accent-primary)' }} />
          <span>Repository Review Rules & Prompts</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
          Configure custom review rules, coding standards, and persona instructions for <strong>{repoFullName}</strong>
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Preset Templates */}
        <div className="card">
          <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Quick Rule Presets</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {templates.map((tpl) => (
              <button
                key={tpl.name}
                className="btn btn-secondary btn-sm"
                onClick={() => applyTemplate(tpl.text)}
                style={{
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  height: 'auto',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{tpl.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3 }}>{tpl.text.slice(0, 70)}...</span>
              </button>
            ))}
          </div>
        </div>

        {/* Guidelines Editor */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '14px' }}>Active System Review Guidelines</h3>
            <button className="btn btn-primary btn-sm" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isSaved ? <Check size={14} /> : <Save size={14} />}
              <span>{isSaved ? 'Rules Saved' : 'Save Rules'}</span>
            </button>
          </div>

          <textarea
            className="textarea"
            rows={10}
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="Write your custom review rules here..."
            style={{ fontSize: '13px', lineHeight: 1.5 }}
          />

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            💡 These instructions are automatically injected into system instructions for PR reviews, branch diffs, and interactive assistant chat inquiries.
          </div>
        </div>
      </div>
    </div>
  );
};
