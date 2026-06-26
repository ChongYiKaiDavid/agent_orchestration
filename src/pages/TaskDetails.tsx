import React, { useState, useEffect } from 'react';
import PipelineVisualizer from '../components/sections/PipelineVisualizer';
import PRTracking from '../components/sections/PRTracking';
import TestResults from '../components/sections/TestResults';
import { deleteTask } from '../api';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  repository: string | null;
  target_branch: string | null;
  pipeline_id: string | null;
  jira_ticket: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

interface TaskDetailsProps {
  taskId: string | null;
  onTaskDeleted?: () => void;
}

const TaskDetails: React.FC<TaskDetailsProps> = ({ taskId, onTaskDeleted }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (taskId) {
      fetchTask();
      const interval = setInterval(fetchTask, 5000); // Poll every 5 seconds
      return () => clearInterval(interval); // Cleanup on unmount
    }
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const response = await fetch(`http://localhost:5174/api/tasks/${taskId}`);
      const data = await response.json();
      setTask(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch task:', error);
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    const confirmed = window.confirm('Are you sure you want to delete this task?');
    if (!confirmed) return;
    try {
      await deleteTask(taskId);
      if (onTaskDeleted) {
        onTaskDeleted();
      } else {
        alert('Task deleted successfully.');
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to delete task', err);
      alert('Failed to delete task.');
    }
  };

  const formatTaskStatus = (task: Task) => {
    if (task.status === 'requeued' && task.retry_count > 0) {
      return `Retrying (${task.retry_count})...`;
    }
    if (task.status === 'completed' && task.retry_count > 0) {
      return `Completed after ${task.retry_count} ${task.retry_count > 1 ? 'retries' : 'retry'}`;
    }
    return task.status;
  }

  if (!taskId) {
    return (
      <div className="text-center text-gray-400 py-12">
        <p>No task selected</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-12">
        <p>Loading task details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Task Details</h1>
          {task && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="px-2 py-1 rounded bg-gray-800">{formatTaskStatus(task)}</span>
              <span className="px-2 py-1 rounded bg-gray-800">{task.priority}</span>
              {task.jira_ticket && (
                <span className="px-2 py-1 rounded bg-blue-900/30 text-blue-400">{task.jira_ticket}</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
        >
          Delete Task
        </button>
      </div>

      {/* Task Info */}
      {task && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Task Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Title</div>
              <div className="text-white">{task.title}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Status</div>
              <div className="text-white capitalize">{formatTaskStatus(task)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Priority</div>
              <div className="text-white capitalize">{task.priority}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Pipeline</div>
              <div className="text-white">{task.pipeline_id || 'N/A'}</div>
            </div>
            {task.repository && (
              <div className="col-span-2">
                <div className="text-sm text-gray-400 mb-1">Repository</div>
                <div className="text-white text-sm break-all">{task.repository}</div>
              </div>
            )}
            {task.target_branch && (
              <div>
                <div className="text-sm text-gray-400 mb-1">Target Branch</div>
                <div className="text-white">{task.target_branch}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-400 mb-1">Created</div>
              <div className="text-white text-sm">{new Date(task.created_at).toLocaleString()}</div>
            </div>
            {task.description && (
              <div className="col-span-2">
                <div className="text-sm text-gray-400 mb-1">Description</div>
                <div className="text-white text-sm">{task.description}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline Progress */}
      <PipelineVisualizer taskId={taskId} />

      {/* PR Tracking and Test Results side by side */}
      <div className="grid grid-cols-2 gap-6">
        <PRTracking taskId={taskId} />
        <TestResults taskId={taskId} />
      </div>
    </div>
  );
};

export default TaskDetails;