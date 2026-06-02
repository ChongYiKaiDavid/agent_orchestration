import React from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <main className="main">
      {children}
    </main>
  );
};
