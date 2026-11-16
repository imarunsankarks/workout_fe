import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, act } from '@testing-library/react';
import axios from 'axios';
import BackendGate from './BackendGate';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

beforeEach(() => {
  axios.get.mockReset();
  jest.useFakeTimers();
});

afterEach(() => jest.useRealTimers());

test('keeps the app hidden until the backend responds', async () => {
  let resolvePing;
  axios.get.mockImplementationOnce(() => new Promise((resolve) => {
    resolvePing = resolve;
  }));

  const { container } = render(<BackendGate><div>Home content</div></BackendGate>);
  expect(screen.getByText('Waking up your training space...')).toBeInTheDocument();
  expect(container.querySelector('.startup-transform .startup-activity-line')).toBeInTheDocument();
  expect(container.querySelectorAll('.startup-plates-inner rect')).toHaveLength(2);
  expect(container.querySelectorAll('.startup-plates-middle rect')).toHaveLength(2);
  expect(container.querySelectorAll('.startup-plates-outer rect')).toHaveLength(2);
  expect(screen.queryByText('Home content')).not.toBeInTheDocument();
  await act(async () => jest.advanceTimersByTime(5000));
  expect(axios.get).toHaveBeenCalledWith(
    `${process.env.REACT_APP_API_URL}/api/keepalive/ping`,
    expect.objectContaining({ signal: expect.anything(), timeout: 90000 }),
  );

  await act(async () => resolvePing({ status: 200 }));
  expect(screen.getByText('Home content')).toBeInTheDocument();
});

test('retries a sleeping backend and opens the app after it becomes ready', async () => {
  axios.get.mockRejectedValueOnce(new Error('Service unavailable'));
  axios.get.mockResolvedValueOnce({ status: 200 });

  render(<BackendGate><div>Home content</div></BackendGate>);
  expect(screen.queryByText('Home content')).not.toBeInTheDocument();
  await act(async () => jest.advanceTimersByTime(5000));
  await act(async () => jest.advanceTimersByTime(2000));
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Home content')).toBeInTheDocument();
});

test('offers manual retry after the connection window expires', async () => {
  const now = jest.spyOn(Date, 'now').mockImplementationOnce(() => 0).mockReturnValue(90001);
  axios.get.mockRejectedValue(new Error('Offline'));
  render(<BackendGate><div>Home content</div></BackendGate>);

  await act(async () => jest.advanceTimersByTime(5000));
  expect(screen.getByText(/couldn't reach the server/i)).toBeInTheDocument();
  axios.get.mockResolvedValueOnce({ status: 200 });
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  await act(async () => jest.advanceTimersByTime(5000));
  expect(screen.getByText('Home content')).toBeInTheDocument();
  now.mockRestore();
});
