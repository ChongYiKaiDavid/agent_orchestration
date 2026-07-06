import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fetchConfig, saveConfig, fetchPipelines } from '../api';

type Config = Record<string, string>;

interface Field {
  key: string;
  label: string;
  secret?: boolean;
  type?: 'toggle';
  readonly?: boolean;
}

interface SubSection {
  id: string;
  label: string;
  fields: Field[];
}

interface Section {
  id: string;
  label: string;
  fields?: Field[];
  subsections?: SubSection[];
}

const SECTIONS: Section[] = [
  {
    id: 'project',
    label: 'Project',
    fields: [
      { key: 'PROJECT_NAME', label: 'Project Name' },
      { key: 'DISPLAY_NAME', label: 'Display Name (optional)' },
    ],
  },
  {
    id: 'git',
    label: 'Git',
    fields: [
      { key: 'GIT_ENABLED', label: 'Enabled', type: 'toggle' },
      { key: 'RELEASE_BRANCH_ENABLED', label: 'Enable Release Branch Workflow', type: 'toggle' },
      { key: 'TARGET_BRANCH', label: 'Default Target Branch' },
      { key: 'DEFAULT_RELEASE_BRANCH', label: 'Default Release Branch' },
      { key: 'BRANCH_PATTERN', label: 'Branch Pattern (optional)' },
    ],
  },
  {
    id: 'runtime',
    label: 'Runtime',
    fields: [
      { key: 'CLI_EXECUTABLE', label: 'CLI Executable' },
      { key: 'MODEL', label: 'Model (optional)' },
    ],
  },
  {
    id: 'jira',
    label: 'Jira',
    fields: [
      { key: 'JIRA_BASE_URL', label: 'Base URL' },
      { key: 'JIRA_USER', label: 'User Email' },
      { key: 'JIRA_API_TOKEN', label: 'API Token', secret: true },
      { key: 'JIRA_SPACE_KEYS', label: 'Space Keys (comma-separated, optional)' },
      { key: 'JIRA_REPO_MAPPING', label: 'Project to Repository Mapping (JSON)', readonly: false },
      { key: 'JIRA_DEMO_MODE', label: 'Use Built-in Demo Jira Issues', type: 'toggle' },
    ],
  },
  {
    id: 'bitbucket',
    label: 'Bitbucket',
    fields: [
      { key: 'BITBUCKET_USERNAME', label: 'Username' },
      { key: 'BITBUCKET_HTTPS_TOKEN', label: 'HTTPS Token (optional)', secret: true },
      { key: 'BITBUCKET_TOKEN', label: 'Access Token (optional)', secret: true },
      { key: 'BITBUCKET_APP_PASSWORD', label: 'App Password (optional)', secret: true },
    ],
  },
  {
    id: 'github',
    label: 'GitHub',
    fields: [
      { key: 'GITHUB_TOKEN', label: 'Personal Access Token', secret: true },
    ],
  },
  {
    id: 'devin',
    label: 'Devin',
    fields: [
      { key: 'DEVIN_PATH', label: 'CLI Path' },
      { key: 'DEVIN_PERMISSION_MODE', label: 'Permission Mode' },
      { key: 'DEVIN_MODEL', label: 'Model (optional)' },
    ],
  },
  {
    id: 'copilot',
    label: 'Copilot',
    fields: [
      { key: 'COPILOT_GITHUB_TOKEN', label: 'GitHub Token', secret: true },
      { key: 'COPILOT_REASONING_EFFORT', label: 'Reasoning Effort (low/medium/high)' },
      { key: 'COPILOT_MODEL', label: 'Model (optional)' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    fields: [
      { key: 'DEEPSEEK_API_KEY', label: 'API Key', secret: true },
      { key: 'DEEPSEEK_MODEL', label: 'Model (optional)' },
      { key: 'DEEPSEEK_BASE_URL', label: 'Base URL (optional)' },
      { key: 'DEEPSEEK_TIMEOUT_MS', label: 'Timeout ms (optional)' },
    ],
  },
  {
    id: 'flask',
    label: 'Flask Server',
    fields: [
      { key: 'FLASK_SOCKET_URL', label: 'Socket URL' },
    ],
  },
  {
    id: 'pipelines',
    label: 'Pipelines',
    fields: [], // Will be populated dynamically
  },
  {
    id: 'ports',
    label: 'Ports (Read-only)',
    fields: [
      { key: 'FLASK_URL', label: 'Flask URL', readonly: true },
      { key: 'SERVER_URL', label: 'Server URL', readonly: true },
      { key: 'VITE_URL', label: 'Vite URL', readonly: true },
      { key: 'SOCKET_URL', label: 'Socket URL', readonly: true },
      { key: 'DATABASE_URL', label: 'Database URL', readonly: true },
    ],
  },
];

const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<Config>({});
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    project: true,
    git: true,
    runtime: true,
    jira: true,
    bitbucket: true,
    github: true,
    devin: true,
    copilot: true,
    deepseek: true,
    flask: true,
    pipelines: true,
    ports: true,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchPipelines()])
      .then(([configData, pipelinesData]) => {
        const enhancedConfig = { ...configData };

        // Build full URLs from port/config values with fallbacks
        const flaskPort = configData.FLASK_PORT || '5000';
        const serverPort = configData.SERVER_PORT || '8000';
        const vitePort = configData.VITE_PORT || '5173';
        const socketPort = configData.SOCKET_PORT || '5174';
        const dbPort = configData.DATABASE_PORT || '5432';

        enhancedConfig.FLASK_URL = `http://127.0.0.1:${flaskPort}`;
        enhancedConfig.SERVER_URL = `http://127.0.0.1:${serverPort}`;
        enhancedConfig.VITE_URL = `http://127.0.0.1:${vitePort}`;
        enhancedConfig.SOCKET_URL = `http://127.0.0.1:${socketPort}`;
        enhancedConfig.DATABASE_URL = `http://127.0.0.1:${dbPort}`;

        // Store pipelines data
        if (pipelinesData && Array.isArray(pipelinesData)) {
          setPipelines(pipelinesData);
        }

        setConfig(enhancedConfig);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const set = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    // Filter out computed URLs that shouldn't be saved to .env
    const configToSave = { ...config };
    delete configToSave.FLASK_URL;
    delete configToSave.SERVER_URL;
    delete configToSave.VITE_URL;
    delete configToSave.SOCKET_URL;
    delete configToSave.DATABASE_URL;
    
    saveConfig(configToSave)
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      })
      .catch((error) => {
        console.error('Failed to save config:', error);
        alert('Failed to save configuration. Please check the console for details.');
      });
  };

  if (loading) return <div className="settings-page"><p style={{ color: 'var(--muted)' }}>Loading...</p></div>;

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <button className="settings-save-btn" type="button" onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="settings-content">
        {SECTIONS.map(section => (
          <div className="settings-section" key={section.id}>
            <button
              type="button"
              className="settings-section-header"
              onClick={() => toggle(section.id)}
            >
              <ChevronDown size={20} className={`settings-chevron ${expanded[section.id] ? 'open' : ''}`} />
              <span>{section.label}</span>
            </button>

            {expanded[section.id] && section.fields && (
              <div className="settings-section-content">
                {section.id === 'pipelines' ? (
                  // Special rendering for pipelines section
                  pipelines.map((pipeline: any) => (
                    <div className="settings-pipeline-item" key={pipeline.id || pipeline.name}>
                      <div className="settings-pipeline-name">{pipeline.name || pipeline.id}</div>
                      <div className="settings-field">
                        <label className="settings-label">Max Retries</label>
                        <input
                          type="text"
                          className="settings-input"
                          value={config[`PIPELINE_${pipeline.id || pipeline.name}_MAX_RETRIES`] || pipeline.maxRetries || '3'}
                          onChange={e => set(`PIPELINE_${pipeline.id || pipeline.name}_MAX_RETRIES`, e.target.value)}
                          placeholder="3"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  // Standard field rendering
                  section.fields.map((field: any) => (
                    <div className="settings-field" key={field.key}>
                      <label className="settings-label">{field.label}</label>
                      {field.type === 'toggle' ? (
                        <div className="settings-toggle-wrap">
                          <button
                            type="button"
                            className={`settings-toggle ${config[field.key] === 'true' ? 'on' : 'off'}`}
                            onClick={() => set(field.key, config[field.key] === 'true' ? 'false' : 'true')}
                          >
                            <span className="settings-toggle-circle" />
                          </button>
                        </div>
                      ) : (
                        <input
                          type={field.secret ? 'password' : 'text'}
                          className="settings-input"
                          value={config[field.key] || ''}
                          onChange={e => set(field.key, e.target.value)}
                          placeholder={field.key}
                          disabled={field.readonly}
                          readOnly={field.readonly}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsPage;
