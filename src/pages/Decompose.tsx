import React, { useState } from 'react';
import { decomposeEpic } from '../api';
import type { DecomposeEpicPayload } from '../api';



interface DraftTask {
  id: string;
  title: string;
  summary: string;
}

const Decompose: React.FC = () => {
  const [epicDescription, setEpicDescription] = useState('');
  const [repository, setRepository] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [jiraTicket, setJiraTicket] = useState('');
  const [drafts, setDrafts] = useState<DraftTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDecompose = async () => {
    setError(null);
    setSuccess(null);

    const trimmed = epicDescription.trim();
    if (!trimmed) {
      setError('Please enter an epic description first.');
      return;
    }

    setLoading(true);
    try {
      const isBitbucket = repository?.includes('bitbucket');
      const payload: DecomposeEpicPayload = {
        description: trimmed,
        repository: !isBitbucket ? repository : undefined,
        targetBranch: targetBranch || undefined,
        jiraTicket: jiraTicket || undefined,
        bitbucketUrl: isBitbucket ? repository : undefined,
      };
      const createdDrafts = await decomposeEpic(payload);

      setDrafts(createdDrafts.map((task: any) => ({
        id: task.id,
        title: task.title,
        summary: task.description || 'No description',
      })));
      setSuccess(`${createdDrafts.length} tasks created from the epic description.`);
      setEpicDescription('');
      setRepository('');
      setTargetBranch('');
      setJiraTicket('');
    } catch (err) {
      setError((err as Error).message || 'Unable to decompose the epic.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="decompose-page">
      <h1 className="decompose-title">Decompose</h1>

      <div className="decompose-form">
        <label className="decompose-field">
          <span className="decompose-label">Epic Description</span>
          <textarea
            className="decompose-textarea"
            placeholder="Describe the feature or epic..."
            rows={5}
            value={epicDescription}
            onChange={(event) => setEpicDescription(event.target.value)}
          />
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

        <button className="decompose-submit" type="button" onClick={handleDecompose} disabled={loading}>
          {loading ? 'Decomposing…' : 'Decompose'}
        </button>

        {error && <div className="decompose-error" role="alert">{error}</div>}
        {success && <div className="decompose-success" role="status">{success}</div>}
      </div>
      <div className="decompose-drafts">
        <h3 className="decompose-drafts-title" aria-label="Drafts">Drafts</h3>

        <div style={{ display: 'grid', gap: 12 }}>
          {drafts.length === 0 && (
            <div className="card">No drafts yet. Enter an epic description and click Decompose.</div>
          )}
          {drafts.map((d) => (
            <div key={d.id} className="card">
              <div style={{ fontWeight: 800 }}>{d.title}</div>
              <div style={{ marginTop: 6, color: 'rgba(243,244,246,0.65)' }}>{d.summary}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Decompose;