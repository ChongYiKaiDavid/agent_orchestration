import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

interface StageExecution {
  id: string;
  execution_id: string;
  stage_name: string;
  status: string;
  verdict: string | null;
  started_at: string;
  completed_at: string | null;
}

const STAGE_ICONS: Record<string, string> = {
  planning: '📋', coding: '💻', reviewing: '🔍',
};

const STATUS_STYLE: Record<string, { circle: string; badge: string; text: string }> = {
  completed: { circle: '#4ade80', badge: 'rgba(74,222,128,0.15)', text: '#4ade80' },
  running:   { circle: '#fbbf24', badge: 'rgba(251,191,36,0.15)',  text: '#fbbf24' },
  failed:    { circle: '#ff6b6b', badge: 'rgba(255,107,107,0.15)', text: '#ff6b6b' },
  pending:   { circle: 'rgba(255,255,255,0.15)', badge: 'rgba(255,255,255,0.07)', text: 'rgba(243,244,246,0.4)' },
};

const STATUS_ICON: Record<string, string> = {
  completed: '✅', running: '⏳', failed: '❌', pending: '○',
};

export default function PipelineVisualizer({ taskId }: { taskId: string }) {
  const [stages, setStages] = useState<StageExecution[]>([]);

  const fetchStages = async () => {
    try {
      const exec = await fetch(`/api/tasks/${taskId}/execution`).then(r => r.json());
      if (!exec?.id) return;
      const data = await fetch(`/api/executions/${exec.id}/stages`).then(r => r.json());
      setStages(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    if (!taskId) return;
    fetchStages();
    const flaskUrl = import.meta.env.VITE_FLASK_SOCKET_URL || 'http://localhost:5002';
    const socket = io(flaskUrl);
    socket.emit('join-task', { taskId });
    socket.on('agent-log', (data) => { if (data.taskId === taskId) fetchStages(); });
    return () => { socket.disconnect(); };
  }, [taskId]);

  const stageMap = new Map(stages.map(s => [s.stage_name, s]));
  const defaultStages = ['planning', 'coding', 'reviewing'];

  return (
    <div>
      {/* Stage circles + connectors */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
        {defaultStages.map((name, i) => {
          const status = stageMap.get(name)?.status || 'pending';
          const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
          return (
            <React.Fragment key={name}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  border: `3px solid ${s.circle}`,
                  background: `${s.circle}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, transition: 'all 0.3s',
                }}>
                  {STAGE_ICONS[name] || '⚙️'}
                </div>
                <div style={{ marginTop: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', textTransform: 'capitalize' }}>{name}</div>
                  <div style={{ fontSize: 11, color: s.text, marginTop: 2 }}>
                    {STATUS_ICON[status] || '?'} {status}
                  </div>
                </div>
              </div>
              {i < defaultStages.length - 1 && (
                <div style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: status === 'completed' ? '#4ade80' : 'rgba(255,255,255,0.1)',
                  transition: 'background 0.3s', marginBottom: 32,
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stage detail rows */}
      {stages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stages.map((stage) => {
            const s = STATUS_STYLE[stage.status] || STATUS_STYLE.pending;
            return (
              <div key={stage.id} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{STAGE_ICONS[stage.stage_name] || '⚙️'}</span>
                    <span style={{ fontWeight: 600, color: '#f3f4f6', textTransform: 'capitalize' }}>{stage.stage_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: s.badge, color: s.text, textTransform: 'capitalize',
                    }}>{stage.status}</span>
                    {stage.verdict && (
                      <span style={{ fontSize: 11, color: 'rgba(243,244,246,0.5)' }}>{stage.verdict}</span>
                    )}
                  </div>
                </div>
                {stage.started_at && (
                  <div style={{ fontSize: 11, color: 'rgba(243,244,246,0.4)', marginTop: 6 }}>
                    Started: {new Date(stage.started_at).toLocaleString()}
                    {stage.completed_at && <> · Completed: {new Date(stage.completed_at).toLocaleString()}</>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
