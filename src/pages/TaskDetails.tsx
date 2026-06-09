import React from 'react';
import { Terminal } from '../components/terminal/Terminal';
import { deleteTask } from '../api';

interface TaskDetailsProps {
  taskId: string | null;
  onTaskDeleted?: () => void;
}

const TaskDetails: React.FC<TaskDetailsProps> = ({ taskId, onTaskDeleted }) => {
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

  return (
    <div style={{ position: 'relative' }}>
      <h1>Task Details</h1>
      {taskId && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '0',
            right: '0',
            background: 'transparent',
            border: 'none',
            color: 'red',
            fontSize: '48px',
            fontWeight: 'bold',
            cursor: 'pointer',
            lineHeight: '1',
            padding: '10px',
            transition: 'transform 0.2s'
          }}
          title="Delete Task"
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          &#x2715;
        </button>
      )}
      <div style={{ height: '500px', border: '1px solid #ccc', marginTop: '20px' }}>
        <Terminal taskId={taskId} mode="agent" />
      </div>
    </div>
  );
};

export default TaskDetails;