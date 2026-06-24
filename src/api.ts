export type TaskCreatePayload = {
  title: string;
  description?: string;
  pipeline?: string;
  repository?: string;
  targetBranch?: string;
  priority?: string;
  jiraTicket?: string;
};

const defaultHeaders = {
  'Content-Type': 'application/json',
};

async function parseJson(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }
  return response.json();
}

export async function createTask(payload: TaskCreatePayload) {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function decomposeEpic(payload: DecomposeEpicPayload) {
  const response = await fetch('/api/tasks/decompose', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function fetchTasks() {
  const response = await fetch('/api/tasks');
  return parseJson(response);
}

export async function fetchTaskExecutions(taskId: string) {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/executions`);
  return parseJson(response);
}

export async function fetchEvents() {
  const response = await fetch('/api/events');
  return parseJson(response);
}

export async function fetchPipelines() {
  const response = await fetch('/api/pipelines');
  return parseJson(response);
}

export async function fetchPipeline(id: string) {
  const response = await fetch(`/api/pipelines/${encodeURIComponent(id)}`);
  return parseJson(response);
}

export async function fetchAgents() {
  const response = await fetch('/api/agents');
  return parseJson(response);
}

export async function deleteTask(taskId: string) {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: defaultHeaders,
  });
  return parseJson(response);
}

etch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: defaultHeaders,
  });
  return parseJson(response);
}

