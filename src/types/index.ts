export type Status = 'running' | 'pending' | 'failed' | 'done' | 'working' | 'attention' | 'queued' | 'completed' | 'pr_created';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  project?: string;
  agent?: string;
  timestamp: string;
  link?: string;
}

export interface Agent {
  id: string;
  name: string;
  title: string;
  description: string;
  reads?: string[];
  writes?: string[];
  completionToken?: string;
  promptTemplate?: string;
}

export interface Pod {
  name: string;
  status: Status;
}

export interface Session {
  id: string;
  name: string;
  branch: string;
  project: string;
  timestamp: string;
}

export interface Event {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  icon?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}
