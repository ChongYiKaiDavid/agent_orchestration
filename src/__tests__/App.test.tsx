import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('App routing', () => {
  test('renders dashboard by default', () => {
    render(<App />);
    expect(screen.getByText(/End-to-end task delivery/i)).toBeInTheDocument();
  });

  test('switches sections using sidebar navigation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Create Task/i }));
    expect(screen.getByRole('heading', { name: /Create Task/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Agents/i }));
    expect(screen.getByRole('heading', { name: /Agents/i })).toBeInTheDocument();
  });
});
