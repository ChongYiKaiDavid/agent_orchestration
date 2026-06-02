import React from 'react';
import type { Task } from '../../types';

export const RecentTasks: React.FC = () => {
  const tasks: Task[] = [
    {
      id: '1',
      title: 'Refactor dashboard filtering',
      status: 'working',
      project: 'example/acme-web',
      agent: 'Copilot',
      timestamp: '3h ago',
      link: 'PR #128',
    },
    {
      id: '2',
      title: 'Fix flaky test retries',
      status: 'attention',
      project: 'example/platform-api',
      agent: 'Claude Code',
      timestamp: '22h ago',
      link: 'PR #52',
    },
    {
      id: '3',
      title: 'Add settings empty states',
      status: 'done',
      project: 'example/design-system',
      agent: 'Codex',
      timestamp: '2d ago',
      link: 'PR #331',
    },
    {
      id: '4',
      title: 'Prepare release notes generator',
      status: 'pending',
      project: 'example/acme-web',
      agent: 'Planner',
      timestamp: 'just now',
      link: 'Draft',
    },
  ];

  const getStatusLabel = (status: string) => {
    return status.toUpperCase();
  };

  return (
    <div>
      {tasks.map((task) => (
        <div key={task.id} className="card" style={{marginBottom:12}}>
          <div className="task-row">
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:16}}>{task.title}</div>
              <div className="task-meta">{task.project} · {task.agent} · {task.timestamp}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className={`badge ${task.status==='working'?'running':task.status==='attention'?'attention':task.status==='done'?'done':''}`}>{getStatusLabel(task.status)}</div>
              {task.link && <div style={{marginTop:8}}><a className="task-link" href="#">{task.link} ↗</a></div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
