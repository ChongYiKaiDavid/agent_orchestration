import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateTask from '../pages/CreateTask';

describe('CreateTask page', () => {
  test('calls onCreate when creating a task', async () => {
    const user = userEvent.setup();
    const mock = vi.fn();
    render(<CreateTask onCreate={mock} />);

    const input = screen.getByPlaceholderText(/Task title/i);
    await user.type(input, 'New Task');
    await user.click(screen.getByRole('button', { name: /Create & Queue/i }));

    expect(mock).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/created and queued/i);
  });
});
