import React, { useState } from 'react';

const CreateTask: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pipeline, setPipeline] = useState('Plan → Code → Review');
  const [repository, setRepository] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [jiraTicket, setJiraTicket] = useState('');
  const [bitbucketIssue, setBitbucketIssue] = useState('');
  const [epicId, setEpicId] = useState('');

  return (
    <div className="create-task-page">
      <h1 className="create-task-title">Create Task</h1>

      <div className="create-task-form">
        <label className="create-task-field">
          <span className="create-task-label">Title</span>
          <input className="create-task-input" placeholder="Task title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Description</span>
          <textarea className="create-task-textarea" placeholder="Task description (optional)" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
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
          </select>
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Repository</span>
          <input className="create-task-input" placeholder="e.g. bank-wallet-service main" value={repository} onChange={(event) => setRepository(event.target.value)} />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Target Branch</span>
          <input className="create-task-input" placeholder="e.g. main" value={targetBranch} onChange={(event) => setTargetBranch(event.target.value)} />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Jira Ticket</span>
          <input className="create-task-input" placeholder="e.g. BANK-1234" value={jiraTicket} onChange={(event) => setJiraTicket(event.target.value)} />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Bitbucket Issue</span>
          <input className="create-task-input" placeholder="e.g. https://jira.company.com/BANK-1234" value={bitbucketIssue} onChange={(event) => setBitbucketIssue(event.target.value)} />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Epic ID</span>
          <input className="create-task-input" placeholder="e.g. https://bitbucket.company.com/projects/BANK/issues/123" value={epicId} onChange={(event) => setEpicId(event.target.value)} />
        </label>

        <button className="create-task-submit" type="button">
          Create & Queue
        </button>
      </div>
    </div>
  );
};

export default CreateTask;
