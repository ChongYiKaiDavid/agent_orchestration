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
    </header>
  );
};
