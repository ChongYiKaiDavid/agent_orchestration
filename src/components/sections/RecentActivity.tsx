import React, { useEffect, useState } from 'react';
import { fetchEvents } from '../../api';

export const RecentActivity: React.FC = () => {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    fetchEvents()
      .then((data) => {
        if (Array.isArray(data)) {
          setActivities(data.slice(0, 4).map((a: any) => ({
            id: a.id,
            icon: a.event_type === 'created' ? '📝' : a.event_type === 'failed' ? '❌' : '✓',
            title: a.message,
            project: a.details ? JSON.parse(a.details).repository : '',
            timestamp: new Date(a.created_at).toLocaleString(),
          })));
        }
      })
      .catch((err) => console.error('Failed to fetch events for activities', err));
  }, []);

  return (
    <div>
      {activities.length === 0 ? (
        <div style={{ padding: '12px', color: 'rgba(255,255,255,0.5)' }}>No recent activity.</div>
      ) : (
        activities.map((activity) => (
          <div key={activity.id} style={{display:'flex',gap:12,marginBottom:12}}>
            <div style={{width:36,height:36,borderRadius:8,background:'rgba(255,255,255,0.02)',display:'flex',alignItems:'center',justifyContent:'center'}}>{activity.icon}</div>
            <div>
              <div style={{fontWeight:700}}>{activity.title}</div>
              {activity.project && <div className="task-meta">{activity.project}</div>}
              <div className="task-meta" style={{fontSize:12}}>{activity.timestamp}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
