import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../types/storage';
import { AIProviderType, AIProviderConfig } from '../../types/ai';
import { githubAuth, AuthValidationResult } from '../../services/github/githubAuth';
import { ollamaProvider } from '../../services/ai/providers/ollamaProvider';
import { lmStudioProvider } from '../../services/ai/providers/lmStudioProvider';
import { localDb } from '../../services/storage/localDb';
import {
  Settings,
  X,
  Cpu,
  Key,
  Database,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Download,
  Upload,
  Trash2,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { GithubIcon } from '../common/Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: Partial<AppSettings>) => void;
  initialTab?: string;
  onAuthSuccess?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  initialTab = 'github',
  onAuthSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'github' | 'ai' | 'rules' | 'storage'>('github');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenValidation, setTokenValidation] = useState<AuthValidationResult | null>(null);

  const [isScanningOllama, setIsScanningOllama] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isScanningLMStudio, setIsScanningLMStudio] = useState(false);
  const [lmStudioModels, setLmStudioModels] = useState<string[]>([]);

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  useEffect(() => {
    if (initialTab && ['github', 'ai', 'rules', 'storage'].includes(initialTab)) {
      setActiveTab(initialTab as any);
    }
    setFormData(settings);
  }, [isOpen, initialTab, settings]);

  if (!isOpen) return null;

  const handleProviderChange = (providerKey: string, field: keyof AIProviderConfig, value: any) => {
    setFormData((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerKey]: {
          ...prev.providers[providerKey],
          [field]: value,
        },
      },
    }));
  };

  const handleValidateGitHub = async () => {
    setIsValidatingToken(true);
    setTokenValidation(null);
    try {
      const result = await githubAuth.validateToken(formData.githubToken);
      setTokenValidation(result);
      if (result.valid) {
        onSaveSettings({ githubToken: formData.githubToken.trim() });
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (e: any) {
      setTokenValidation({
        valid: false,
        scopes: [],
        error: e.message || 'Validation failed',
      });
    } finally {
      setIsValidatingToken(false);
    }
  };

  const handleScanOllama = async () => {
    setIsScanningOllama(true);
    try {
      const endpoint = formData.providers.ollama?.endpoint || 'http://127.0.0.1:11434';
      const models = await ollamaProvider.listModels(endpoint);
      setOllamaModels(models);
      if (models.length > 0 && !models.includes(formData.providers.ollama.model)) {
        handleProviderChange('ollama', 'model', models[0]);
      }
    } catch {
      setOllamaModels([]);
    } finally {
      setIsScanningOllama(false);
    }
  };

  const handleScanLMStudio = async () => {
    setIsScanningLMStudio(true);
    try {
      const endpoint = formData.providers.lmstudio?.endpoint || 'http://127.0.0.1:1234/v1';
      const models = await lmStudioProvider.listModels(endpoint);
      setLmStudioModels(models);
      if (models.length > 0 && !models.includes(formData.providers.lmstudio.model)) {
        handleProviderChange('lmstudio', 'model', models[0]);
      }
    } catch {
      setLmStudioModels([]);
    } finally {
      setIsScanningLMStudio(false);
    }
  };

  const handleSaveAll = () => {
    onSaveSettings(formData);
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      onClose();
    }, 600);
  };

  const handleExportBackup = async () => {
    const json = await localDb.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      const success = await localDb.importFullBackup(content);
      if (success) {
        setImportStatus('Backup restored successfully! Reloading settings...');
        const updated = await localDb.getSettings();
        setFormData(updated);
        onSaveSettings(updated);
      } else {
        setImportStatus('Failed to import backup: invalid JSON format.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all local reviews, chat histories, and stored tokens? This cannot be undone.')) {
      await localDb.clearAllData();
      alert('All local data wiped successfully.');
      window.location.reload();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-tertiary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '15px' }}>Application Settings & BYOM AI Engine</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '0 12px',
          }}
        >
          <button
            className={`btn ${activeTab === 'github' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('github')}
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'github' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              padding: '10px 14px',
              fontSize: '12px',
            }}
          >
            <GithubIcon size={14} />
            <span>GitHub Auth</span>
          </button>

          <button
            className={`btn ${activeTab === 'ai' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('ai')}
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'ai' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              padding: '10px 14px',
              fontSize: '12px',
            }}
          >
            <Cpu size={14} />
            <span>BYOM Models</span>
          </button>

          <button
            className={`btn ${activeTab === 'rules' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('rules')}
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'rules' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              padding: '10px 14px',
              fontSize: '12px',
            }}
          >
            <Sliders size={14} />
            <span>Review Rules</span>
          </button>

          <button
            className={`btn ${activeTab === 'storage' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('storage')}
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'storage' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              padding: '10px 14px',
              fontSize: '12px',
            }}
          >
            <Database size={14} />
            <span>Privacy & Storage</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* TAB 1: GitHub Auth */}
          {activeTab === 'github' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <ShieldCheck size={18} style={{ color: 'var(--success-text)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>100% Client-Side Privacy:</strong> Your Personal Access Token (PAT) or OAuth token is stored strictly inside your browser's IndexedDB and is only transmitted directly to <code>api.github.com</code>.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Personal Access Token (Classic or Fine-Grained)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    className="input"
                    placeholder="ghp_... or github_pat_..."
                    value={formData.githubToken}
                    onChange={(e) => setFormData({ ...formData, githubToken: e.target.value })}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={handleValidateGitHub}
                    disabled={isValidatingToken || !formData.githubToken.trim()}
                  >
                    {isValidatingToken ? <RefreshCw size={13} className="spin" /> : <Key size={13} />}
                    <span>Test Token</span>
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Recommended scopes: <code>repo</code> (for private repos), <code>read:org</code>. Public repositories work without tokens with standard GitHub rate limits.
                </div>
              </div>

              {/* Token Validation Feedback */}
              {tokenValidation && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: tokenValidation.valid ? 'rgba(52, 211, 153, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${tokenValidation.valid ? 'var(--success-border)' : 'var(--danger-border)'}`,
                    fontSize: '12px',
                  }}
                >
                  {tokenValidation.valid ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-text)', fontWeight: 600, marginBottom: '4px' }}>
                        <Check size={15} />
                        <span>Connected to GitHub as @{tokenValidation.user?.login}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        Scopes: {tokenValidation.scopes.length > 0 ? tokenValidation.scopes.join(', ') : 'public_repo access only'}
                      </div>
                      {tokenValidation.rateLimit && (
                        <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                          Rate Limit Remaining: {tokenValidation.rateLimit.remaining} / {tokenValidation.rateLimit.limit}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger-text)' }}>
                      <AlertCircle size={15} />
                      <span>{tokenValidation.error || 'Token validation failed.'}</span>
                    </div>
                  )}
                </div>
              )}

              {/* OAuth Client ID Optional Setup */}
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Custom GitHub OAuth App Client ID (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Iv1.xxxxxxxxxxxx"
                  value={formData.githubOAuthClientId}
                  onChange={(e) => setFormData({ ...formData, githubOAuthClientId: e.target.value })}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  If configuring a custom GitHub OAuth Web Flow redirect for your team.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI Providers & BYOM */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Active Code Review AI Engine
                </label>
                <select
                  className="select"
                  value={formData.activeProvider}
                  onChange={(e) => setFormData({ ...formData, activeProvider: e.target.value })}
                >
                  <option value="deterministic">Deterministic AST Rule Engine ($0 Compute, 100% Offline)</option>
                  <option value="ollama">Localhost Ollama (Private Local AI)</option>
                  <option value="lmstudio">Localhost LM Studio / LocalAI</option>
                  <option value="gemini">Google Gemini (Direct API)</option>
                  <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                  <option value="anthropic">Anthropic Claude (Claude 3.5 / 3.7)</option>
                  <option value="groq">Groq (Ultra-Fast Llama 3.3 / Qwen Coder)</option>
                  <option value="deepseek">DeepSeek (DeepSeek-V3 / R1)</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">Custom OpenAI-Compatible Endpoint</option>
                </select>
              </div>

              {/* Provider specific configuration boxes */}
              {formData.activeProvider === 'deterministic' && (
                <div className="card" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Sparkles size={16} style={{ color: 'var(--success-text)' }} />
                    <h4 style={{ fontSize: '13px' }}>Deterministic AST Rule Engine</h4>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Analyzes git diffs, PRs, and branch comparisons using 100% client-side AST inspection, heuristic security audits (secret detection, injection patterns, XSS), and code smell metrics with <strong>$0 server cost</strong> and zero latency.
                  </p>
                </div>
              )}

              {formData.activeProvider === 'ollama' && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px' }}>Ollama Local AI Configuration</h4>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Ollama Endpoint URL
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.providers.ollama?.endpoint || 'http://127.0.0.1:11434'}
                      onChange={(e) => handleProviderChange('ollama', 'endpoint', e.target.value)}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Model</label>
                      <button className="btn btn-ghost btn-sm" onClick={handleScanOllama} disabled={isScanningOllama}>
                        <RefreshCw size={12} className={isScanningOllama ? 'spin' : ''} />
                        <span>Scan Installed Models</span>
                      </button>
                    </div>
                    {ollamaModels.length > 0 ? (
                      <select
                        className="select"
                        value={formData.providers.ollama?.model}
                        onChange={(e) => handleProviderChange('ollama', 'model', e.target.value)}
                      >
                        {ollamaModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. qwen2.5-coder:7b or deepseek-r1:8b"
                        value={formData.providers.ollama?.model || ''}
                        onChange={(e) => handleProviderChange('ollama', 'model', e.target.value)}
                      />
                    )}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                    💡 <strong>Ollama CORS Note:</strong> If your browser blocks calls to Ollama, start Ollama with:
                    <br />
                    <code>OLLAMA_ORIGINS="*" ollama serve</code>
                  </div>
                </div>
              )}

              {formData.activeProvider === 'lmstudio' && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px' }}>LM Studio / LocalAI Configuration</h4>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Endpoint URL
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.providers.lmstudio?.endpoint || 'http://127.0.0.1:1234/v1'}
                      onChange={(e) => handleProviderChange('lmstudio', 'endpoint', e.target.value)}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loaded Model</label>
                      <button className="btn btn-ghost btn-sm" onClick={handleScanLMStudio} disabled={isScanningLMStudio}>
                        <RefreshCw size={12} className={isScanningLMStudio ? 'spin' : ''} />
                        <span>Scan Models</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. default or deepseek-coder"
                      value={formData.providers.lmstudio?.model || ''}
                      onChange={(e) => handleProviderChange('lmstudio', 'model', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {formData.activeProvider === 'gemini' && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px' }}>Google Gemini Direct API (BYOK)</h4>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Gemini API Key
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="AIzaSy..."
                      value={formData.providers.gemini?.apiKey || ''}
                      onChange={(e) => handleProviderChange('gemini', 'apiKey', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Model
                    </label>
                    <select
                      className="select"
                      value={formData.providers.gemini?.model || 'gemini-2.5-flash'}
                      onChange={(e) => handleProviderChange('gemini', 'model', e.target.value)}
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast, Code-optimized)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep reasoning)</option>
                    </select>
                  </div>
                </div>
              )}

              {['openai', 'groq', 'deepseek', 'openrouter', 'anthropic', 'custom'].includes(formData.activeProvider) && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px', textTransform: 'capitalize' }}>
                    {formData.activeProvider} API Configuration
                  </h4>

                  {formData.activeProvider === 'custom' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Custom Endpoint URL
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="http://localhost:8000/v1"
                        value={formData.providers.custom?.endpoint || ''}
                        onChange={(e) => handleProviderChange('custom', 'endpoint', e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      API Key
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="API Key..."
                      value={formData.providers[formData.activeProvider]?.apiKey || ''}
                      onChange={(e) => handleProviderChange(formData.activeProvider, 'apiKey', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Model Name
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.providers[formData.activeProvider]?.model || ''}
                      onChange={(e) => handleProviderChange(formData.activeProvider, 'model', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Review Guidelines */}
          {activeTab === 'rules' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Custom Code Review Guidelines & System Rules
                </label>
                <textarea
                  className="textarea"
                  rows={6}
                  value={formData.customGuidelines}
                  onChange={(e) => setFormData({ ...formData, customGuidelines: e.target.value })}
                  placeholder="e.g. Enforce strict TypeScript types, forbid any, catch subtle race conditions..."
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  These instructions are automatically injected into every AI review prompt, branch compare, and chat inquiry.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Default Diff View Mode
                </label>
                <select
                  className="select"
                  value={formData.diffViewMode}
                  onChange={(e) => setFormData({ ...formData, diffViewMode: e.target.value as any })}
                >
                  <option value="split">Split (Side-by-Side)</option>
                  <option value="unified">Unified</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 4: Privacy & Local Storage */}
          {activeTab === 'storage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <h4 style={{ fontSize: '13px', marginBottom: '6px', color: 'var(--success-text)' }}>
                  Zero-Cloud Persistence Guarantee
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  RevFlow stores zero telemetry, zero tokens, and zero review history on any remote server. Everything is safely contained in this browser's local IndexedDB instance.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={handleExportBackup} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={14} />
                  <span>Export JSON Backup</span>
                </button>

                <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <Upload size={14} />
                  <span>Import JSON Backup</span>
                  <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
                </label>
              </div>

              {importStatus && (
                <div style={{ fontSize: '12px', color: 'var(--info-text)' }}>{importStatus}</div>
              )}

              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '13px', color: 'var(--danger-text)', marginBottom: '6px' }}>
                  Danger Zone
                </h4>
                <button className="btn btn-danger btn-sm" onClick={handleClearAll} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={13} />
                  <span>Wipe All Local Storage Data</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {saveToast ? (
            <span style={{ fontSize: '12px', color: 'var(--success-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={14} /> Settings Saved
            </span>
          ) : (
            <span />
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveAll}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
