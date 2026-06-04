import React from 'react';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="header">
      <button
        type="button"
        className="header-menu"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        ☰
      </button>

      <div className="top-metrics">
        <div className="metric">
          <div className="metric-label">Nodes</div>
          <div className="metric-value">6</div>
        </div>
        <div className="metric">
          <div className="metric-label">Active tasks</div>
          <div className="metric-value">14</div>
        </div>
        <div className="metric">
          <div className="metric-label">CPU</div>
          <div className="metric-value">72%</div>
        </div>
      </div>
    </header>
  );
};
