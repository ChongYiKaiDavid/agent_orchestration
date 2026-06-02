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

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState('dashboard');

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSelect = (id: string) => {
    setSelectedSection(id);
  };

  const renderSection = () => {
    switch (selectedSection) {
      case 'dashboard':
        return <DashboardPage />;
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
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} selected={selectedSection} onSelect={handleSelect} />
      <div style={{flex:1}}>
        {selectedSection !== 'dashboard' && <Header onMenuClick={toggleSidebar} />}

        <Layout>
          {renderSection()}
        </Layout>
      </div>
    </div>
  );
}

export default App;
