import { Terminal } from '../components/terminal/Terminal';

interface TaskDetailsProps {
  taskId: string | null;
}

const TaskDetails: React.FC<TaskDetailsProps> = ({ taskId }) => {
  return (
    <div>
      <h1>Task Details</h1>
      <div style={{ height: '500px', border: '1px solid #ccc' }}>
        <Terminal taskId={taskId} mode="agent" />
      </div>
    </div>
  );
};

export default TaskDetails;