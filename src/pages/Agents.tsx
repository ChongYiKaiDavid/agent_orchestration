import React, { useState } from 'react';

const AgentsPage: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState('coder');

  const agents = [
    {
      id: 'coder',
      label: 'Code Executor',
      description: 'Implements code from plan, runs tests',
      displayName: 'Code Executor',
      fullDescription: 'Implements code from plan, runs tests',
      reads: ['task.md', 'planner.requirements.md', 'planner.design.md', 'reviewer.review.md'],
      writes: ['coder.summary.md', 'implementation.diff.md'],
      completionToken: '<<<CODER_COMPLETE>>>',
      promptTemplate: 'You are now the CODER.\nRead the skill at: {{ skill_path }}/SKILL.md\n\n## Task Folder\n{{ task_folder }}\n\nRead these files for context: {{ read_files }}',
    },
    {
      id: 'decomposer',
      label: 'Decomposer',
      description: 'Breaks down complex epics into individual tasks',
      displayName: 'Decomposer',
      fullDescription: 'Breaks down complex epics into individual tasks',
      reads: ['epic.md', 'product_notes.md'],
      writes: ['task.list.md', 'task.dependencies.md'],
      completionToken: '<<<DECOMPOSER_COMPLETE>>>',
      promptTemplate: '',
    },
    {
      id: 'planner',
      label: 'Planner',
      description: 'Analyzes task and creates requirements and desi...',
      displayName: 'Planner',
      fullDescription: 'Analyzes task and creates requirements and design documents',
      reads: ['task.md', 'repo.context.md'],
      writes: ['planner.requirements.md', 'planner.design.md'],
      completionToken: '<<<PLANNER_COMPLETE>>>',
      promptTemplate: '',
    },
    {
      id: 'reviewer',
      label: 'Reviewer',
      description: 'Reviews code against requirements, produces ve...',
      displayName: 'Reviewer',
      fullDescription: 'Reviews code against requirements, produces verdict',
      reads: ['implementation.diff.md', 'planner.requirements.md'],
      writes: ['reviewer.review.md'],
      completionToken: '<<<REVIEWER_COMPLETE>>>',
      promptTemplate: '',
    },
    {
      id: 'shipper',
      label: 'Shipper',
      description: 'Bundles the final change and confirms delivery',
      displayName: 'Shipper',
      fullDescription: 'Bundles the final change and confirms delivery',
      reads: ['reviewer.review.md', 'implementation.diff.md'],
      writes: ['release.notes.md', 'delivery.summary.md'],
      completionToken: '<<<SHIPPER_COMPLETE>>>',
      promptTemplate: '',
    },
  ];

  const current = agents.find((a) => a.id === selectedAgent) || agents[0];

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
          <input className="agents-filter" placeholder="Filter agents..." />
          <div className="agents-list">
            {agents.map((agent) => (
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
              {current.reads.length > 0 ? (
                current.reads.map((file) => (
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
            <div className="agents-detail-placeholder">Type and press Enter...</div>
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
