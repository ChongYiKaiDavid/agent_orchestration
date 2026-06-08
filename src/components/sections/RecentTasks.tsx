import React, { useEffect, useState } from 'react';
import type { Task } from '../../types';
import { fetchTasks } from '../../api';

export const RecentTasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetchTasks()
      .then((data) => {
        if (Array.isArray(data)) {
          setTasks(data.slice(0, 5).map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            project: t.repository || 'unknown-repo',
            agent: t.pipeline_id === 'gemini-code-only' ? 'Gemini CLI' : 'Devin',
            timestamp: new Date(t.updated_at).toLocaleString(),
            link: t.status === 'pr_created' ? 'PR Created' : t.status === 'completed' ? 'Done' : '',
          })));
        }
      })
      .catch((err) => console.error('Failed to fetch tasks', err));
  }, []);

  const getStatusLabel = (status: string) => {
    return status.toUpperCase();
  };

  return (
    <div>
      {tasks.length === 0 ? (
        <div style={{ padding: '12px', color: 'rgba(255,255,255,0.5)' }}>No recent tasks.</div>
      ) : (
        tasks.map((task) => (
          <div key={task.id} className="card" style={{marginBottom:12}}>
            <div className="task-row">
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:16}}>{task.title}</div>
                <div className="task-meta">{task.project} · {task.agent} · {task.timestamp}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className={`badge ${['running', 'queued'].includes(task.status) ? 'running' : task.status === 'failed' ? 'attention' : task.status === 'completed' || task.status === 'pr_created' ? 'done' : ''}`}>
                  {getStatusLabel(task.status)}
                </div>
                {task.link && <div style={{marginTop:8}}><span className="task-link">{task.link}</span></div>}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
