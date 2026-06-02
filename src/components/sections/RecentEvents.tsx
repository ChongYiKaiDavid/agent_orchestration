import React from 'react';
import type { Event } from '../../types';

export const RecentEvents: React.FC = () => {
  const events: Event[] = [
    {
      id: '1',
      type: 'Scheduled',
      message: 'Mock pod scheduled',
      timestamp: '11h ago',
      icon: '⏰',
    },
    {
      id: '2',
      type: 'Connected',
      message: 'Connected repository example/acme-web',
      timestamp: '10h ago',
      icon: '🔗',
    },
    {
      id: '3',
      type: 'Started',
      message: 'Frontend pod started successfully',
      timestamp: '11h ago',
      icon: '▶️',
    },
    {
      id: '4',
      type: 'Completed',
      message: 'Release notes automation queued for review',
      timestamp: '1d ago',
      icon: '✅',
    },
  ];

  return (
    <div className="events-list">
      {events.map((event) => (
        <div key={event.id} className="event">
          <div style={{fontSize:18}}>{event.icon}</div>
          <div>
            <div style={{fontWeight:700}}>{event.type}</div>
            <div className="task-meta">{event.message}</div>
            <div className="task-meta" style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>{event.timestamp}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
