import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Decompose from '../pages/Decompose';

describe('Decompose page', () => {
  test('renders Decompose drafts', () => {
    render(<Decompose />);
    expect(screen.getByText(/Drafts/i)).toBeInTheDocument();
  });

  test('renders epic description form and draft list', async () => {
    const user = userEvent.setup();
    render(<Decompose />);

    expect(screen.getByRole('heading', { name: /Decompose/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Describe the feature or epic/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Describe the feature or epic/i), 'New automation epic');
    expect(screen.getByText(/Drafts/i)).toBeInTheDocument();
  });
});
