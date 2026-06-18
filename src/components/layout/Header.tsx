import React from 'react';
import Notifications from '../sections/Notifications';

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
      <Notifications />
    </header>
  );
};
