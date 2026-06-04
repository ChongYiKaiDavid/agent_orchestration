import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '../pages/Dashboard';

describe('Dashboard page', () => {
  test('renders header and search control', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/End-to-end task delivery/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search tasks/i)).toBeInTheDocument();
  });

  test('search filters tasks', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.type(screen.getByPlaceholderText(/Search tasks/i), 'Wire task preview panel');
    expect(screen.getByText(/Wire task preview panel/i)).toBeInTheDocument();
  });
});
