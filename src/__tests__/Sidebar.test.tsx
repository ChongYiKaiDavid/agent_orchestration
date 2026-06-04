import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../components/layout/Sidebar';
import { vi } from 'vitest';

describe('Sidebar', () => {
  test('renders Sidebar with navigation items', () => {
    render(<Sidebar isOpen={true} onToggle={() => {}} selected="dashboard" onSelect={() => {}} />);
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Task/i)).toBeInTheDocument();
  });

  test('renders navigation items and handles selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onToggle = vi.fn();

    render(<Sidebar isOpen={false} onToggle={onToggle} selected="dashboard" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Create Task/i }));

    expect(onSelect).toHaveBeenCalledWith('create');
    expect(onToggle).not.toHaveBeenCalled();
  });
});
