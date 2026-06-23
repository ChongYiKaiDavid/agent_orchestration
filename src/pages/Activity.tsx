import React, { useState, useEffect } from 'react';
import { fetchEvents } from '../api';

const ActivityPage: React.FC = () => {
  const [filterTaskId, setFilterTaskId] = useState('');
  const [eventType, setEventType] = useState('Event type');
  const [eventLevel, setEventLevel] = useState('All levels');
  const [events, setEvents] = useState<any[]>([]);

  const eventTypeOptions = [
    'created', 'queued', 'stage_started', 'stage_completed', 'verdict',
    'pipeline_complete', 'failed', 'escalated', 'retry', 'stopped', 'reset', 'deleted',
  ];

  const eventColors: Record<string, string> = {
    created: 'rgba(107,158,255,0.25)',
    queued: 'rgba(157,127,255,0.25)',
    stage_started: 'rgba(251,191,36,0.25)',
    stage_completed: 'rgba(74,222,128,0.25)',
    verdict: 'rgba(157,127,255,0.25)',
    pipeline_complete: 'rgba(157,127,255,0.25)',
    failed: 'rgba(255,107,107,0.25)',
    escalated: 'rgba(249,115,22,0.25)',
    retry: 'rgba(251,191,36,0.25)',
    stopped: 'rgba(156,163,175,0.20)',
    reset: 'rgba(236,72,153,0.25)',
    deleted: 'rgba(255,107,107,0.25)',
  };

  const eventLevels: Record<string, 'info' | 'warning' | 'error'> = {
    created: 'info', queued: 'info', stage_started: 'info',
    stage_completed: 'info', verdict: 'warning', pipeline_complete: 'info',
    failed: 'error', escalated: 'error', retry: 'warning', stopped: 'error',
    reset: 'warning', deleted: 'error',
  };

  useEffect(() => {
    fetchEvents().then(setEvents).catch(() => setEvents([]));
  }, []);

  const filteredEvents = events.filter((event) => {
    const matchesTask = !filterTaskId || `${event.task_id || event.taskId}`.includes(filterTaskId) || event.message?.toLowerCase().includes(filterTaskId.toLowerCase());
    const matchesType = eventType === 'Event type' || event.event_type === eventType || event.type === eventType;
    const matchesLevel = eventLevel === 'All levels' || eventLevels[event.event_type || event.type] === eventLevel;
    return matchesTask && matchesType && matchesLevel;
  });

  return (
    <div className="activity-page">
      <h1 className="activity-title" aria-label="Activity">Activity</h1>


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
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {event.message || event.title}
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: eventColors[event.event_type || event.type], color: '#fff' }}>
                      {event.event_type || event.type}
                    </span>
                  </div>
                  <div className="task-meta">{event.details || event.detail} {event.stage && `· ${event.stage}`}</div>
                  <div className="task-meta" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    Task {event.task_id || event.taskId} · {new Date(event.created_at || event.timestamp || '').toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="activity-empty-state">
              <h2 className="activity-empty-title" aria-label="No activity found">No activity found</h2>

              <p className="activity-empty-message">Activity events will appear here as tasks are processed.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;
