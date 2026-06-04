import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentsPage from '../pages/Agents';

describe('Agents page', () => {
  test('renders Agents and filters', async () => {
    const user = userEvent.setup();
    render(<AgentsPage />);
    expect(screen.getByText(/Agents/i)).toBeInTheDocument();

    const filter = screen.getByPlaceholderText(/Filter agents/i);
    await user.type(filter, 'Decomposer');
    expect(filter).toHaveValue('Decomposer');
  });

  test('renders agent list and selects an agent', async () => {
    const user = userEvent.setup();
    render(<AgentsPage />);
    expect(screen.getByText(/Code Executor/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Filter agents/i), 'planner');
    expect(screen.getByText(/Planner/i)).toBeInTheDocument();
  });
});
