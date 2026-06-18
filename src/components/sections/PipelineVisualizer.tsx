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

interface PipelineVisualizerProps {
  taskId: string;
}

export default function PipelineVisualizer({ taskId }: PipelineVisualizerProps) {
  const [stages, setStages] = useState<StageExecution[]>([]);

  useEffect(() => {
    if (!taskId) return;

    // Fetch initial stage data
    fetchStages();

    // Connect to Flask Socket.IO for real-time updates
    const flaskUrl = import.meta.env.VITE_FLASK_SOCKET_URL || 'http://localhost:5002';
    const socket = io(flaskUrl);

    // Join the task room
    socket.emit('join-task', { taskId });

    // Listen for agent-log events to detect stage changes
    socket.on('agent-log', (data) => {
      if (data.taskId === taskId) {
        fetchStages(); // Refresh stages when logs come in
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [taskId]);

  const fetchStages = async () => {
    try {
      // First get the execution ID
      const execResponse = await fetch(`http://localhost:5174/api/tasks/${taskId}/execution`);
      if (!execResponse.ok) {
        console.error('Failed to fetch execution:', execResponse.status);
        return;
      }
      
      const execution = await execResponse.json();
      if (!execution) return;

      // Then get the stages
      const stagesResponse = await fetch(`http://localhost:5174/api/executions/${execution.id}/stages`);
      if (!stagesResponse.ok) {
        console.error('Failed to fetch stages:', stagesResponse.status);
        return;
      }

      const stagesData = await stagesResponse.json();
      setStages(Array.isArray(stagesData) ? stagesData : []);
    } catch (error) {
      console.error('Failed to fetch stages:', error);
    }
  };

  const getStageIcon = (stageName: string) => {
    switch (stageName.toLowerCase()) {
      case 'planning':
        return '📋';
      case 'coding':
        return '💻';
      case 'reviewing':
        return '🔍';
      default:
        return '⚙️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'bg-yellow-500 border-yellow-400';
      case 'completed':
        return 'bg-green-500 border-green-400';
      case 'failed':
        return 'bg-red-500 border-red-400';
      case 'pending':
        return 'bg-gray-600 border-gray-500';
      default:
        return 'bg-gray-700 border-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return '⏳';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'pending':
        return '⏸️';
      default:
        return '❓';
    }
  };

  const defaultStages = ['planning', 'coding', 'reviewing'];
  const stageMap = new Map(stages.map(s => [s.stage_name, s]));

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Pipeline Progress</h3>
      
      <div className="flex items-center justify-between gap-2">
        {defaultStages.map((stageName, index) => {
          const stage = stageMap.get(stageName);
          const status = stage?.status || 'pending';
          
          return (
            <React.Fragment key={stageName}>
              {/* Stage Node */}
              <div className={`flex flex-col items-center`}>
                <div className={`
                  w-16 h-16 rounded-full border-4 flex items-center justify-center
                  ${getStatusColor(status)}
                  transition-all duration-300
                `}>
                  <span className="text-2xl">{getStageIcon(stageName)}</span>
                </div>
                <div className="mt-2 text-center">
                  <div className="text-sm font-medium text-white capitalize">{stageName}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1 justify-center">
                    <span>{getStatusIcon(status)}</span>
                    <span className="capitalize">{status}</span>
                  </div>
                </div>
              </div>

              {/* Connector Line */}
              {index < defaultStages.length - 1 && (
                <div className={`
                  flex-1 h-1 rounded
                  ${status === 'completed' ? 'bg-green-500' : 'bg-gray-700'}
                  transition-all duration-300
                `} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stage Details */}
      {stages.length > 0 && (
        <div className="mt-6 space-y-2">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="bg-gray-800 rounded p-3 border border-gray-700"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getStageIcon(stage.stage_name)}</span>
                  <span className="font-medium text-white capitalize">{stage.stage_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    stage.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                    stage.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    stage.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {stage.status}
                  </span>
                  {stage.verdict && (
                    <span className="text-xs text-gray-400">
                      {stage.verdict}
                    </span>
                  )}
                </div>
              </div>
              {stage.started_at && (
                <div className="text-xs text-gray-400 mt-1">
                  Started: {new Date(stage.started_at).toLocaleString()}
                </div>
              )}
              {stage.completed_at && (
                <div className="text-xs text-gray-400">
                  Completed: {new Date(stage.completed_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
