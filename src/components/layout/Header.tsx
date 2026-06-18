import React from 'react';
import Notifications from '../sections/Notifications';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="header">
      <Notifications />
    </header>
  );
};
