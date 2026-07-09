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

export async function updatePipeline(id: string, payload: any) {
  const response = await fetch(`/api/pipelines/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function savePipelineYaml(id: string, yamlText: string) {
  const response = await fetch(`/api/pipelines/${encodeURIComponent(id)}/yaml`, {
    method: 'PUT',
    headers: defaultHeaders,
    body: JSON.stringify({ yamlText }),
  });
  return parseJson(response);
}

export async function runPipeline(id: string, payload: any) {
  const response = await fetch(`/api/pipelines/${encodeURIComponent(id)}/run`, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function createPipelineTemplate(payload: any) {
  const response = await fetch('/api/pipelines/templates', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function deletePipeline(id: string) {
  const response = await fetch(`/api/pipelines/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: defaultHeaders,
  });
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

export interface JiraIssueCreatePayload {
  summary: string;
  description?: string;
  priority?: string;
  issueType?: string;
  projectKey?: string;
}

export interface JiraIssueCreateResult {
  key: string;
  id?: string;
  url: string;
  demo: boolean;
}

/**
 * Creates a new Jira issue and returns its key and URL.
 * When Jira is not configured or JIRA_DEMO_MODE is on, the server returns
 * a synthetic DEMO-XXXXX key so the task creation flow can continue.
 */
export async function createJiraIssue(
  payload: JiraIssueCreatePayload,
): Promise<JiraIssueCreateResult> {
  const response = await fetch('/api/jira/issues', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
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
