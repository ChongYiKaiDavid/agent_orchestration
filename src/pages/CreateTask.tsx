import React, { useState } from 'react';
import { createTask as postTask, createJiraIssue } from '../api';

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

type JiraStatus =
  | { phase: 'idle' }
  | { phase: 'creating' }
  | { phase: 'created'; key: string; url: string; demo: boolean }
  | { phase: 'error'; message: string; skipped?: boolean };

const CreateTask: React.FC<CreateTaskProps> = ({ onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pipeline, setPipeline] = useState('plan-code-review');
  const [repository, setRepository] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [bitbucketIssue, setBitbucketIssue] = useState('');
  const [epicId, setEpicId] = useState('');

  const [jiraStatus, setJiraStatus] = useState<JiraStatus>({ phase: 'idle' });
  const [createdTask, setCreatedTask] = useState<{ title: string; jiraKey?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setRepository('');
    setTargetBranch('');
    setBitbucketIssue('');
    setEpicId('');
    setJiraStatus({ phase: 'idle' });
    setError(null);
  };

  /**
   * Core submit logic. Accepts an optional pre-resolved jiraKey so that the
   * "skip Jira and continue" path can reuse the same function.
   */
  const submitTask = async (jiraKey: string | undefined) => {
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
      jiraTicket: jiraKey || undefined,
      bitbucketIssue: bitbucketIssue || undefined,
      epicId: epicId || undefined,
    };

    try {
      await postTask(payload);
      setCreatedTask({ title: trimmedTitle, jiraKey });
      setError(null);
      if (onCreate) onCreate(payload);
      resetForm();
    } catch (err) {
      setError((err as Error).message || 'Unable to create task.');
    }
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a title before creating the task.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    // ── Step 1: Create a Jira ticket first ──────────────────────────────────
    setJiraStatus({ phase: 'creating' });
    let jiraKey: string | undefined;

    try {
      const result = await createJiraIssue({
        summary: trimmedTitle,
        description: description || undefined,
        priority: 'medium',
        issueType: 'Task',
      });
      jiraKey = result.key;
      setJiraStatus({ phase: 'created', key: result.key, url: result.url, demo: result.demo });
    } catch (err) {
      // Jira is unreachable or returned an error — surface it but allow skipping.
      const msg = (err as Error).message || 'Jira request failed.';
      setJiraStatus({ phase: 'error', message: msg });
      setIsSubmitting(false);
      return; // Wait for user to click "Skip Jira & create anyway" or fix the error
    }

    // ── Step 2: Create the internal task with the Jira key ──────────────────
    await submitTask(jiraKey);
    setIsSubmitting(false);
  };

  /** Called when the user explicitly chooses to create the task without a Jira ticket. */
  const handleSkipJira = async () => {
    setJiraStatus({ phase: 'error', message: (jiraStatus as any).message, skipped: true });
    setIsSubmitting(true);
    await submitTask(undefined);
    setIsSubmitting(false);
  };

  const jiraErrorMessage =
    jiraStatus.phase === 'error' && !jiraStatus.skipped ? jiraStatus.message : null;

  return (
    <div className="create-task-page">
      <h1 className="create-task-title">Create Task</h1>

      <div className="create-task-form">
        <label className="create-task-field">
          <span className="create-task-label">Title</span>
          <input
            className="create-task-input"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Description</span>
          <textarea
            className="create-task-textarea"
            placeholder="Task description (optional)"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="create-task-field create-task-pipeline-field">
          <span className="create-task-label">Pipeline</span>
          <select
            className="create-task-select"
            value={pipeline}
            onChange={(e) => setPipeline(e.target.value)}
          >
            <option value="code-only">Code Only</option>
            <option value="plan-code-review">Plan → Code → Review</option>
          </select>
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Repository URL</span>
          <input
            className="create-task-input"
            placeholder="e.g. https://github.com/org/repo.git"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
          />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Target Branch</span>
          <input
            className="create-task-input"
            placeholder="e.g. main"
            value={targetBranch}
            onChange={(e) => setTargetBranch(e.target.value)}
          />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Bitbucket Issue</span>
          <input
            className="create-task-input"
            placeholder="e.g. https://bitbucket.company.com/issues/123"
            value={bitbucketIssue}
            onChange={(e) => setBitbucketIssue(e.target.value)}
          />
        </label>

        <label className="create-task-field">
          <span className="create-task-label">Epic ID</span>
          <input
            className="create-task-input"
            placeholder="e.g. PROJ-epic-42"
            value={epicId}
            onChange={(e) => setEpicId(e.target.value)}
          />
        </label>

        {/* ── Jira ticket status ────────────────────────────────────────── */}
        {jiraStatus.phase === 'creating' && (
          <div className="create-task-jira-status" role="status">
            <span className="create-task-jira-spinner" aria-hidden="true">⏳</span>
            {' '}Creating Jira ticket…
          </div>
        )}

        {jiraStatus.phase === 'created' && (
          <div className="create-task-jira-status create-task-jira-status--ok" role="status">
            <span aria-hidden="true">🎫</span>
            {' '}Jira ticket{' '}
            <a
              href={jiraStatus.url}
              target="_blank"
              rel="noreferrer"
              className="create-task-jira-link"
            >
              {jiraStatus.key}
            </a>
            {' '}created
            {jiraStatus.demo && (
              <span className="create-task-jira-demo-badge" title="Jira is in demo mode — this is a synthetic key">
                {' '}(demo)
              </span>
            )}
            .
          </div>
        )}

        {jiraErrorMessage && (
          <div className="create-task-jira-status create-task-jira-status--error" role="alert">
            <span aria-hidden="true">⚠️</span>
            {' '}Could not create Jira ticket: {jiraErrorMessage}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="create-task-skip-btn"
                onClick={handleSkipJira}
                disabled={isSubmitting}
              >
                Skip Jira &amp; create task anyway
              </button>
            </div>
          </div>
        )}

        <button
          className="create-task-submit"
          type="button"
          onClick={handleCreate}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating…' : 'Create & Queue'}
        </button>

        {error && (
          <div className="create-task-error" role="alert">
            {error}
          </div>
        )}

        {createdTask && (
          <div className="create-task-success" role="status">
            Task &ldquo;{createdTask.title}&rdquo; created and queued
            {createdTask.jiraKey ? ` with Jira ticket ${createdTask.jiraKey}` : ''}.
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateTask;
