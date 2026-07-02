import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const originalEnv = { ...process.env };
import request from 'supertest';
import express from 'express';
import db from '../db.js';
import routes from '../routes.js';

// Create a test app
const app = express();
app.use(express.json());
app.use('/api', routes);

describe('Jira Integration Endpoint', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_USER;
    delete process.env.JIRA_API_TOKEN;
    delete process.env.JIRA_SPACE_KEYS;
    delete process.env.RELEASE_BRANCH_ENABLED;
    delete process.env.DEFAULT_RELEASE_BRANCH;
    delete process.env.TARGET_BRANCH;
    // Reset database before each test
    db.exec(`
      DELETE FROM artifacts;
      DELETE FROM pull_requests;
      DELETE FROM stage_executions;
      DELETE FROM executions;
      DELETE FROM activity_log;
      DELETE FROM tasks;
    `);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    // Clean up after each test
    db.exec(`
      DELETE FROM artifacts;
      DELETE FROM pull_requests;
      DELETE FROM stage_executions;
      DELETE FROM executions;
      DELETE FROM activity_log;
      DELETE FROM tasks;
    `);
  });

  it('should create a task from Jira payload with summary', async () => {
    const jiraPayload = {
      summary: 'Fix login bug',
      description: 'Users cannot login with SSO',
      priority: 'high',
      repository: 'https://github.com/test/repo.git',
      targetBranch: 'main',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe('Fix login bug');
    expect(response.body.status).toBe('queued');
    expect(response.body.priority).toBe('high');
    expect(response.body.pipeline_id).toBe('auto');
    expect(response.body.description).toContain('Jira Description:');
    expect(response.body.description).toContain('Users cannot login with SSO');
  });

  it('should create a task from Jira payload with title (fallback)', async () => {
    const jiraPayload = {
      title: 'Implement feature X',
      description: 'Add new feature X to the system',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.title).toBe('Implement feature X');
    expect(response.body.status).toBe('queued');
  });

  it('should handle Jira payload with assignee and status', async () => {
    const jiraPayload = {
      summary: 'Update documentation',
      description: 'Update API documentation',
      assignee: 'john.doe',
      status: 'In Progress',
      priority: 'medium',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.description).toContain('Jira Assignee: john.doe');
    expect(response.body.description).toContain('Jira Status: In Progress');
  });

  it('should handle Jira payload with links and attachments', async () => {
    const jiraPayload = {
      summary: 'Security fix',
      description: 'Fix security vulnerability',
      links: ['https://example.com/link1', 'https://example.com/link2'],
      attachments: ['screenshot.png', 'logs.txt'],
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.description).toContain('Jira Links:');
    expect(response.body.description).toContain('https://example.com/link1');
    expect(response.body.description).toContain('Jira Attachments (metadata/refs):');
    expect(response.body.description).toContain('screenshot.png');
  });

  it('should handle string links and attachments', async () => {
    const jiraPayload = {
      summary: 'Bug fix',
      description: 'Fix critical bug',
      links: 'https://example.com/single-link',
      attachments: 'error.log',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.description).toContain('https://example.com/single-link');
    expect(response.body.description).toContain('error.log');
  });

  it('should return 400 when summary is missing', async () => {
    const jiraPayload = {
      description: 'Some description',
      priority: 'high',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('summary');
  });

  it('should return 400 when both summary and title are missing', async () => {
    const jiraPayload = {
      description: 'Some description',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should handle empty description gracefully', async () => {
    const jiraPayload = {
      summary: 'Task without description',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.description).toContain('Jira Description:\n(No description provided)');
  });

  it('should include instructions in description', async () => {
    const jiraPayload = {
      summary: 'Test task',
      description: 'Test description',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.description).toContain('Instructions:');
    expect(response.body.description).toContain('Treat this Jira issue as the source of truth');
  });

  it('should default priority to medium when not specified', async () => {
    const jiraPayload = {
      summary: 'Default priority task',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.priority).toBe('medium');
  });

  it('should handle repository and targetBranch correctly', async () => {
    const jiraPayload = {
      summary: 'Repo task',
      repository: 'https://github.com/test/repo.git',
      targetBranch: 'develop',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.repository).toBe('https://github.com/test/repo.git');
    expect(response.body.target_branch).toBe('develop');
  });

  it('should handle null repository and targetBranch', async () => {
    process.env.RELEASE_BRANCH_ENABLED = 'false';
    const jiraPayload = {
      summary: 'No repo task',
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.repository).toBeNull();
    expect(response.body.target_branch).toBeNull();
  });

  it('should use the configured release branch when no target branch is supplied', async () => {
    process.env.RELEASE_BRANCH_ENABLED = 'true';
    process.env.DEFAULT_RELEASE_BRANCH = 'release/2026';
    process.env.TARGET_BRANCH = 'release/2026';

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send({ summary: 'Release branch task' })
      .expect(201);

    expect(response.body.target_branch).toBe('release/2026');
    expect(response.body.description).toContain('Release branch workflow');
  });

  it('should return built-in demo Jira issues when Jira credentials are absent', async () => {
    const response = await request(app)
      .get('/api/jira/issues')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('issueType');
    expect(response.body[0]).toHaveProperty('source');
  });

  it('should filter empty links and attachments', async () => {
    const jiraPayload = {
      summary: 'Filter test',
      links: ['', 'https://example.com/valid', null],
      attachments: [null, 'valid.txt', ''],
    };

    const response = await request(app)
      .post('/api/tasks/from-jira')
      .send(jiraPayload)
      .expect(201);

    expect(response.body.description).toContain('https://example.com/valid');
    expect(response.body.description).toContain('valid.txt');
    // Should not contain empty strings
    expect(response.body.description).not.toContain('links:\n- \n-');
  });
});
