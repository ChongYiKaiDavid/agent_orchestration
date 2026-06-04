import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

process.env.TEST_DB_FILE = ':memory:';
process.env.TEST_WORKSPACE_ROOT = 'server/test-workspaces';

const routesModule = await import('../routes.js');
const dbModule = await import('../db.js');

const app = express();
app.use(express.json());
app.use('/api', routesModule.default);

const workspaceRoot = path.resolve(process.cwd(), 'server', 'test-workspaces');

async function cleanupWorkspace() {
  await fs.rm(workspaceRoot, { recursive: true, force: true });
}

describe('API routes', () => {
  beforeEach(async () => {
    dbModule.resetDatabase();
    await cleanupWorkspace();
  });

  afterAll(async () => {
    await cleanupWorkspace();
  });

  it('returns a 400 when creating a task without a title', async () => {
    await request(app).post('/api/tasks').send({ description: 'Missing title' }).expect(400);
  });

  it('creates and retrieves tasks through the API', async () => {
    const createResponse = await request(app).post('/api/tasks').send({ title: 'Route Task' }).expect(201);
    expect(createResponse.body.title).toBe('Route Task');

    const listResponse = await request(app).get('/api/tasks').expect(200);
    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body.length).toBeGreaterThan(0);

    const taskId = createResponse.body.id;
    const taskResponse = await request(app).get(`/api/tasks/${taskId}`).expect(200);
    expect(taskResponse.body.id).toBe(taskId);
  });

  it('returns pipeline definitions and agent definitions', async () => {
    const pipelineResponse = await request(app).get('/api/pipelines').expect(200);
    expect(pipelineResponse.body.length).toBeGreaterThan(0);

    const agentResponse = await request(app).get('/api/agents').expect(200);
    expect(agentResponse.body.length).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown pipeline', async () => {
    await request(app).get('/api/pipelines/unknown-id').expect(404);
  });
});
