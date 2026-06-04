import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivityPage from '../pages/Activity';

describe('Activity page', () => {
  test('renders activity heading and filters', () => {
    render(<ActivityPage />);
    expect(screen.getByRole('heading', { name: /Activity/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Filter by task ID/i)).toBeInTheDocument();
  });

  test('filters events by task id input', async () => {
    const user = userEvent.setup();
    render(<ActivityPage />);
    await user.type(screen.getByPlaceholderText(/Filter by task ID/i), '129');
    expect(screen.getByText(/Planner stage failed/i)).toBeInTheDocument();
  });
});
