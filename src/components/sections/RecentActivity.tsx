import React from 'react';

export const RecentActivity: React.FC = () => {
  const activities = [
    {
      id: '1',
      icon: '✓',
      title: 'Task "Refactor dashboard filtering" moved to running',
      project: 'Frontend Demo',
      timestamp: '10h ago',
    },
    {
      id: '2',
      icon: '🔗',
      title: 'Connected repository example/acme-web',
      project: 'Frontend Demo',
      timestamp: '10h ago',
    },
    {
      id: '3',
      icon: '▶️',
      title: 'Frontend pod started successfully',
      project: '',
      timestamp: '11h ago',
    },
    {
      id: '4',
      icon: '📝',
      title: 'Draft task created for release notes automation',
      project: 'Frontend Demo',
      timestamp: '1d ago',
    },
  ];

  return (
    <div>
      {activities.map((activity) => (
        <div key={activity.id} style={{display:'flex',gap:12,marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'rgba(255,255,255,0.02)',display:'flex',alignItems:'center',justifyContent:'center'}}>{activity.icon}</div>
          <div>
            <div style={{fontWeight:700}}>{activity.title}</div>
            {activity.project && <div className="task-meta">{activity.project}</div>}
            <div className="task-meta" style={{fontSize:12}}>{activity.timestamp}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
