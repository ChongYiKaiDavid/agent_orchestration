import React, { useState } from 'react';

const ActivityPage: React.FC = () => {
  const [filterTaskId, setFilterTaskId] = useState('');
  const [eventType, setEventType] = useState('Event type');
  const [eventLevel, setEventLevel] = useState('All levels');

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
            <option value="Info">Info</option>
            <option value="Warning">Warning</option>
            <option value="Error">Error</option>
          </select>
        </label>
        <label className="activity-filter-wrap">
          <select
            className="activity-filter-select"
            value={eventLevel}
            onChange={(event) => setEventLevel(event.target.value)}
          >
            <option value="All levels">All levels</option>
            <option value="Info">Info</option>
            <option value="Warning">Warning</option>
            <option value="Error">Error</option>
          </select>
        </label>
      </div>

      <div className="activity-canvas">
        <div className="activity-empty-state">
          <h2 className="activity-empty-title">No activity found</h2>
          <p className="activity-empty-message">Activity events will appear here as tasks are processed.</p>
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;
