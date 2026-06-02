import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [projectName, setProjectName] = useState('acme-release-ops');
  const [displayName, setDisplayName] = useState('Acme Release Ops');
  const [gitEnabled, setGitEnabled] = useState(true);
  const [targetBranch, setTargetBranch] = useState('main');
  const [branchPattern, setBranchPattern] = useState('feature/{task_id}-{short_name}');
  const [cliExecutable, setCliExecutable] = useState('copilot-runner');
  const [model, setModel] = useState('gpt-5.4-mini');

  const [expandedSections, setExpandedSections] = useState({
    project: true,
    git: true,
    runtime: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <button className="settings-save-btn" type="button">
          Save
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <button
            type="button"
            className="settings-section-header"
            onClick={() => toggleSection('project')}
          >
            <ChevronDown
              size={20}
              className={`settings-chevron ${expandedSections.project ? 'open' : ''}`}
            />
            <span>Project</span>
          </button>
          {expandedSections.project && (
            <div className="settings-section-content">
              <div className="settings-field">
                <label className="settings-label">Project Name</label>
                <input
                  type="text"
                  className="settings-input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="settings-field">
                <label className="settings-label">Display Name</label>
                <input
                  type="text"
                  className="settings-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <button
            type="button"
            className="settings-section-header"
            onClick={() => toggleSection('git')}
          >
            <ChevronDown
              size={20}
              className={`settings-chevron ${expandedSections.git ? 'open' : ''}`}
            />
            <span>Git</span>
          </button>
          {expandedSections.git && (
            <div className="settings-section-content">
              <div className="settings-field">
                <label className="settings-label">Enabled</label>
                <div className="settings-toggle-wrap">
                  <button
                    type="button"
                    className={`settings-toggle ${gitEnabled ? 'on' : 'off'}`}
                    onClick={() => setGitEnabled(!gitEnabled)}
                  >
                    <span className="settings-toggle-circle" />
                  </button>
                </div>
              </div>
              <div className="settings-field">
                <label className="settings-label">Target Branch</label>
                <input
                  type="text"
                  className="settings-input"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                />
              </div>
              <div className="settings-field">
                <label className="settings-label">Branch Pattern</label>
                <input
                  type="text"
                  className="settings-input"
                  value={branchPattern}
                  onChange={(e) => setBranchPattern(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <button
            type="button"
            className="settings-section-header"
            onClick={() => toggleSection('runtime')}
          >
            <ChevronDown
              size={20}
              className={`settings-chevron ${expandedSections.runtime ? 'open' : ''}`}
            />
            <span>Runtime</span>
          </button>
          {expandedSections.runtime && (
            <div className="settings-section-content">
              <div className="settings-field">
                <label className="settings-label">CLI Executable</label>
                <input
                  type="text"
                  className="settings-input"
                  value={cliExecutable}
                  onChange={(e) => setCliExecutable(e.target.value)}
                />
              </div>
              <div className="settings-field">
                <label className="settings-label">Model</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="Select a model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
