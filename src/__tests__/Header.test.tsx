import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../components/layout/Header';

describe('Header', () => {
  test('renders metrics and menu button', async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();

    render(<Header onMenuClick={onMenuClick} />);
    expect(screen.getByRole('button', { name: /Open navigation menu/i })).toBeInTheDocument();
    expect(screen.getByText(/Nodes/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Open navigation menu/i }));
    expect(onMenuClick).toHaveBeenCalled();
  });
});
