import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const testDbFile = process.env.TEST_DB_FILE;
const dbFile = testDbFile === ':memory:'
  ? ':memory:'
  : path.resolve(process.cwd(), testDbFile || 'db.sqlite');
const dbExists = testDbFile !== ':memory:' && fs.existsSync(dbFile);
const db = new Database(dbFile);

export function resetDatabase() {
  db.exec(`
    DELETE FROM artifacts;
    DELETE FROM pull_requests;
    DELETE FROM stage_executions;
    DELETE FROM executions;
    DELETE FROM activity_log;
    DELETE FROM tasks;
  `);
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      repository TEXT,
      target_branch TEXT,
      pipeline_id TEXT,
      jira_ticket TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      pipeline_id TEXT,
      status TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS stage_executions (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL,
      stage_name TEXT NOT NULL,
      status TEXT NOT NULL,
      verdict TEXT,
      input_data TEXT,
      output_data TEXT,
      logs TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY(execution_id) REFERENCES executions(id)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL,
      type TEXT,
      file_path TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(execution_id) REFERENCES executions(id)
    );

    CREATE TABLE IF NOT EXISTS pull_requests (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL,
      repo TEXT,
      pr_number TEXT,
      url TEXT,
      status TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      merged_at TEXT,
      FOREIGN KEY(execution_id) REFERENCES executions(id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      event_type TEXT,
      message TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Add jira_ticket column to existing tasks table if it doesn't exist
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN jira_ticket TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
}

initSchema();

export default db;
