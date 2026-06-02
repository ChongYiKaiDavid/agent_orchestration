import React, { useState } from 'react';

const ActivityPage: React.FC = () => {
  const [filterTaskId, setFilterTaskId] = useState('');
  const [eventType, setEventType] = useState('Event type');
  const [eventLevel, setEventLevel] = useState('All levels');

  const eventTypeOptions = [
    'created', 'queued', 'stage_started', 'stage_completed', 'verdict', 
    'pipeline_complete', 'failed', 'escalated', 'retry', 'stopped', 'reset', 'deleted'
  ];

  const eventColors: Record<string, string> = {
    created: '#3b82f6', queued: '#8b5cf6', stage_started: '#f59e0b',
    stage_completed: '#10b981', verdict: '#6366f1', pipeline_complete: '#8b5cf6',
    failed: '#ef4444', escalated: '#f97316', retry: '#eab308', stopped: '#6b7280',
    reset: '#ec4899', deleted: '#dc2626',
  };

  // Map event types to severity levels
  const eventLevels: Record<string, 'info' | 'warning' | 'error'> = {
    created: 'info', queued: 'info', stage_started: 'info',
    stage_completed: 'info', verdict: 'warning', pipeline_complete: 'info',
    failed: 'error', escalated: 'error', retry: 'warning', stopped: 'error',
    reset: 'warning', deleted: 'error',
  };

  const events = [
    { id: 'task-128-1', type: 'created', taskId: '128', title: 'Task created: Release notes automation', detail: 'example/acme-web', timestamp: '1h 30m ago', stage: null },
    { id: 'task-128-2', type: 'queued', taskId: '128', title: 'Task queued for execution', detail: 'example/acme-web', timestamp: '1h 29m ago', stage: null },
    { id: 'task-128-3', type: 'stage_started', taskId: '128', title: 'Planner stage started', detail: 'example/acme-web', timestamp: '1h 28m ago', stage: 'planner' },
    { id: 'task-128-4', type: 'stage_completed', taskId: '128', title: 'Planner stage completed', detail: 'example/acme-web', timestamp: '1h 20m ago', stage: 'planner' },
    { id: 'task-128-5', type: 'verdict', taskId: '128', title: 'Verdict: GO from Planner', detail: 'Proceeding to next stage', timestamp: '1h 20m ago', stage: 'planner' },
    { id: 'task-128-6', type: 'stage_started', taskId: '128', title: 'Coder stage started', detail: 'example/acme-web', timestamp: '1h 19m ago', stage: 'coder' },
    { id: 'task-129-1', type: 'created', taskId: '129', title: 'Task created: UI improvements', detail: 'example/platform-ui', timestamp: '50m ago', stage: null },
    { id: 'task-129-2', type: 'queued', taskId: '129', title: 'Task queued for execution', detail: 'example/platform-ui', timestamp: '49m ago', stage: null },
    { id: 'task-129-3', type: 'stage_started', taskId: '129', title: 'Planner stage started', detail: 'example/platform-ui', timestamp: '48m ago', stage: 'planner' },
    { id: 'task-129-4', type: 'failed', taskId: '129', title: 'Planner stage failed: Invalid requirements', detail: 'example/platform-ui', timestamp: '40m ago', stage: 'planner' },
    { id: 'task-129-5', type: 'retry', taskId: '129', title: 'Retrying Planner stage (1/3)', detail: 'example/platform-ui', timestamp: '39m ago', stage: 'planner' },
    { id: 'task-130-1', type: 'created', taskId: '130', title: 'Task created: Dashboard redesign', detail: 'example/design-system', timestamp: '30m ago', stage: null },
    { id: 'task-131-1', type: 'created', taskId: '131', title: 'Task created: API optimization', detail: 'example/platform-api', timestamp: '15m ago', stage: null },
    { id: 'task-131-2', type: 'escalated', taskId: '131', title: 'Task escalated: Manual review required', detail: 'example/platform-api', timestamp: '5m ago', stage: 'reviewer' },
  ];

  const filteredEvents = events.filter((event) => {
    const matchesTask = !filterTaskId || event.taskId.includes(filterTaskId) || event.title.toLowerCase().includes(filterTaskId.toLowerCase());
    const matchesType = eventType === 'Event type' || event.type === eventType;
    const matchesLevel = eventLevel === 'All levels' || eventLevels[event.type] === eventLevel;

    return matchesTask && matchesType && matchesLevel;
  });

  return (
    <div className="activity-page">
      <h1 className="activity-title">Activity</h1>

      <div className="activity-toolbar">
        <input
          className="activity-search"
          placeholder="Filter by task ID..."
          value={filterTaskId}
          onChange={(event) => setFilterTaskId(event.target.value)}
        />
        <label className="activity-filter-wrap">
          <select
            className="activity-filter-select"
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
          >
            <option value="Event type">Event type</option>
            {eventTypeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
        <label className="activity-filter-wrap">
          <select
            className="activity-filter-select"
            value={eventLevel}
            onChange={(event) => setEventLevel(event.target.value)}
          >
            <option value="All levels">All levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </label>
      </div>

      <div className="activity-canvas">
        <div className="events-list activity-events">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <div key={event.id} className="event activity-event-card">
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,display:'flex',alignItems:'center',gap:8}}>
                    {event.title}
                    <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,background:eventColors[event.type],color:'#fff'}}>{event.type}</span>
                  </div>
                  <div className="task-meta">{event.detail} {event.stage && `· ${event.stage}`}</div>
                  <div className="task-meta" style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>
                    Task {event.taskId} · {event.timestamp}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="activity-empty-state">
              <h2 className="activity-empty-title">No activity found</h2>
              <p className="activity-empty-message">Activity events will appear here as tasks are processed.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;
