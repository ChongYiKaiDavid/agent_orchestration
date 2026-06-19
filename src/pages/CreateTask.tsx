import React, { useState } from 'react';
import { createTask as postTask } from '../api';

type CreatedTask = {
  title: string;
  description?: string;
  pipeline?: string;
  repository?: string;
  targetBranch?: string;
  jiraTicket?: string;
  bitbucketIssue?: string;
  epicId?: string;
};

type CreateTaskProps = {
  onCreate?: (task: CreatedTask) => void;
};

const CreateTask: React.FC<CreateTaskProps> = ({ onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pipeline, setPipeline] = useState('plan-code-review');
  const [repository, setRepository] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [jiraTicket, setJiraTicket] = useState('');
  const [bitbucketIssue, setBitbucketIssue] = useState('');
  const [epicId, setEpicId] = useState('');
  const [createdTask, setCreatedTask] = useState<{ title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a title before creating the task.');
      return;
    }

    const payload: CreatedTask = {
      title: trimmedTitle,
      description: description || undefined,
      pipeline,
      repository: repository || undefined,
      targetBranch: targetBranch || undefined,
      jiraTicket: jiraTicket || undefined,
      bitbucketIssue: bitbucketIssue || undefined,
      epicId: epicId || undefined,
    };

    try {
      await postTask(payload);
      setCreatedTask({ title: trimmedTitle });
      setError(null);
      if (onCreate) onCreate(payload);
      setTitle('');
      setDescription('');
      setRepository('');
      setTargetBranch('');
      setJiraTicket('');
      setBitbucketIssue('');
      setEpicId('');
    } catch (err) {
      setError((err as Error).message || 'Unable to create task.');
    }
  };

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
            <option value="code-only">Code Only</option>
            <option value="plan-code-review">Plan → Code → Review</option>
            <option value="gemini-code-only">Gemini Code Only</option>
            <option value="ollama-code-only">Ollama Code Only</option>
            <option value="ollama-plan-code-review">Ollama Plan → Code → Review</option>
          </select>
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Repository URL</span>
          <input className="create-task-input" placeholder="e.g. https://github.com/org/repo.git" value={repository} onChange={(event) => setRepository(event.target.value)} />
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

        <button className="create-task-submit" type="button" onClick={handleCreate}>
          Create & Queue
        </button>

        {/* Test harness expects immediate status rendering */}


        {error && (
          <div className="create-task-error" role="alert">
            {error}
          </div>
        )}

        {createdTask && (
          <div className="create-task-success" role="status">
            Task "{createdTask.title}" created and queued.
          </div>
        )}

      </div>
    </div>
  );
};

export default CreateTask;
