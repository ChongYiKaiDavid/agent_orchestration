import React, { useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selected?: string;
  onSelect?: (id: string) => void;
}

interface NavSection {
  id: string;
  title: string;
  items: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, selected, onSelect }) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const navSections: NavSection[] = [
    {
      id: 'main',
      title: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'create', label: 'Create Task', icon: '+' },
        { id: 'decompose', label: 'Decompose', icon: '◇' },
      ],
    },
    {
      id: 'monitoring',
      title: 'Monitoring',
      items: [
        { id: 'activity', label: 'Activity', icon: '⏱️' },
        { id: 'agents', label: 'Agents', icon: '◯' },
        { id: 'pipelines', label: 'Pipelines', icon: '≈' },
      ],
    },
    {
      id: 'system',
      title: 'System',
      items: [
        { id: 'settings', label: 'Settings', icon: '⚙️' },
      ],
    },
  ];

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleSelect = (id: string) => {
    if (onSelect) onSelect(id);
  };

  return (
    <>
      {isOpen && (
        <div className="overlay" onClick={onToggle} />
      )}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-badge">AO</div>
          <div className="brand-copy">
            <div className="brand-title">Agent Orchestration</div>
            <div className="brand-subtitle">AI Platform</div>
          </div>
        </div>

        <nav className="nav" role="navigation" aria-label="Main navigation">
          {navSections.map((section) => (
            <div className="nav-section" key={section.id}>
              <button
                type="button"
                className="nav-section-header"
                onClick={() => toggleSection(section.id)}
                aria-expanded={!collapsedSections[section.id]}
              >
                <span className="nav-section-title">{section.title}</span>
                <span className={`nav-section-chevron ${collapsedSections[section.id] ? 'collapsed' : ''}`}>
                  ▼
                </span>
              </button>
              {!collapsedSections[section.id] && (
                <div className="nav-section-items">
                  {section.items.map((item) => (
                    <div className="nav-row" key={item.id}>
                      <button
                        type="button"
                        className={`nav-item ${selected === item.id ? 'active' : ''}`}
                        onClick={() => handleSelect(item.id)}
                        aria-pressed={selected === item.id}
                      >
                        <span className="nav-icon" aria-hidden>{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
};
