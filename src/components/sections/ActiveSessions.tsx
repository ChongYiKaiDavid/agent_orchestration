import React from 'react';
import type { Session } from '../../types';

export const ActiveSessions: React.FC = () => {
  const sessions: Session[] = [
    {
      id: '1',
      name: 'feature/release-plan',
      branch: 'example/acme-web',
      project: 'example/acme-web',
      timestamp: '12h ago',
    },
  ];

  return (
    <div>
      {sessions.map((session) => (
        <div key={session.id} className="card" style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:700}}>{session.name}</div>
              <div className="task-meta">{session.branch} · {session.timestamp}</div>
            </div>
            <div style={{width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid rgba(255,255,255,0.03)'}}>◯</div>
          </div>
        </div>
      ))}
    </div>
  );
};
