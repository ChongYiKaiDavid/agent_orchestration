import React, { useState, useEffect } from 'react';
import PipelineVisualizer from '../components/sections/PipelineVisualizer';
import PRTracking from '../components/sections/PRTracking';
import { deleteTask } from '../api';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  repository: string | null;
  target_branch: string | null;
  pipeline_id: string | null;
  jira_ticket: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

interface TaskDetailsProps {
  taskId: string | null;
  onTaskDeleted?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#4ade80',
  failed: '#ff6b6b',
  running: '#6b9eff',
  processing: '#6b9eff',
  queued: '#fbbf24',
  pr_created: '#9d7fff',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ff6b6b',
  medium: '#fbbf24',
  low: '#4ade80',
};

const TaskDetails: React.FC<TaskDetailsProps> = ({ taskId, onTaskDeleted }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    fetchTask();
    const interval = setInterval(fetchTask, 5000);
    return () => clearInterval(interval);
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      const data = await response.json();
      setTask(data);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId || !window.confirm('Delete this task?')) return;
    try {
      await deleteTask(taskId);
      onTaskDeleted ? onTaskDeleted() : window.location.reload();
    } catch {
      alert('Failed to delete task.');
    }
  };

  const formatStatus = (t: Task) => {
    if (t.status === 'requeued' && t.retry_count > 0) return `Retrying (${t.retry_count})…`;
    if (t.status === 'completed' && t.retry_count > 0) return `Completed after ${t.retry_count} ${t.retry_count > 1 ? 'retries' : 'retry'}`;
    return t.status;
  };

  if (!taskId) return (
    <div className="td-empty">Select a task to view details.</div>
  );

  if (loading) return (
    <div className="td-empty">Loading…</div>
  );

  if (!task) return (
    <div className="td-empty">Task not found.</div>
  );

  const statusColor = STATUS_COLORS[task.status] || 'rgba(243,244,246,0.6)';
  const priorityColor = PRIORITY_COLORS[task.priority?.toLowerCase()] || 'rgba(243,244,246,0.6)';

  return (
    <div className="td-page">

      {/* Header */}
      <div className="td-header">
        <div className="td-header-left">
          <h1 className="td-title">{task.title}</h1>
          <div className="td-badges">
            <span className="td-badge" style={{ color: statusColor, borderColor: statusColor }}>{formatStatus(task)}</span>
            <span className="td-badge" style={{ color: priorityColor, borderColor: priorityColor }}>{task.priority}</span>
            {task.jira_ticket && (
              <span className="td-badge" style={{ color: '#6b9eff', borderColor: '#6b9eff' }}>{task.jira_ticket}</span>
            )}
          </div>
        </div>
        <button className="td-delete-btn" onClick={handleDelete}>Delete</button>
      </div>

      {/* Info card */}
      <div className="td-card">
        <div className="td-card-title">Task Information</div>
        <div className="td-grid">
          <div className="td-field">
            <div className="td-label">Pipeline</div>
            <div className="td-value">{task.pipeline_id === 'auto' ? 'Auto (resolves on start)' : task.pipeline_id || '—'}</div>
          </div>
          <div className="td-field">
            <div className="td-label">Created</div>
            <div className="td-value">{new Date(task.created_at).toLocaleString()}</div>
          </div>
          {task.target_branch && (
            <div className="td-field">
              <div className="td-label">Target Branch</div>
              <div className="td-value">{task.target_branch}</div>
            </div>
          )}
          {task.repository && (
            <div className="td-field td-field--full">
              <div className="td-label">Repository</div>
              <div className="td-value td-value--mono">{task.repository}</div>
            </div>
          )}
          <div className="td-field td-field--full">
            <div className="td-label">Description</div>
            <div className="td-value td-value--pre">{task.description || '—'}</div>
          </div>
        </div>
      </div>

      {/* Pipeline progress */}
      <div className="td-card">
        <div className="td-card-title">Pipeline Progress</div>
        <PipelineVisualizer taskId={taskId} />
      </div>

      {/* PR Tracking */}
      <div className="td-card">
        <PRTracking taskId={taskId} />
      </div>

    </div>
  );
};

export default TaskDetails;
