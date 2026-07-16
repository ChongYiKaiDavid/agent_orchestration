import React, { useEffect, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Check, Save, ExternalLink } from 'lucide-react';
import { fetchConfig, saveConfig, fetchPipelines } from '../api';

type Config = Record<string, string>;

interface Field {
  key: string;
  label: string;
  secret?: boolean;
  type?: 'toggle';
  readonly?: boolean;
  hint?: string;
}

interface Section {
  id: string;
  label: string;
  icon: string;
  description?: string;
  fields: Field[];
  tag?: 'integration';
}

/** Grouped, ordered sections with inline hints for clarity */
const SECTIONS: Section[] = [
  {
    id: 'project',
    label: 'Project',
    icon: '⊞',
    description: 'Basic identity settings for this project.',
    fields: [
      { key: 'PROJECT_NAME', label: 'Project Name', hint: 'Used as the internal identifier (no spaces).' },
      { key: 'DISPLAY_NAME', label: 'Display Name', hint: 'Human-readable title shown in the UI.' },
    ],
  },
  {
    id: 'git',
    label: 'Git',
    icon: '⎇',
    description: 'Source control settings for branch management and PR creation.',
    fields: [
      { key: 'GIT_ENABLED', label: 'Enable Git Integration', type: 'toggle' },
      { key: 'TARGET_BRANCH', label: 'Default Target Branch', hint: 'Usually main or master.' },
      { key: 'BRANCH_PATTERN', label: 'Branch Pattern', hint: 'e.g. feature/{task_id}' },
      { key: 'RELEASE_BRANCH_ENABLED', label: 'Enable Release Branch Workflow', type: 'toggle' },
      { key: 'DEFAULT_RELEASE_BRANCH', label: 'Default Release Branch', hint: 'e.g. release/v1.0' },
    ],
  },
  {
    id: 'runtime',
    label: 'Runtime',
    icon: '▶',
    description: 'Configure the execution environment for AI agents.',
    fields: [
      { key: 'CLI_EXECUTABLE', label: 'CLI Executable', hint: 'The command used to run the agent (e.g. devin).' },
      { key: 'MODEL', label: 'Model', hint: 'Override the default model (optional).' },
      { key: 'PIPELINE_AGENT_ID', label: 'Pipeline Agent' },
    ],
  },
  {
    id: 'github',
    label: 'GitHub',
    icon: '◎',
    tag: 'integration',
    fields: [
      { key: 'GITHUB_TOKEN', label: 'Personal Access Token', secret: true, hint: 'Needs repo and pull_request scopes.' },
    ],
  },
  {
    id: 'jira',
    label: 'Jira',
    icon: '◈',
    tag: 'integration',
    fields: [
      { key: 'JIRA_BASE_URL', label: 'Base URL', hint: 'e.g. https://yourorg.atlassian.net' },
      { key: 'JIRA_USER', label: 'User Email' },
      { key: 'JIRA_API_TOKEN', label: 'API Token', secret: true },
      { key: 'JIRA_SPACE_KEYS', label: 'Space Keys', hint: 'Comma-separated project keys to filter (optional).' },
      { key: 'JIRA_REPO_MAPPING', label: 'Project → Repository Mapping', hint: 'JSON object mapping Jira project keys to repo names.' },
      { key: 'JIRA_DEMO_MODE', label: 'Use Built-in Demo Issues', type: 'toggle' },
    ],
  },
  {
    id: 'bitbucket',
    label: 'Bitbucket',
    icon: '◈',
    tag: 'integration',
    fields: [
      { key: 'BITBUCKET_USERNAME', label: 'Username' },
      { key: 'BITBUCKET_HTTPS_TOKEN', label: 'HTTPS Token', secret: true },
      { key: 'BITBUCKET_TOKEN', label: 'Access Token', secret: true },
      { key: 'BITBUCKET_APP_PASSWORD', label: 'App Password', secret: true },
    ],
  },
  {
    id: 'devin',
    label: 'Devin',
    icon: '⊙',
    tag: 'integration',
    fields: [
      { key: 'DEVIN_PATH', label: 'CLI Command' },
      { key: 'DEVIN_PERMISSION_MODE', label: 'Permission Mode', hint: 'e.g. auto, prompt, strict' },
      { key: 'DEVIN_MODEL', label: 'Model Override', hint: 'Optional.' },
    ],
  },
  {
    id: 'copilot',
    label: 'Copilot',
    icon: '⊙',
    tag: 'integration',
    fields: [
      { key: 'COPILOT_GITHUB_TOKEN', label: 'GitHub Token', secret: true },
      { key: 'COPILOT_REASONING_EFFORT', label: 'Reasoning Effort', hint: 'low / medium / high' },
      { key: 'COPILOT_MODEL', label: 'Model Override', hint: 'Optional.' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    icon: '⊙',
    tag: 'integration',
    fields: [
      { key: 'DEEPSEEK_API_KEY', label: 'API Key', secret: true },
      { key: 'DEEPSEEK_MODEL', label: 'Model Override', hint: 'Optional.' },
      { key: 'DEEPSEEK_BASE_URL', label: 'Base URL', hint: 'Optional.' },
      { key: 'DEEPSEEK_TIMEOUT_MS', label: 'Timeout (ms)', hint: 'Optional.' },
    ],
  },
  {
    id: 'flask',
    label: 'Flask Server',
    icon: '⚡',
    fields: [
      { key: 'FLASK_SOCKET_URL', label: 'Socket URL' },
    ],
  },
  {
    id: 'pipelines',
    label: 'Pipelines',
    icon: '⇝',
    description: 'Per-pipeline runtime overrides.',
    fields: [],
  },
  {
    id: 'ports',
    label: 'Ports',
    icon: '⊕',
    description: 'Auto-computed from running services. Read-only.',
    fields: [
      { key: 'FLASK_URL', label: 'Flask URL', readonly: true },
      { key: 'SERVER_URL', label: 'Server URL', readonly: true },
      { key: 'VITE_URL', label: 'Vite URL', readonly: true },
      { key: 'SOCKET_URL', label: 'Socket URL', readonly: true },
      { key: 'DATABASE_URL', label: 'Database URL', readonly: true },
    ],
  },
];

// ── Small sub-components ──────────────────────────────────────────────────────
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    onClick={() => onChange(!value)}
    style={{
      display: 'flex',
      alignItems: 'center',
      width: 44,
      height: 24,
      borderRadius: 12,
      padding: 2,
      border: 'none',
      cursor: 'pointer',
      transition: 'background 0.2s',
      background: value ? 'var(--accent-green)' : 'rgba(255,255,255,0.12)',
    }}
  >
    <span style={{
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#fff',
      transition: 'transform 0.2s',
      transform: value ? 'translateX(20px)' : 'translateX(0)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }} />
  </button>
);

const SecretInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}> = ({ value, onChange, placeholder, disabled }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        className="settings-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
          display: 'flex', alignItems: 'center', padding: 2,
        }}
        aria-label={visible ? 'Hide' : 'Show'}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
};

