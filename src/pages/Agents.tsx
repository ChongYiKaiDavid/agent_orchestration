import React, { useEffect, useState } from 'react';
import { fetchAgents } from '../api';

const defaultAgents = [
  {
    id: 'devin',
    label: 'Devin',
    description: 'Stateless prompt-driven agent invoked through the Devin CLI.',
    displayName: 'Devin',
    fullDescription: 'Stateless prompt-driven agent invoked through the Devin CLI.',
    reads: ['task.json', 'planner.requirements.md', 'implementation.diff.md', 'reviewer.review.md'],
    writes: ['planner.requirements.md', 'planner.design.md', 'implementation.diff.md', 'reviewer.review.md'],
    completionToken: 'VERDICT: GO/FAIL/SPEC_FAIL/ESCALATE',
    promptTemplate: 'Use the Devin CLI in non-interactive mode to complete the current pipeline stage.',
  },
];

const AgentsPage: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState('devin');
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<any[]>(defaultAgents);

  useEffect(() => {
    fetchAgents().then((items) => {
      if (Array.isArray(items) && items.length > 0) {
        setAgents(items);
      }
    }).catch(() => setAgents(defaultAgents));
  }, []);

  const filteredAgents = agents.filter((agent) => {
    const query = searchTerm.trim().toLowerCase();
    return (
      agent.label.toLowerCase().includes(query) ||
      agent.id.toLowerCase().includes(query) ||
      agent.description.toLowerCase().includes(query)
    );
  });

  const current = filteredAgents.find((a) => a.id === selectedAgent) || agents.find((a) => a.id === selectedAgent) || agents[0];

  return (
    <div className="agents-page">
      <div className="agents-header">
        <h1 className="agents-title">Agents</h1>
        <button className="agents-new-btn" type="button">
          + New Agent
        </button>
      </div>

      <div className="agents-container">
        <div className="agents-sidebar">
          <input
            className="agents-filter"
            placeholder="Filter agents..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <div className="agents-list">
            {filteredAgents.map((agent) => (
              <button
                key={agent.id}
                className={`agents-list-item ${selectedAgent === agent.id ? 'active' : ''}`}
                onClick={() => setSelectedAgent(agent.id)}
                type="button"
              >
                <div className="agents-list-id">{agent.id}</div>
                <div className="agents-list-label">{agent.label}</div>
                <div className="agents-list-desc">{agent.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="agents-detail">
          <div className="agents-detail-field">
            <span className="agents-detail-label">Display Name</span>
            <div className="agents-detail-value">{current.displayName}</div>
          </div>

          <div className="agents-detail-field">
            <span className="agents-detail-label">Description</span>
            <div className="agents-detail-value">{current.fullDescription}</div>
          </div>

          <div className="agents-detail-field">
            <span className="agents-detail-label">Reads</span>
            <div className="agents-detail-tags">
              {current.reads?.length > 0 ? (
                current.reads.map((file: string) => (
                  <span key={file} className="agents-detail-tag">
                    {file} <span className="agents-tag-close">×</span>
                  </span>
                ))
              ) : (
                <div className="agents-detail-placeholder">Type and press Enter...</div>
              )}
            </div>
          </div>

          <div className="agents-detail-field">
            <span className="agents-detail-label">Writes</span>
            <div className="agents-detail-tags">
              {current.writes?.length > 0 ? (
                current.writes.map((file: string) => (
                  <span key={file} className="agents-detail-tag">
                    {file} <span className="agents-tag-close">×</span>
                  </span>
                ))
              ) : (
                <div className="agents-detail-placeholder">Type and press Enter...</div>
              )}
            </div>
          </div>

          <div className="agents-detail-field">
            <span className="agents-detail-label">Completion Token</span>
            <div className="agents-detail-code">{current.completionToken}</div>
          </div>

          <div className="agents-detail-field">
            <span className="agents-detail-label">Prompt Template</span>
            <div className="agents-detail-template">
              {current.promptTemplate || '(empty)'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentsPage;
