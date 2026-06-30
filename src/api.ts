export type DecomposeEpicPayload = {
  description: string;
  repository?: string;
  targetBranch?: string;
  jiraTicket?: string;
  bitbucketUrl?: string;
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

export type TaskCreatePayload = Record<string, any>;

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

export async function createAgent(payload: any) {
  const response = await fetch('/api/agents', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function updateAgent(agentId: string, payload: any) {
  const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'PUT',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function deleteTask(taskId: string) {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: defaultHeaders,
  });
  return parseJson(response);
}

export async function fetchJiraIssues(params: { statuses?: string; project?: string; maxResults?: number } = {}) {
  const query = new URLSearchParams();
  if (params.statuses) query.set('statuses', params.statuses);
  if (params.project) query.set('project', params.project);
  if (params.maxResults) query.set('maxResults', String(params.maxResults));
  const response = await fetch(`/api/jira/issues?${query}`);
  return parseJson(response);
}

export async function createTaskFromJira(issue: {
  summary: string;
  description?: string;
  key?: string;
  priority?: string;
  repository?: string;
}) {
  const response = await fetch('/api/tasks/from-jira', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(issue),
  });
  return parseJson(response);
}

export async function fetchConfig() {
  const response = await fetch('/api/config');
  return parseJson(response);
}

export async function saveConfig(config: Record<string, string>) {
  const response = await fetch('/api/config', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(config),
  });
  return parseJson(response);
}


