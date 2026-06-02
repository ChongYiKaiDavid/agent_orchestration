import React from 'react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selected?: string;
  onSelect?: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, selected, onSelect }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'create', label: 'Create Task', icon: '+' },
    { id: 'decompose', label: 'Decompose', icon: '◇' },
    { id: 'activity', label: 'Activity', icon: '⏱️' },
    { id: 'agents', label: 'Agents', icon: '◯' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'pipelines', label: 'Pipelines', icon: '≈' },
  ];

  const handleSelect = (id: string) => {
    if (onSelect) onSelect(id);
    // close sidebar on mobile
    if (onToggle) onToggle();
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
            <div className="brand-title">Frontend</div>
            <div className="brand-subtitle">Sample Dashboard</div>
          </div>
        </div>

        <nav className="nav" role="navigation" aria-label="Main navigation">
          {navItems.map((item) => (
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
        </nav>
      </aside>
    </>
  );
};
