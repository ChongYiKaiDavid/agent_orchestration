import React from 'react';
import type { Pod } from '../../types';

export const Pods: React.FC = () => {
  const pods: Pod[] = [
    { name: 'frontend-web', status: 'running' },
    { name: 'sample-worker', status: 'running' },
    { name: 'review-bot', status: 'pending' },
    { name: 'release-watcher', status: 'done' },
  ];

  return (
    <div>
      <div className="pods-list">
        {pods.map((pod) => (
          <div key={pod.name} className="pod-item">
            <div>{pod.name}</div>
            <div style={{fontWeight:700,color: pod.status==='running'? 'var(--accent-green)': pod.status==='pending'? 'var(--accent-yellow)': 'var(--muted)'}}>{pod.status.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
