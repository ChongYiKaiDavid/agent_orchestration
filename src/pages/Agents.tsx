import React, { useEffect, useState } from 'react';
import { fetchAgents, createAgent, updateAgent } from '../api';

const BLANK_AGENT = {
  id: '',
  label: '',
  displayName: '',
  description: '',
  fullDescription: '',
  skills: [] as string[],
  reads: [] as string[],
  writes: [] as string[],
  completionToken: '',
  promptTemplate: '',
  cli: { command: '', args: [] as string[] },
};

const ID_REGEX = /^[a-z0-9-]+$/;

const AgentsPage: React.FC = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [currentAgent, setCurrentAgent] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [idError, setIdError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchAgents().then((items) => {
      if (Array.isArray(items) && items.length > 0) {
        setAgents(items);
        if (!selectedAgentId && !isNew) setSelectedAgentId(items[0].id);
      }
    }).catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    if (selectedAgentId && !isNew) {
      const agent = agents.find(a => a.id === selectedAgentId);
      setCurrentAgent(agent ? { ...agent } : null);
    }
  }, [selectedAgentId, agents]);

  const handleNewAgent = () => {
    setIsNew(true);
    setSelectedAgentId(null);
    setCurrentAgent({ ...BLANK_AGENT, skills: [], reads: [], writes: [], cli: { command: '', args: [] } });
    setIdError('');
    setFormError('');
  };

  const handleSave = () => {
    if (!currentAgent) return;

    if (isNew) {
      const missing = [];
      if (!currentAgent.id) missing.push('ID');
      if (idError) return;
      if (!currentAgent.displayName) missing.push('Display Name');
      if (missing.length > 0) {
        setFormError(`Please fill in: ${missing.join(', ')}`);
        return;
      }
    }

    setFormError('');
    const action = isNew ? createAgent(currentAgent) : updateAgent(currentAgent.id, currentAgent);
    action
      .then(() => fetchAgents().then(items => {
        setAgents(items);
        setIsNew(false);
        setSelectedAgentId(currentAgent.id);
      }))
      .catch(console.error);
  };

  const handleSelect = (id: string) => {
    setIsNew(false);
    setSelectedAgentId(id);
    setIdError('');
    setFormError('');
  };

  const handleInputChange = (field: string, value: any) => {
    if (currentAgent) {
      setCurrentAgent({ ...currentAgent, [field]: value });
      if (formError) setFormError('');
    }
  };

  const handleIdChange = (value: string) => {
    const v = value.toLowerCase();
    handleInputChange('id', v);
    if (v && !ID_REGEX.test(v)) {
      setIdError('Only lowercase letters, numbers, and hyphens are allowed.');
    } else {
      setIdError('');
      setFormError('');
    }
  };

  const handleCliChange = (field: string, value: any) => {
    if (currentAgent) setCurrentAgent({ ...currentAgent, cli: { ...currentAgent.cli, [field]: value } });
  };

  const filteredAgents = agents.filter((agent) => {
    const query = searchTerm.trim().toLowerCase();
    return (
      agent.id.toLowerCase().includes(query) ||
      agent.displayName.toLowerCase().includes(query) ||
      agent.description.toLowerCase().includes(query) ||
      (agent.skills && agent.skills.join(' ').toLowerCase().includes(query))
    );
  });

  return (
    <div className="agents-page">
      <div className="agents-header">
        <h1 className="agents-title">Agent Skills</h1>
        <button className="agents-new-btn" type="button" onClick={handleNewAgent}>
          + New Agent
        </button>
      </div>

      <div className="agents-container">
        <div className="agents-sidebar">
          <input
            className="agents-filter"
            placeholder="Filter skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="agents-list">
            {isNew && (
              <div className="agents-list-item active">
                <div className="agents-list-id">new</div>
                <div className="agents-list-label">New Agent</div>
                <div className="agents-list-desc">Unsaved</div>
              </div>
            )}
            {filteredAgents.map((agent) => (
              <button
                key={agent.id}
                className={`agents-list-item ${!isNew && selectedAgentId === agent.id ? 'active' : ''}`}
                onClick={() => handleSelect(agent.id)}
                type="button"
              >
                <div className="agents-list-id">{agent.id}</div>
                <div className="agents-list-label">{agent.displayName}</div>
                <div className="agents-list-desc">{agent.description}</div>
              </button>
            ))}
          </div>
        </div>

        {currentAgent && (
          <div className="agents-detail">
            <div className="agents-detail-field">
              <span className="agents-detail-label">ID</span>
              <input
                className={`agents-detail-value${idError ? ' input-error' : ''}`}
                value={currentAgent.id}
                readOnly={!isNew}
                placeholder="e.g. agent-name"
                onChange={(e) => isNew && handleIdChange(e.target.value)}
              />
              {idError && <span className="agents-field-error">{idError}</span>}
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">Display Name</span>
              <input
                className="agents-detail-value"
                value={currentAgent.displayName}
                placeholder="e.g. Agent Display Name"
                onChange={(e) => handleInputChange('displayName', e.target.value)}
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">Description</span>
              <textarea
                className="agents-detail-value"
                value={currentAgent.fullDescription}
                placeholder="Describe what this agent does..."
                onChange={(e) => handleInputChange('fullDescription', e.target.value)}
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">Skills</span>
              <input
                className="agents-detail-value"
                value={(currentAgent.skills || []).join(', ')}
                placeholder="e.g. code generation, review, testing"
                onChange={(e) => handleInputChange('skills', e.target.value.split(',').map((s: string) => s.trim()))}
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">Prompt Template</span>
              <textarea
                className="agents-detail-template"
                rows={10}
                value={currentAgent.promptTemplate || ''}
                placeholder="Enter the prompt template for this agent..."
                onChange={(e) => handleInputChange('promptTemplate', e.target.value)}
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">CLI Command</span>
              <input
                className="agents-detail-value"
                value={currentAgent.cli?.command || ''}
                placeholder="e.g. devin"
                onChange={(e) => handleCliChange('command', e.target.value)}
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">CLI Arguments</span>
              <input
                className="agents-detail-value"
                value={currentAgent.cli?.args?.join(' ') || ''}
                placeholder="e.g. --prompt-file {promptFile} --print"
                onChange={(e) => handleCliChange('args', e.target.value.split(' '))}
              />
            </div>

            {formError && <span className="agents-field-error">{formError}</span>}

            <div className="agents-detail-actions">
              <button className="agents-new-btn" type="button" onClick={handleSave}>
                {isNew ? 'Create Agent' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentsPage;
