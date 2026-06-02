import React, { useState } from 'react';

const CreateTask: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'decompose'>('single');
  const [pipeline, setPipeline] = useState('Code Only');

  return (
    <div className="create-task-page">
      <h1 className="create-task-title">Create Task</h1>

      <div className="create-task-tabs" role="tablist" aria-label="Create task mode">
        <button
          type="button"
          className={`create-task-tab ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
          aria-pressed={activeTab === 'single'}
        >
          Single Task
        </button>
        <button
          type="button"
          className={`create-task-tab ${activeTab === 'decompose' ? 'active' : ''}`}
          onClick={() => setActiveTab('decompose')}
          aria-pressed={activeTab === 'decompose'}
        >
          Decompose Epic
        </button>
      </div>

      <div className="create-task-form">
        <label className="create-task-field">
          <span className="create-task-label">Title</span>
          <input className="create-task-input" placeholder="Task title" />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Description</span>
          <textarea className="create-task-textarea" placeholder="Task description (optional)" rows={5} />
        </label>

        <label className="create-task-field create-task-pipeline-field">
          <span className="create-task-label">Pipeline</span>
          <select
            className="create-task-select"
            value={pipeline}
            onChange={(event) => setPipeline(event.target.value)}
          >
            <option value="Code Only">Code Only</option>
            <option value="Plan → Code → Review">Plan → Code → Review</option>
            <option value="Single Step">Single Step</option>
          </select>
        </label>

        <button className="create-task-submit" type="button">
          Create & Queue
        </button>
      </div>
    </div>
  );
};

export default CreateTask;
