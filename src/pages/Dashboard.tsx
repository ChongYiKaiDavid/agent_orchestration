import React, { useState, useEffect } from 'react';
import { fetchTasks, fetchTaskExecutions, deleteTask } from '../api';


interface DashboardPageProps {
  onViewTask: (taskId: string) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onViewTask }) => {
  const [pipeline, setPipeline] = useState('All pipelines');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [priority, setPriority] = useState('All priorities');
  const [searchText, setSearchText] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [executionDetails, setExecutionDetails] = useState<any | null>(null);

  const lifecycleStages = [
    { id: 'plan', label: 'Planning', color: 'var(--accent-blue)' },
    { id: 'code', label: 'Coding', color: 'var(--accent-green)' },
    { id: 'review', label: 'Review Code', color: 'var(--accent-yellow)' },
    { id: 'pr', label: 'Create PR', color: 'var(--accent-purple)' },
    { id: 'feedback', label: 'Review feedback', color: 'var(--accent-red)' },
    { id: 'merge', label: 'Merge PR', color: 'var(--accent-green)' },
    { id: 'complete', label: 'Complete', color: 'var(--accent-purple)' },
  ];

  useEffect(() => {
    fetchTasks()
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    if (!selectedTask) {
      setExecutionDetails(null);
      return;
    }

    fetchTaskExecutions(selectedTask.id)
      .then(setExecutionDetails)
      .catch(() => setExecutionDetails(null));
  }, [selectedTask]);

  function statusToStage(task: any) {
    if (!task) return 'plan';
    switch (task.status) {
      case 'queued':
        return 'plan';
      case 'running':
        return 'code';
      case 'pr_created':
        return 'pr';
      case 'completed':
        return 'complete';
      case 'failed':
        return 'feedback';
      default:
        return 'plan';
    }
  }

  const mappedTasks = tasks.map((task) => ({
    ...task,
    stage: statusToStage(task),
    project: task.repository || 'Unknown repository',
    agent: task.pipeline_id === 'gemini-code-only' ? 'Gemini CLI' : 'Devin',
    timestamp: new Date(task.updated_at).toLocaleString(),
    priority: task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium',
  }));

  const filteredTasks = mappedTasks.filter((task) => {
    const query = searchText.trim().toLowerCase();
    const matchesSearch =
      !query ||
      task.title.toLowerCase().includes(query) ||
      task.project.toLowerCase().includes(query) ||
      task.agent.toLowerCase().includes(query);

    const taskStatus = task.stage === 'complete' ? 'Done' : ['plan', 'pr', 'feedback'].includes(task.stage) ? 'Open' : 'In progress';
    const matchesStatus = statusFilter === 'All statuses' || taskStatus === statusFilter;
    const matchesPriority = priority === 'All priorities' || task.priority === priority;

    const matchesPipeline = pipeline === 'All pipelines' || (pipeline === 'Code Only' && task.pipeline_id === 'code-only') || (pipeline === 'Plan → Code → Review' && task.pipeline_id === 'plan-code-review') || (pipeline === 'Gemini Code Only' && task.pipeline_id === 'gemini-code-only');

    return matchesSearch && matchesStatus && matchesPriority && matchesPipeline;
  });

  const statusByStage = filteredTasks.reduce<Record<string, any[]>>((accumulator, task) => {
    accumulator[task.stage] = [...(accumulator[task.stage] || []), task];
    return accumulator;
  }, {});

  const pullRequest = executionDetails?.pullRequest || null;

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div className="dashboard-kicker">Task lifecycle</div>
        <h1 className="dashboard-title">End-to-end task delivery</h1>
        <p className="dashboard-subtitle">Track each task from planning through merge and completion.</p>
      </div>

      <div className="dashboard-toolbar">
        <div className="dashboard-search">
          <input
            className="dashboard-search-input"
            placeholder="Search tasks..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>

        <div className="dashboard-filters">
          <label className="dashboard-filter-wrap">
            <select
              className="dashboard-filter-select"
              value={pipeline}
              onChange={(event) => setPipeline(event.target.value)}
            >
              <option value="All pipelines">All pipelines</option>
              <option value="Code Only">Code Only</option>
              <option value="Plan → Code → Review">Plan → Code → Review</option>
              <option value="Gemini Code Only">Gemini Code Only</option>
            </select>
          </label>

          <label className="dashboard-filter-wrap">
            <select
              className="dashboard-filter-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All statuses">All statuses</option>
              <option value="Open">Open</option>
              <option value="In progress">In progress</option>
              <option value="Done">Done</option>
            </select>
          </label>

          <label className="dashboard-filter-wrap">
            <select
              className="dashboard-filter-select"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="All priorities">All priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>
        </div>

        <label className="dashboard-select-all">
          <input type="checkbox" checked={selectAll} onChange={() => setSelectAll((prev) => !prev)} />
          <span>Select all</span>
        </label>
      </div>

      <div className="dashboard-status-row">
        <div className="dashboard-status-grid">
          {lifecycleStages.map((item, index) => (
            <div className="dashboard-status dashboard-status-column" key={item.id}>
              <div className="dashboard-status-header">
                <span className="dashboard-status-dot" style={{ background: item.color }} />
                <span className="dashboard-status-label">{index + 1}. {item.label}</span>
              </div>
              <div className="dashboard-status-lane">
                <div className="dashboard-task-list">
                  {(statusByStage[item.id] || []).map((task) => (
                    <div
                      className={`dashboard-task-card ${selectAll ? 'selected' : ''}`}
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSelectedTask(task); onViewTask(task.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTask(task); }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="dashboard-task-top">
                        <div>
                          <div className="dashboard-task-title">{task.title}</div>
                          <div className="dashboard-task-meta">{task.project} · {task.agent} · {task.timestamp}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedTask && (
        <div className="dashboard-selected-task">
          <div className="dashboard-selected-task-header">
            <h2>{selectedTask.title}</h2>
            <button
              className="dashboard-delete-btn"
              type="button"
              onClick={async () => {
                if (!window.confirm(`Delete task ${selectedTask.id}?`)) return;
                try {
                  await deleteTask(selectedTask.id);
                  setSelectedTask(null);
                  setExecutionDetails(null);
                  // refresh tasks list
                  fetchTasks().then(setTasks).catch(() => setTasks([]));
                } catch (e) {
                  console.error('Failed to delete task', e);
                }
              }}
            >
              Delete
            </button>
          </div>
          <p>{selectedTask.description || 'No description available.'}</p>


          <div className="dashboard-task-details">
            <div>Repository: {selectedTask.project}</div>
            <div>Status: {selectedTask.status}</div>
            <div>Pipeline: {selectedTask.pipeline_id}</div>
          </div>

          {executionDetails && (
            <div className="dashboard-execution-details">
              <h3>Latest execution</h3>
              <div className="dashboard-stage-list">
                {executionDetails.stageExecutions.map((stage: any) => (
                  <div key={stage.id} className="dashboard-stage-card">
                    <strong>{stage.stage_name}</strong>
                    <div>Status: {stage.status}</div>
                    <div>Verdict: {stage.verdict || 'N/A'}</div>
                    <div>Started: {stage.started_at}</div>
                    <div>Completed: {stage.completed_at || 'In progress'}</div>
                  </div>
                ))}
              </div>
              {pullRequest && (
                <div className="dashboard-pull-request">
                  <h4>Pull request</h4>
                  <a href={pullRequest.url} target="_blank" rel="noreferrer">{pullRequest.url}</a>
                  <div>Status: {pullRequest.status}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

