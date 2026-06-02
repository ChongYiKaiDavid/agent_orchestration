import React, { useState, useEffect } from 'react';

const DashboardPage: React.FC = () => {
  const [pipeline, setPipeline] = useState('All pipelines');
  const [status, setStatus] = useState('All statuses');
  const [priority, setPriority] = useState('All priorities');

  const lifecycleStages = [
    { id: 'plan', label: 'Planning', color: 'var(--accent-blue)' },
    { id: 'code', label: 'Coding', color: 'var(--accent-green)' },
    { id: 'review', label: 'Review Code', color: 'var(--accent-yellow)' },
    { id: 'pr', label: 'Create PR', color: 'var(--accent-purple)' },
    { id: 'feedback', label: 'Review feedback', color: 'var(--accent-red)' },
    { id: 'merge', label: 'Merge PR', color: 'var(--accent-green)' },
    { id: 'complete', label: 'Complete', color: 'var(--accent-purple)' },
  ];

  const tasks = [
    { id: '1', stage: 'plan', title: 'Map dashboard filters', project: 'example/acme-web', agent: 'Planner', timestamp: '15m ago', priority: 'High' },
    { id: '2', stage: 'plan', title: 'Confirm task intake fields', project: 'example/platform-ui', agent: 'Planner', timestamp: '28m ago', priority: 'Medium' },
    { id: '3', stage: 'code', title: 'Build task detail cards', project: 'example/acme-web', agent: 'Code Executor', timestamp: '34m ago', priority: 'Medium' },
    { id: '4', stage: 'code', title: 'Wire task preview panel', project: 'example/design-system', agent: 'Code Executor', timestamp: '52m ago', priority: 'Low' },
    { id: '5', stage: 'review', title: 'Validate sidebar layout', project: 'example/platform-ui', agent: 'Reviewer', timestamp: '1h ago', priority: 'High' },
    { id: '6', stage: 'review', title: 'Check responsive overflow', project: 'example/acme-web', agent: 'Reviewer', timestamp: '1h 12m ago', priority: 'Medium' },
    { id: '7', stage: 'pr', title: 'Open release notes PR', project: 'example/design-system', agent: 'Copilot', timestamp: '2h ago', priority: 'Medium' },
    { id: '8', stage: 'pr', title: 'Publish task lifecycle update', project: 'example/platform-api', agent: 'Copilot', timestamp: '2h 15m ago', priority: 'Low' },
    { id: '9', stage: 'feedback', title: 'Track review feedback', project: 'example/platform-api', agent: 'Reviewer', timestamp: '3h ago', priority: 'Low' },
    { id: '10', stage: 'feedback', title: 'Resolve requested copy changes', project: 'example/acme-web', agent: 'Reviewer', timestamp: '3h 30m ago', priority: 'Medium' },
    { id: '11', stage: 'merge', title: 'Merge completed workflow', project: 'example/platform-ui', agent: 'Copilot', timestamp: '5h ago', priority: 'Low' },
    { id: '12', stage: 'merge', title: 'Finalize release branch', project: 'example/design-system', agent: 'Copilot', timestamp: '5h 20m ago', priority: 'Low' },
    { id: '13', stage: 'complete', title: 'Ship onboarding update', project: 'example/acme-web', agent: 'Planner', timestamp: 'Yesterday', priority: 'Low' },
    { id: '14', stage: 'complete', title: 'Close dashboard polish task', project: 'example/platform-ui', agent: 'Planner', timestamp: 'Yesterday', priority: 'Low' },
  ];

  const statusByStage = tasks.reduce<Record<string, typeof tasks>>((accumulator, task) => {
    accumulator[task.stage] = [...(accumulator[task.stage] || []), task];
    return accumulator;
  }, {});

  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((task) => task.stage !== 'complete').length;

  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [pipelineDef, setPipelineDef] = useState<any | null>(null);
  const [stageStatuses, setStageStatuses] = useState<Record<string, string>>({});
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  // Mock PR data (will be fetched from backend /api/tasks/:id/pullrequest)
  const mockPullRequest = {
    pr_number: 1234,
    status: 'open', // draft | open | merged
    url: 'https://github.com/example/acme-web/pull/1234',
    created_at: '2h ago',
    merged_at: null,
    author: 'copilot-bot',
  };

  // Mock stage execution data (will be fetched from backend /api/tasks/:id/executions)
  const mockStageExecutions: Record<string, any> = {
    planner: {
      status: 'completed',
      verdict: 'GO',
      input_data: { taskTitle: selectedTask?.title },
      output_data: 'Plan created successfully',
      logs: 'Planner: analyzing requirements...\nPlanner: generating plan...\nCompleted.',
      started_at: '3h ago',
      completed_at: '2h 55m ago',
      retry_count: 0,
    },
    architect: {
      status: 'completed',
      verdict: 'GO',
      input_data: { plan: 'plan.md' },
      output_data: 'Design document ready',
      logs: 'Architect: reviewing plan...\nArchitect: designing system...\nCompleted.',
      started_at: '2h 55m ago',
      completed_at: '2h 30m ago',
      retry_count: 0,
    },
    coder: {
      status: 'running',
      verdict: null,
      input_data: { design: 'design.txt' },
      output_data: null,
      logs: 'Coder: generating code...\n[In progress]',
      started_at: '2h 30m ago',
      completed_at: null,
      retry_count: 0,
    },
    reviewer: {
      status: 'pending',
      verdict: null,
      input_data: null,
      output_data: null,
      logs: '',
      started_at: null,
      completed_at: null,
      retry_count: 0,
    },
  };

  useEffect(() => {
    if (!selectedTask) return;

    // Try to fetch pipeline definition from backend; fallback to a mock definition
    const fetchPipeline = async () => {
      const fallback = {
        id: selectedTask.pipeline || 'plan-code-review',
        name: selectedTask.pipeline || 'Plan → Code → Review',
        stages: [
          { id: 'planner', name: 'Planner', agent: 'Planner' },
          { id: 'architect', name: 'Architect', agent: 'Architect' },
          { id: 'coder', name: 'Coder', agent: 'Code Executor' },
          { id: 'reviewer', name: 'Reviewer', agent: 'Reviewer' },
        ],
        artifacts: {
          planner: [{ id: 'plan-1', name: 'plan.md' }],
          architect: [{ id: 'arch-1', name: 'design.txt' }],
          coder: [{ id: 'code-1', name: 'feature.patch' }],
          reviewer: [],
        },
      };

      let def = fallback;
      try {
        const id = encodeURIComponent(selectedTask.pipeline || selectedTask.pipelineId || fallback.id);
        const res = await fetch(`/api/pipelines/${id}`);
        if (res.ok) {
          def = await res.json();
        }
      } catch (err) {
        // ignore, use fallback
      }

      setPipelineDef(def);

      // derive stage statuses from selectedTask.stage
      const ids = lifecycleStages.map((s) => s.id);
      const currentIndex = ids.indexOf(selectedTask.stage || 'plan');
      const statuses: Record<string, string> = {};
      def.stages.forEach((st: any, idx: number) => {
        const name = st.id || (st.name || '').toLowerCase();
        if (idx < (currentIndex === -1 ? 0 : currentIndex)) statuses[name] = 'Completed';
        else if (idx === currentIndex) statuses[name] = 'Running';
        else statuses[name] = 'Pending';
      });

      setStageStatuses(statuses);
    };

    fetchPipeline();
  }, [selectedTask]);

  const pipelineOptions = ['All pipelines', 'Code Only', 'Plan → Code → Review'];
  const statusOptions = ['All statuses', 'Open', 'In progress', 'Done'];
  const priorityOptions = ['All priorities', 'Low', 'Medium', 'High'];

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div className="dashboard-kicker">Task lifecycle</div>
        <h1 className="dashboard-title">End-to-end task delivery</h1>
        <p className="dashboard-subtitle">Track each task from planning through merge and completion.</p>
      </div>

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
                    className="dashboard-task-card"
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTask(task)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTask(task); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="dashboard-task-top">
                      <div>
                        <div className="dashboard-task-title">{task.title}</div>
                        <div className="dashboard-task-meta">{task.project} · {task.agent} · {task.timestamp}</div>
                      </div>
                      <div className="dashboard-task-chip">{task.priority}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          ))}
        </div>
      </div>

      <div className="dashboard-canvas" aria-hidden="true" />

      <div className="dashboard-footer-stats">
        <div>
          <div className="dashboard-footer-value">{totalTasks}</div>
          <div className="dashboard-footer-label">TOTAL</div>
        </div>
        <div>
          <div className="dashboard-footer-value">{activeTasks}</div>
          <div className="dashboard-footer-label">ACTIVE</div>
        </div>
      </div>
      {selectedTask && (
        <div className="task-detail-overlay" onClick={() => setSelectedTask(null)}>
          <div className="task-detail-panel" onClick={(e) => e.stopPropagation()}>
            <button className="task-detail-close" onClick={() => setSelectedTask(null)}>×</button>
            <div className="task-detail-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div>
                <h3 className="task-detail-title" style={{marginBottom:6}}>{selectedTask.title}</h3>
                <div className="task-detail-meta">Task ID: {selectedTask.id} · {selectedTask.timestamp}</div>
                <div className="task-detail-meta" style={{marginTop:8}}>{selectedTask.project}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:13,color:'rgba(243,244,246,0.65)',fontWeight:700}}>Pipeline</div>
                <div style={{fontWeight:800,marginTop:6}}>{pipelineDef?.name || selectedTask.pipeline || '—'}</div>
                <div style={{marginTop:10,fontSize:13,color:'rgba(243,244,246,0.7)'}}>Status: <strong style={{color:'var(--accent-blue)'}}>{(() => {
                  const idx = lifecycleStages.findIndex(s => s.id === selectedTask.stage);
                  if (selectedTask.stage === 'complete' || idx === lifecycleStages.length - 1) return 'Done';
                  if (idx === 0) return 'Queued';
                  return 'Running';
                })()}</strong></div>
              </div>
            </div>

            <div className="task-detail-body">
              {/* PR Tracking Section */}
              {mockPullRequest && (
                <div style={{marginTop:0,paddingBottom:14,borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                  <div style={{fontWeight:800,marginBottom:8}}>Pull Request</div>
                  <div className="card" style={{padding:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <div>
                        <div style={{fontWeight:700}}>PR #{mockPullRequest.pr_number}</div>
                        <div style={{fontSize:12,color:'rgba(243,244,246,0.6)',marginTop:4}}>{mockPullRequest.created_at}</div>
                      </div>
                      <div style={{padding:'4px 8px',borderRadius:999,background:mockPullRequest.status === 'merged' ? 'rgba(34,197,94,0.1)' : 'rgba(107,158,255,0.1)',fontSize:12,fontWeight:700,color:mockPullRequest.status === 'merged' ? 'var(--accent-green)' : 'var(--accent-blue)'}}>{mockPullRequest.status === 'merged' ? '✓ Merged' : mockPullRequest.status === 'open' ? '● Open' : '◐ Draft'}</div>
                    </div>
                    <a href={mockPullRequest.url} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:'var(--accent-blue)',textDecoration:'underline'}}>{mockPullRequest.url}</a>
                  </div>
                </div>
              )}

              {/* Pipeline Stages Section */}
              <div style={{marginTop:14}}>
                <div style={{fontWeight:800,marginBottom:8}}>Pipeline Stages</div>
                <div className="pipeline-visual">
                  {(pipelineDef?.stages || []).map((st: any) => {
                    const exec = mockStageExecutions[st.id];
                    const verdictColor = exec?.verdict === 'GO' ? 'var(--accent-green)' : exec?.verdict === 'FAIL' ? 'var(--accent-red)' : exec?.verdict === 'SPEC_FAIL' ? 'var(--accent-yellow)' : exec?.verdict === 'ESCALATE' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.3)';
                    return (
                      <div key={st.id} className="pipeline-stage" style={{cursor:'pointer'}} onClick={() => setExpandedStage(expandedStage === st.id ? null : st.id)}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <div className="stage-name">{st.name}</div>
                            <div className="stage-agent">{st.agent}</div>
                          </div>
                          <div style={{display:'flex',gap:8,alignItems:'center'}}>
                            {exec?.verdict && <div style={{padding:'4px 8px',borderRadius:6,background:verdictColor,fontSize:11,fontWeight:700,color:'#000'}}>{exec.verdict}</div>}
                            <div className="stage-status-badge">{stageStatuses[st.id] || 'Pending'}</div>
                          </div>
                        </div>
                        {expandedStage === st.id && exec && (
                          <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.03)'}}>
                            <div style={{fontSize:12,lineHeight:1.6,color:'rgba(243,244,246,0.7)'}}>
                              {exec.logs && <div style={{marginBottom:8}}><strong>Logs:</strong><div style={{background:'rgba(0,0,0,0.3)',padding:8,borderRadius:6,fontFamily:'monospace',fontSize:11,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{exec.logs}</div></div>}
                              {exec.output_data && <div style={{marginBottom:8}}><strong>Output:</strong> {exec.output_data}</div>}
                              <div style={{display:'flex',gap:12,fontSize:11}}>
                                <div>Started: {exec.started_at || '—'}</div>
                                {exec.completed_at && <div>Completed: {exec.completed_at}</div>}
                                <div>Retries: {exec.retry_count}</div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="artifacts-list">
                          {(pipelineDef?.artifacts?.[st.id] || []).map((a: any) => (
                            <div key={a.id} className="artifact-item">{a.name}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{marginTop:18}}>
                <div style={{fontWeight:800,marginBottom:8}}>Artifacts</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {Object.keys(pipelineDef?.artifacts || {}).map((stageId) => (
                    (pipelineDef?.artifacts?.[stageId] || []).map((a: any) => (
                      <div key={a.id} className="artifact-item">
                        <div style={{fontWeight:700}}>{a.name}</div>
                        <div style={{fontSize:12,color:'rgba(243,244,246,0.6)'}}>{stageId}</div>
                      </div>
                    ))
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
