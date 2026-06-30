import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fetchConfig, saveConfig } from '../api';

type Config = Record<string, string>;

const SECTIONS = [
  {
    id: 'jira',
    label: 'Jira',
    fields: [
      { key: 'JIRA_BASE_URL', label: 'Base URL' },
      { key: 'JIRA_USER', label: 'User Email' },
      { key: 'JIRA_API_TOKEN', label: 'API Token', secret: true },
      { key: 'JIRA_SPACE_KEYS', label: 'Space Keys (comma-separated)' },
    ],
  },
  {
    id: 'bitbucket',
    label: 'Bitbucket',
    fields: [
      { key: 'BITBUCKET_USERNAME', label: 'Username' },
      { key: 'BITBUCKET_HTTPS_TOKEN', label: 'HTTPS Token', secret: true },
      { key: 'BITBUCKET_TOKEN', label: 'Access Token', secret: true },
      { key: 'BITBUCKET_APP_PASSWORD', label: 'App Password', secret: true },
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
    id: 'deepseek',
    label: 'DeepSeek',
    fields: [
      { key: 'DEEPSEEK_API_KEY', label: 'API Key', secret: true },
      { key: 'DEEPSEEK_MODEL', label: 'Model (default: deepseek-coder)' },
      { key: 'DEEPSEEK_BASE_URL', label: 'Base URL (default: api.deepseek.com)' },
      { key: 'DEEPSEEK_TIMEOUT_MS', label: 'Timeout ms (default: 120000)' },
    ],
  },
  {
    id: 'flask',
    label: 'Flask Server',
    fields: [
      { key: 'FLASK_SOCKET_URL', label: 'Socket URL' },
    ],
  },
];

const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<Config>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ jira: true, deepseek: true });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const set = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveConfig(config).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
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

            {expanded[section.id] && (
              <div className="settings-section-content">
                {section.fields.map((field: any) => (
                  <div className="settings-field" key={field.key}>
                    <label className="settings-label">{field.label}</label>
                    <input
                      type={field.secret ? 'password' : 'text'}
                      className="settings-input"
                      value={config[field.key] || ''}
                      onChange={e => set(field.key, e.target.value)}
                      placeholder={field.key}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsPage;
