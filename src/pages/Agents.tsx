import React, { useEffect, useState } from 'react';
import { fetchAgents, updateAgent } from '../api';

const AgentsPage: React.FC = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [currentAgent, setCurrentAgent] = useState<any | null>(null);

  useEffect(() => {
    fetchAgents().then((items) => {
      if (Array.isArray(items) && items.length > 0) {
        setAgents(items);
        if (!selectedAgentId) {
          setSelectedAgentId(items[0].id);
        }
      }
    }).catch(() => setAgents([]));
  }, [selectedAgentId]);

  useEffect(() => {
    if (selectedAgentId) {
      const agent = agents.find(a => a.id === selectedAgentId);
      setCurrentAgent(agent ? { ...agent } : null);
    }
  }, [selectedAgentId, agents]);

  const handleSave = () => {
    if (currentAgent) {
      updateAgent(currentAgent.id, currentAgent)
        .then(() => {
          // refetch agents
          fetchAgents().then(setAgents);
        })
        .catch(console.error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    if (currentAgent) {
      setCurrentAgent({ ...currentAgent, [field]: value });
    }
  };

  const handleCliChange = (field: string, value: any) => {
    if (currentAgent) {
      setCurrentAgent({
        ...currentAgent,
        cli: {
          ...currentAgent.cli,
          [field]: value,
        },
      });
    }
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
        <button className="agents-new-btn" type="button" onClick={handleSave}>
          Save Changes
        </button>
      </div>

      <div className="agents-container">
        <div className="agents-sidebar">
          <input
            className="agents-filter"
            placeholder="Filter skills..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <div className="agents-list">
            {filteredAgents.map((agent) => (
              <button
                key={agent.id}
                className={`agents-list-item ${selectedAgentId === agent.id ? 'active' : ''}`}
                onClick={() => setSelectedAgentId(agent.id)}
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
                className="agents-detail-value"
                value={currentAgent.id}
                readOnly
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">Display Name</span>
              <input
                className="agents-detail-value"
                value={currentAgent.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">Description</span>
              <textarea
                className="agents-detail-value"
                value={currentAgent.fullDescription}
                onChange={(e) => handleInputChange('fullDescription', e.target.value)}
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">Skills</span>
              <input
                className="agents-detail-value"
                value={(currentAgent.skills || []).join(', ')}
                onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()))}
              />
            </div>
            
            <div className="agents-detail-field">
              <span className="agents-detail-label">Prompt Template</span>
              <textarea
                className="agents-detail-template"
                rows={10}
                value={currentAgent.promptTemplate || ''}
                onChange={(e) => handleInputChange('promptTemplate', e.target.value)}
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">CLI Command</span>
              <input
                className="agents-detail-value"
                value={currentAgent.cli?.command || ''}
                onChange={(e) => handleCliChange('command', e.target.value)}
              />
            </div>

            <div className="agents-detail-field">
              <span className="agents-detail-label">CLI Arguments</span>
              <input
                className="agents-detail-value"
                value={currentAgent.cli?.args?.join(' ') || ''}
                onChange={(e) => handleCliChange('args', e.target.value.split(' '))}
              />
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default AgentsPage;
