import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PipelinesPage from '../pages/Pipelines';

describe('Pipelines page', () => {
  test('renders Pipelines page and shows built-in pipeline', () => {
    render(<PipelinesPage />);
    expect(screen.getByText(/Pipelines/i)).toBeInTheDocument();
    expect(screen.getByText(/Plan → Code → Review/i)).toBeInTheDocument();
  });

  test('switches between pipeline definitions and stage details', async () => {
    const user = userEvent.setup();
    render(<PipelinesPage />);

    expect(screen.getByText(/Pipelines/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /release-ready/i }));
    expect(screen.getByText(/Stage 1 Details/i)).toBeInTheDocument();
  });
});
