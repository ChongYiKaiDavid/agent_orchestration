import React from 'react';
import { useState } from 'react';

const DashboardPage: React.FC = () => {
  const [pipeline, setPipeline] = useState('All pipelines');
  const [status, setStatus] = useState('All statuses');
  const [priority, setPriority] = useState('All priorities');

  const statusItems = [
    { id: 'merge', label: 'MERGE', color: 'var(--accent-purple)' },
    { id: 'respond', label: 'RESPOND', color: 'var(--accent-yellow)' },
    { id: 'review', label: 'REVIEW', color: 'var(--accent-red)' },
    { id: 'pending', label: 'PENDING', color: 'var(--accent-blue)' },
    { id: 'working', label: 'WORKING', color: 'var(--accent-green)' },
  ];

  const pipelineOptions = ['All pipelines', 'Code Only', 'Plan → Code → Review'];
  const statusOptions = ['All statuses', 'Open', 'In progress', 'Done'];
  const priorityOptions = ['All priorities', 'Low', 'Medium', 'High'];

  return (
    <div className="dashboard-page">
      <div className="dashboard-toolbar">
        <div className="dashboard-search">
          <input className="dashboard-search-input" placeholder="Search tasks..." />
        </div>

        <div className="dashboard-filters">
          <label className="dashboard-filter-wrap">
            <select
              className="dashboard-filter-select"
              value={pipeline}
              onChange={(event) => setPipeline(event.target.value)}
            >
              {pipelineOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="dashboard-filter-wrap">
            <select
              className="dashboard-filter-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="dashboard-filter-wrap">
            <select
              className="dashboard-filter-select"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="dashboard-select-all">
          <input type="checkbox" />
          <span>Select all</span>
        </label>
      </div>

      <div className="dashboard-status-row dashboard-status-grid">
        {statusItems.map((item) => (
          <div className="dashboard-status dashboard-status-column" key={item.id}>
            <div className="dashboard-status-header">
              <span className="dashboard-status-dot" style={{ background: item.color }} />
              <span className="dashboard-status-label">{item.label}</span>
            </div>
            <span className="dashboard-status-count">0</span>
            <div className="dashboard-status-lane" />
          </div>
        ))}
      </div>

      <div className="dashboard-canvas" aria-hidden="true" />

      <div className="dashboard-footer-stats">
        <div>
          <div className="dashboard-footer-value">0</div>
          <div className="dashboard-footer-label">TOTAL</div>
        </div>
        <div>
          <div className="dashboard-footer-value">0</div>
          <div className="dashboard-footer-label">ACTIVE</div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
