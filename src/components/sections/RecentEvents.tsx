import React, { useEffect, useState } from 'react';
import type { Event } from '../../types';
import { fetchEvents } from '../../api';

export const RecentEvents: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetchEvents()
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data.slice(0, 5).map((e: any) => ({
            id: e.id,
            type: e.event_type,
            message: e.message,
            timestamp: new Date(e.created_at).toLocaleString(),
            icon: e.event_type === 'created' ? '📝' : e.event_type === 'failed' ? '❌' : '✅',
          })));
        }
      })
      .catch((err) => console.error('Failed to fetch events', err));
  }, []);

  return (
    <div className="events-list">
      {events.length === 0 ? (
        <div style={{ padding: '12px', color: 'rgba(255,255,255,0.5)' }}>No recent events.</div>
      ) : (
        events.map((event) => (
          <div key={event.id} className="event">
            <div style={{fontSize:18}}>{event.icon}</div>
            <div>
              <div style={{fontWeight:700}}>{event.type}</div>
              <div className="task-meta">{event.message}</div>
              <div className="task-meta" style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>{event.timestamp}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
