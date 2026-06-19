import { useState } from 'react';
import { Sidebar, Header, Layout } from './components/layout';
import './index.css';

import DashboardPage from './pages/Dashboard.tsx';
import CreateTask from './pages/CreateTask.tsx';
import Decompose from './pages/Decompose.tsx';
import ActivityPage from './pages/Activity.tsx';
import AgentsPage from './pages/Agents.tsx';
import SettingsPage from './pages/Settings.tsx';
import PipelinesPage from './pages/Pipelines.tsx';
import TaskDetail from './pages/TaskDetails.tsx';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedSection, setSelectedSection] = useState('dashboard');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSelect = (id: string) => {
    setSelectedSection(id);
    if (id !== 'task-details') setCurrentTaskId(null);
  };

  const handleViewTask = (taskId: string) => {
    setCurrentTaskId(taskId);
    setSelectedSection('task-details');
  };

  const renderSection = () => {
    switch (selectedSection) {
      case 'dashboard':
        return <DashboardPage onViewTask={handleViewTask} />;
      case 'create':
        return <CreateTask />;
      case 'decompose':
        return <Decompose />;
      case 'activity':
        return <ActivityPage />;
      case 'agents':
        return <AgentsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'pipelines':
        return <PipelinesPage />;
      case 'task-details':
        return <TaskDetail taskId={currentTaskId} onTaskDeleted={() => handleSelect('dashboard')} />;
      default:
        return <DashboardPage onViewTask={handleViewTask} />;
    }
  };

  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} selected={selectedSection} onSelect={handleSelect} />
      <div className="app-content">
        {selectedSection !== 'dashboard' && <Header onMenuClick={toggleSidebar} />}

        <Layout>
          {renderSection()}
        </Layout>
      </div>
    </div>
  );
}

export default App;