const ReadonlyUrl: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="s2-readonly-row">
    <span className="s2-readonly-label">{label}</span>
    <div className="s2-readonly-val-wrap">
      <code className="s2-readonly-val">{value || '—'}</code>
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer" className="s2-readonly-link" title="Open in browser">
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<Config>({});
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    project: true, git: true, runtime: true,
    github: false, jira: false, bitbucket: false,
    devin: false, copilot: false, deepseek: false,
    flask: false, pipelines: false, ports: false,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'core' | 'integrations' | 'system'>('core');

  useEffect(() => {
    Promise.all([fetchConfig(), fetchPipelines()])
      .then(([configData, pipelinesData]) => {
        (window as any).__PIPELINE_AGENT_ID__ = configData.PIPELINE_AGENT_ID || 'devin';
        const c = { ...configData };
        c.FLASK_URL    = `http://127.0.0.1:${c.FLASK_PORT    || '5000'}`;
        c.SERVER_URL   = `http://127.0.0.1:${c.SERVER_PORT   || '8000'}`;
        c.VITE_URL     = `http://127.0.0.1:${c.VITE_PORT     || '5173'}`;
        c.SOCKET_URL   = `http://127.0.0.1:${c.SOCKET_PORT   || '5174'}`;
        c.DATABASE_URL = `http://127.0.0.1:${c.DATABASE_PORT || '5432'}`;
        if (Array.isArray(pipelinesData)) setPipelines(pipelinesData);
        setConfig(c);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle   = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const set      = (key: string, value: string) => { setConfig(p => ({ ...p, [key]: value })); setSaved(false); };

  const handleSave = () => {
    const toSave = { ...config };
    ['FLASK_URL','SERVER_URL','VITE_URL','SOCKET_URL','DATABASE_URL'].forEach(k => delete toSave[k]);
    saveConfig(toSave)
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2500); })
      .catch(() => alert('Failed to save. Check console for details.'));
  };

  /** Render a single field row */
  const renderField = (field: Field) => {
    if (field.key === 'PIPELINE_AGENT_ID') {
      return (
        <div className="s2-field" key={field.key}>
          <div className="s2-label-row">
            <label className="s2-label">{field.label}</label>
            {field.hint && <span className="s2-hint">{field.hint}</span>}
          </div>
          <select
            className="settings-input"
            value={config[field.key] || 'devin'}
            onChange={e => set(field.key, e.target.value)}
          >
            <option value="devin">devin</option>
            <option value="gemini">gemini</option>
            <option value="deepseek">deepseek</option>
            <option value="copilot">copilot</option>
          </select>
        </div>
      );
    }

    if (field.type === 'toggle') {
      return (
        <div className="s2-toggle-field" key={field.key}>
          <div>
            <div className="s2-label">{field.label}</div>
            {field.hint && <div className="s2-hint" style={{ marginTop: 2 }}>{field.hint}</div>}
          </div>
          <Toggle value={config[field.key] === 'true'} onChange={v => set(field.key, v ? 'true' : 'false')} />
        </div>
      );
    }

    if (field.readonly) {
      return <ReadonlyUrl key={field.key} label={field.label} value={config[field.key] || ''} />;
    }

    if (field.secret) {
      return (
        <div className="s2-field" key={field.key}>
          <div className="s2-label-row">
            <label className="s2-label">{field.label}</label>
            {field.hint && <span className="s2-hint">{field.hint}</span>}
          </div>
          <SecretInput
            value={config[field.key] || ''}
            onChange={v => set(field.key, v)}
            placeholder={field.key}
          />
        </div>
      );
    }

    return (
      <div className="s2-field" key={field.key}>
        <div className="s2-label-row">
          <label className="s2-label">{field.label}</label>
          {field.hint && <span className="s2-hint">{field.hint}</span>}
        </div>
        <input
          type="text"
          className="settings-input"
          value={config[field.key] || ''}
          onChange={e => set(field.key, e.target.value)}
          placeholder={field.key}
        />
      </div>
    );
  };

  /** Render a collapsible section card */
  const renderSection = (section: Section) => {
    const isOpen = expanded[section.id];
    return (
      <div className="s2-card" key={section.id}>
        <button type="button" className="s2-card-header" onClick={() => toggle(section.id)}>
          <div className="s2-card-header-left">
            <span className="s2-section-icon">{section.icon}</span>
            <div>
              <span className="s2-section-label">{section.label}</span>
              {section.description && !isOpen && (
                <span className="s2-section-desc-inline">{section.description}</span>
              )}
            </div>
          </div>
          <ChevronDown
            size={16}
            style={{ color: 'var(--muted)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}
          />
        </button>

        {isOpen && (
          <div className="s2-card-body">
            {section.description && (
              <p className="s2-section-desc">{section.description}</p>
            )}

            {section.id === 'pipelines' ? (
              pipelines.length === 0
                ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No pipelines found.</p>
                : pipelines.map((p: any) => (
                  <div className="s2-pipeline-item" key={p.id || p.name}>
                    <span className="s2-pipeline-name">{p.name || p.id}</span>
                    <div className="s2-field" style={{ marginTop: 10 }}>
                      <div className="s2-label-row">
                        <label className="s2-label">Max Retries</label>
                      </div>
                      <input
                        type="number"
                        className="settings-input"
                        style={{ maxWidth: 120 }}
                        value={config[`PIPELINE_${p.id || p.name}_MAX_RETRIES`] || p.maxRetries || '3'}
                        onChange={e => set(`PIPELINE_${p.id || p.name}_MAX_RETRIES`, e.target.value)}
                        placeholder="3"
                        min={0}
                      />
                    </div>
                  </div>
                ))
            ) : (
              <div className="s2-fields">
                {section.fields.map(renderField)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Split sections into tabs
  const coreSections         = SECTIONS.filter(s => !s.tag && !['pipelines','ports','flask'].includes(s.id));
  const integrationSections  = SECTIONS.filter(s => s.tag === 'integration');
  const systemSections       = SECTIONS.filter(s => ['flask','pipelines','ports'].includes(s.id));

  const tabSections: Record<string, Section[]> = {
    core: coreSections,
    integrations: integrationSections,
    system: systemSections,
  };

  if (loading) return (
    <div className="settings-page">
      <p style={{ color: 'var(--muted)', paddingTop: 40, textAlign: 'center' }}>Loading configuration…</p>
    </div>
  );

  return (
    <>


      <div className="s2-page">
        {/* Header */}
        <div className="s2-header">
          <div className="s2-title-block">
            <h1 className="s2-title">Settings</h1>
            <p className="s2-subtitle">Configure your project, integrations, and runtime environment.</p>
          </div>
          <button
            type="button"
            className={`s2-save-btn${saved ? ' saved' : ''}`}
            onClick={handleSave}
          >
            {saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save Changes</>}
          </button>
        </div>

        {/* Tabs */}
        <div className="s2-tabs">
          {(['core', 'integrations', 'system'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              className={`s2-tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'core' ? 'Core' : tab === 'integrations' ? 'Integrations' : 'System'}
            </button>
          ))}
        </div>

        {/* Sections */}
        <div className="s2-sections">
          {tabSections[activeTab].map(renderSection)}
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
