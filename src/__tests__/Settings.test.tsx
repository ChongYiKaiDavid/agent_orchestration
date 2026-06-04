import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '../pages/Settings';

describe('Settings page', () => {
  test('renders Settings and toggles sections', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();

    const projectToggle = screen.getByRole('button', { name: /Project/i });
    await user.click(projectToggle);
    expect(screen.getByText(/Project/i)).toBeInTheDocument();
  });
});
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '../pages/Settings';

describe('Settings page', () => {
  test('expands and collapses configuration sections', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const projectSection = screen.getByRole('button', { name: /Project/i });
    await user.click(projectSection);
    expect(screen.queryByLabelText(/Project Name/i)).toBeInTheDocument();

    await user.click(projectSection);
    expect(screen.queryByLabelText(/Project Name/i)).not.toBeVisible();
  });
});
