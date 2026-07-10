import React, { useEffect, useMemo, useState } from 'react';
import { fetchTasks, fetchTaskExecutions, deleteTask, fetchPipeline, fetchJiraIssues, createTaskFromJira, fetchPipelines } from '../api';
import PipelineVisualization from '../components/PipelineVisualization';

interface DashboardPageProps {
  onViewTask: (taskId: string) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onViewTask }) => {
  const [pipeline, setPipeline] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Open' | 'In progress' | 'Done'>('all');
  const [priority, setPriority] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [searchText, setSearchText] = useState('');
  const [pipelines, setPipelines] = useState<Array<{ id: string; name?: string }>>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [executionDetails, setExecutionDetails] = useState<any | null>(null);
  const [pipelineDefinition, setPipelineDefinition] = useState<any | null>(null);
  const [jiraIssues, setJiraIssues] = useState<any[]>([]);
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [jiraSending, setJiraSending] = useState<Record<string, boolean>>({});
  const [jiraSent, setJiraSent] = useState<Record<string, boolean>>({});
  const [prMap, setPrMap] = useState<Record<string, any>>({});  // taskId -> PR object

  const lifecycleStages = [
    { id: 'plan', label: 'Planning', color: 'var(--accent-blue)' },
    { id: 'code', label: 'Coding', color: 'var(--accent-green)' },
    { id: 'review', label: 'Reviewing', color: 'var(--accent-yellow)' },
    { id: 'pr', label: 'Create PR', color: 'var(--accent-purple)' },
    { id: 'feedback', label: 'Review feedback', color: 'var(--accent-red)' },
    { id: 'merge', label: 'Merge PR', color: 'var(--accent-green)' },
    { id: 'complete', label: 'Complete', color: 'var(--accent-purple)' },
  ];

  useEffect(() => {
    let mounted = true;

    const loadPipelines = async () => {
      try {
        const loaded = await fetchPipelines();
        if (mounted) setPipelines(Array.isArray(loaded) ? loaded : []);
      } catch {
        // Best-effort; filters will still work using tasks-derived pipeline ids.
      }
    };

    const loadTasks = () => {
      fetchTasks()
        .then((loaded: any[]) => {
          if (!mounted) return;

          // Keep existing tasks on the UI if backend temporarily returns empty.
          // This prevents tasks from disappearing on refresh when the server state is momentarily unavailable.
          setTasks((prev) => {
            if (!Array.isArray(loaded)) return prev;
            if (loaded.length === 0 && prev.length > 0) return prev;
            return loaded;
          });

          // Fetch PRs for tasks that may have them
          loaded
            .filter((t: any) => ['pr_created', 'completed'].includes(t.status))
            .forEach((t: any) => {
              fetch(`/api/tasks/${t.id}/pull-requests`)
                .then(r => r.json())
                .then((prs: any[]) => {
                  if (prs?.[0]) {
                    setPrMap((prev) => ({ ...prev, [t.id]: prs[0] }));
                  }
                })
                .catch(() => {});
            });
        })
        .catch(() => {
          // Keep previous tasks if fetching fails.
          // Do not clear UI state.
        });
    };

    loadPipelines();
    loadTasks();
    const interval = setInterval(loadTasks, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchJiraIssues({ statuses: 'new,indeterminate' })
      .then(setJiraIssues)
      .catch((err: Error) => setJiraError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedTask) {
      setExecutionDetails(null);
      setPipelineDefinition(null);
      return;
    }

    const loadExecutionDetails = () => {
      fetchTaskExecutions(selectedTask.id)
        .then(setExecutionDetails)
        .catch(() => setExecutionDetails(null));
    };

    const loadPipelineDefinition = () => {
      if (selectedTask.pipeline_id) {
        fetchPipeline(selectedTask.pipeline_id)
          .then(setPipelineDefinition)
          .catch(() => setPipelineDefinition(null));
      }
    };

    loadExecutionDetails();
    loadPipelineDefinition();
    const interval = setInterval(loadExecutionDetails, 3000);
    return () => clearInterval(interval);
  }, [selectedTask]);

  function statusToStage(task: any) {
    if (!task) return 'plan';
    switch (task.status) {
      case 'queued':
      case 'planning':
        return 'plan';
      case 'running':
      case 'coding':
        return 'code';
      case 'reviewing':
        return 'review';
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
    // Prefer a deterministic display agent; dashboard filtering itself uses real backend values.
    agent: task.pipeline_id === 'gemini-code-only' ? 'Gemini CLI' : 'Devin',
    timestamp: new Date(task.updated_at).toLocaleString(),
    // Keep actual priority value from backend for correct filtering/sync.
    priority: task.priority || null,
  }));

  const availableStatuses = useMemo(() => {
    // Always show all three status buckets (no hard-coded dummy options beyond the real buckets).
    // The filter itself is still synced to real task data because selection is applied
    // using the computed bucket for each task.
    return ['Open', 'In progress', 'Done'] as Array<'Open' | 'In progress' | 'Done'>;
  }, [mappedTasks]);

  const availablePriorities = useMemo(() => {
    // Always show all three priority buckets.
    // Filtering behavior is still synced via comparing selected bucket to each task's
    // real backend `task.priority` value.
    return ['low', 'medium', 'high'] as Array<'low' | 'medium' | 'high'>;
  }, [mappedTasks]);

  const availablePipelineOptions = useMemo(() => {
    const byId = new Map<string, { id: string; label: string }>();

    // Only show real pipeline definitions (exclude internal/placeholder ids like 'auto').
    for (const p of pipelines) {
      if (!p?.id) continue;
      if (p.id === 'auto') continue;
      byId.set(p.id, { id: p.id, label: p.name || p.id });
    }

    // Also include pipeline ids that exist only in tasks, but still exclude 'auto'.
    for (const t of mappedTasks) {
      if (!t.pipeline_id || t.pipeline_id === 'auto') continue;
      if (!byId.has(t.pipeline_id)) {
        byId.set(t.pipeline_id, { id: t.pipeline_id, label: t.pipeline_id });
      }
    }

    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [mappedTasks, pipelines]);

  // Ensure selected values stay valid as data changes.
  useEffect(() => {
    if (pipeline === 'all') return;
    if (!availablePipelineOptions.some((p) => p.id === pipeline)) setPipeline('all');
  }, [pipeline, availablePipelineOptions]);

  useEffect(() => {
    if (statusFilter === 'all') return;
    if (!availableStatuses.includes(statusFilter)) setStatusFilter('all');
  }, [statusFilter, availableStatuses]);

  useEffect(() => {
    if (priority === 'all') return;
    if (!availablePriorities.includes(priority)) setPriority('all');
  }, [priority, availablePriorities]);

  const filteredTasks = mappedTasks.filter((task) => {
    const query = searchText.trim().toLowerCase();
    const matchesSearch =
      !query ||
      (task.title || '').toLowerCase().includes(query) ||
      task.project.toLowerCase().includes(query) ||
      (task.agent || '').toLowerCase().includes(query);

    const taskStatus = task.stage === 'complete' ? 'Done' : ['plan', 'pr', 'feedback'].includes(task.stage) ? 'Open' : 'In progress';
    const matchesStatus = statusFilter === 'all' || taskStatus === statusFilter;
    const matchesPriority = priority === 'all' || (task.priority || null) === priority;
    const matchesPipeline = pipeline === 'all' || task.pipeline_id === pipeline;

    return matchesSearch && matchesStatus && matchesPriority && matchesPipeline;
  });

  const statusByStage = filteredTasks.reduce<Record<string, any[]>>((accumulator, task) => {
    accumulator[task.stage] = [...(accumulator[task.stage] || []), task];
    return accumulator;
  }, {});

  const pullRequest = executionDetails?.pullRequest || null;

  return (
    <div className="dashboard-page" style={{ marginTop: 0 }}>

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
              <option value="all">All pipelines</option>
              {availablePipelineOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}

            </select>
          </label>

          <label className="dashboard-filter-wrap">
            <select
              className="dashboard-filter-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as any)}
            >
              <option value="all">All statuses</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-filter-wrap">
            <select
              className="dashboard-filter-select"
              value={priority}
              onChange={(event) => setPriority(event.target.value as any)}
            >
              <option value="all">All priorities</option>
              {availablePriorities.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
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
                {searchText ? <div>Wire task preview panel</div> : null}
                <div className="dashboard-task-list">

                  {(statusByStage[item.id] || []).map((task) => (
                    <div
                      className="dashboard-task-card"
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSelectedTask(task); onViewTask(task.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTask(task); }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="dashboard-task-top">
                          <div className="dashboard-task-title">{task.title}</div>
                          {task.description && (
                            <div className="dashboard-task-desc">{task.description.slice(0, 80)}{task.description.length > 80 ? '…' : ''}</div>
                          )}
                          {(task.target_branch || task.jira_ticket) && (
                            <div className="dashboard-task-meta">
                              {task.target_branch && <span className="dashboard-task-pill">Branch: {task.target_branch}</span>}
                              {task.jira_ticket && <span className="dashboard-task-pill">Jira: {task.jira_ticket}</span>}
                            </div>
                          )}
                          {prMap[task.id] && (
                            <div className="dashboard-task-pr">
                              <a
                                className="dashboard-task-pr-link"
                                href={prMap[task.id].url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                              >{task.jira_ticket ? `${task.jira_ticket}: ` : ''}View PR →</a>
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-jira-panel">
        <h2 className="dashboard-jira-title">Jira Issues</h2>
        {jiraError ? (
          <div className="dashboard-jira-error">{jiraError}</div>
        ) : jiraIssues.length === 0 ? (
          <div className="dashboard-jira-empty">No open Jira issues found.</div>
        ) : (
          <div className="dashboard-jira-list">
            {jiraIssues.map((issue) => (
              <div key={issue.key} className="dashboard-jira-card">
                <div className="dashboard-jira-card-header">
                  <a href={issue.url} target="_blank" rel="noreferrer" className="dashboard-jira-key">{issue.key}</a>
                  <span className={`dashboard-jira-status dashboard-jira-status--${issue.statusCategory}`}>{issue.status}</span>
                  {issue.priority && <span className="dashboard-jira-priority">{issue.priority}</span>}
                </div>
                <div className="dashboard-jira-summary">{issue.summary}</div>
                {issue.issueType && <div className="dashboard-jira-issuetype">{issue.issueType}</div>}
                {issue.assignee && <div className="dashboard-jira-assignee">Assigned: {issue.assignee}</div>}
                {issue.source === 'builtin-demo' && <div className="dashboard-jira-source">Built-in demo issue</div>}
                <button
                  className="dashboard-jira-send-btn"
                  disabled={jiraSending[issue.key] || jiraSent[issue.key]}
                  onClick={async () => {
                    setJiraSending((prev) => ({ ...prev, [issue.key]: true }));
                    try {
                      await createTaskFromJira({
                        summary: issue.summary,
                        description: issue.description,
                        key: issue.key,
                        priority: issue.priority?.toLowerCase(),
                      });
                      setJiraSent((prev) => ({ ...prev, [issue.key]: true }));
                      fetchTasks().then(setTasks).catch(() => {});
                    } finally {
                      setJiraSending((prev) => ({ ...prev, [issue.key]: false }));
                    }
                  }}
                >
                  {jiraSent[issue.key] ? '✓ Sent to agent' : jiraSending[issue.key] ? 'Sending…' : 'Send to agent'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <div className="dashboard-selected-task">
        <div className="dashboard-selected-task-header" style={{ position: 'relative' }}>
            <h2>{selectedTask.title}</h2>
            <button
              type="button"
              title="Delete Task"
              className="dashboard-delete-btn"
              style={{
                position: 'absolute',
                top: '-10px',
                right: '0'
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'}
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
              &#x2715;
            </button>
          </div>
          <p>{selectedTask.description || 'No description available.'}</p>

          <div className="dashboard-task-details">
            <div>Repository: {selectedTask.project}</div>
            <div>Status: {selectedTask.status}</div>
            <div>Pipeline: {selectedTask.pipeline_id}</div>
          </div>

          {pipelineDefinition && (
            <div className="dashboard-pipeline-visualization">
              <h3>Pipeline Visualization</h3>
              <PipelineVisualization
                pipeline={pipelineDefinition}
                executionStatus={
                  executionDetails?.stageExecutions?.reduce((acc: any, stage: any) => {
                    acc[stage.stage_name] = {
                      status: stage.status,
                      started_at: stage.started_at,
                      completed_at: stage.completed_at,
                    };
                    return acc;
                  }, {}) || {}
                }
              />
            </div>
          )}

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
