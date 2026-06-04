import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTask,
  fetchTasks,
  fetchTaskExecutions,
  fetchEvents,
  fetchPipelines,
  fetchPipeline,
  fetchAgents,
} from '../api';

describe('API helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a task with the correct POST payload', async () => {
    const mockResponse = { id: 'task-1', title: 'My Task' };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 201 }))) as unknown as typeof fetch);

    const result = await createTask({ title: 'My Task', description: 'Test' });

    expect(global.fetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Task', description: 'Test' }),
    }));
    expect(result).toEqual(mockResponse);
  });

  it('fetches tasks and parses JSON', async () => {
    const mockResponse = [{ id: 'task-1', title: 'Task One' }];
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))) as unknown as typeof fetch);

    const result = await fetchTasks();

    expect(result).toEqual(mockResponse);
  });

  it('throws an error when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('Bad Request', { status: 400, statusText: 'Bad Request' }))) as unknown as typeof fetch);

    await expect(fetchTasks()).rejects.toThrow('Bad Request');
  });

  it('encodes task IDs in the request path', async () => {
    const mockResponse = { task: 'details' };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))) as unknown as typeof fetch);

    const taskId = 'task/123';
    await fetchTaskExecutions(taskId);

    expect(global.fetch).toHaveBeenCalledWith('/api/tasks/task%2F123/executions');
  });

  it('requests pipelines, pipeline details, agents, and events', async () => {
    const mockResponse = { data: true };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))) as unknown as typeof fetch);

    await expect(fetchEvents()).resolves.toEqual(mockResponse);
    await expect(fetchPipelines()).resolves.toEqual(mockResponse);
    await expect(fetchPipeline('plan-code-review')).resolves.toEqual(mockResponse);
    await expect(fetchAgents()).resolves.toEqual(mockResponse);

    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
