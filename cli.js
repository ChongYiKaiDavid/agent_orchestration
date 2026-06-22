#!/usr/bin/env node
import { createTask, listTasks, getTaskById, getTaskExecution, getStagesForExecution } from './server/engine.js';
import { program } from 'commander';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { loadEnv } from './load_env.js';

program
  .name('agent-orchestration')
  .description('CLI for AI agent orchestration system')
  .version('1.0.0');

// Ensure env is loaded for CLI usage (other devices / CI-friendly).
// You can override with: --env-file <path> or ENV_FILE env var.
const resolvedEnvFile = process.env.ENV_FILE
  ? path.resolve(process.env.ENV_FILE)
  : path.resolve(process.cwd(), '.env.agent_orchestration');
loadEnv(resolvedEnvFile);


// Detect OS
function getPlatform() {
  const platform = os.platform();
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}

// Spawn terminal window with log viewer
function spawnLogViewer(taskId) {
  const platform = getPlatform();
  const scriptPath = path.resolve(__dirname, 'cli-log-viewer.js');
  let command, args;


  switch (platform) {
    case 'macos':
      command = 'osascript';
      args = ['-e', `tell application "Terminal" to do script "node ${scriptPath} ${taskId}"`];
      break;

    case 'windows':
      command = 'cmd';
      args = ['/c', 'start', 'cmd', '/k', `node ${scriptPath} ${taskId}`];
      break;
    case 'linux':
      // Try common terminal emulators
      const terminals = ['gnome-terminal', 'xterm', 'konsole', 'xfce4-terminal'];
      command = terminals[0]; // Default to gnome-terminal
      args = ['--', 'node', scriptPath, taskId];
      break;
    default:
      console.error(`❌ Unsupported platform: ${platform}`);
      process.exit(1);
  }

  try {
    spawn(command, args, { detached: true, stdio: 'ignore' });
    console.log(`🖥️  Opening terminal window to view agent logs...`);
    console.log(`   Platform: ${platform}`);
  } catch (error) {
    console.error('❌ Failed to open terminal window:', error.message);
    console.log('   Falling back to inline monitoring...');
    return false;
  }

  return true;
}

// Create task command
program
  .option('--env-file <path>', 'Path to .env file (defaults to .env.agent_orchestration)')
  .action((opts) => {
    if (opts?.envFile) {
      loadEnv(path.resolve(opts.envFile));
    }
  });

program
  .command('create')


  .description('Create a new task')
  .requiredOption('-t, --title <title>', 'Task title')
  .option('-d, --description <description>', 'Task description')
  .option('-p, --pipeline <pipeline>', 'Pipeline ID (default: auto)', 'auto')
  .option('-r, --repository <repository>', 'Git repository URL')
  .option('-b, --branch <branch>', 'Target branch')
  .option('--priority <priority>', 'Task priority (low, medium, high)', 'medium')
  .option('--jira <ticket>', 'Jira ticket number')
  .action(async (options) => {
    try {
      console.log('Creating task...');
      const task = createTask({
        title: options.title,
        description: options.description || null,
        pipeline: options.pipeline,
        repository: options.repository || null,
        target_branch: options.branch || null,
        priority: options.priority,
        jira_ticket: options.jira || null,
      });
      
      console.log(`✅ Task created successfully!`);
      console.log(`   ID: ${task.id}`);
      console.log(`   Title: ${task.title}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Pipeline: ${task.pipeline_id}`);
      console.log(`\nMonitor task with: node cli.js monitor ${task.id}`);
    } catch (error) {
      console.error('❌ Failed to create task:', error.message);
      process.exit(1);
    }
  });

// List tasks command
program
  .command('list')
  .description('List all tasks')
  .action(() => {
    try {
      const tasks = listTasks();
      
      if (tasks.length === 0) {
        console.log('No tasks found.');
        return;
      }
      
      console.log(`\nFound ${tasks.length} task(s):\n`);
      tasks.forEach((task, index) => {
        console.log(`${index + 1}. ${task.id}`);
        console.log(`   Title: ${task.title}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Priority: ${task.priority}`);
        console.log(`   Created: ${new Date(task.created_at).toLocaleString()}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Failed to list tasks:', error.message);
      process.exit(1);
    }
  });

// View task command
program
  .command('view <taskId>')
  .description('View task details')
  .action(async (taskId) => {
    try {
      const task = getTaskById(taskId);
      
      if (!task) {
        console.error('❌ Task not found');
        process.exit(1);
      }
      
      console.log(`\nTask Details:\n`);
      console.log(`ID: ${task.id}`);
      console.log(`Title: ${task.title}`);
      console.log(`Description: ${task.description || 'N/A'}`);
      console.log(`Status: ${task.status}`);
      console.log(`Priority: ${task.priority}`);
      console.log(`Pipeline: ${task.pipeline_id || 'N/A'}`);
      console.log(`Repository: ${task.repository || 'N/A'}`);
      console.log(`Target Branch: ${task.target_branch || 'N/A'}`);
      console.log(`Jira Ticket: ${task.jira_ticket || 'N/A'}`);
      console.log(`Created: ${new Date(task.created_at).toLocaleString()}`);
      console.log(`Updated: ${new Date(task.updated_at).toLocaleString()}`);
      
      // Get execution details if available
      const execution = getTaskExecution(taskId);
      if (execution) {
        console.log(`\nExecution:`);
        console.log(`ID: ${execution.id}`);
        console.log(`Status: ${execution.status}`);
        console.log(`Started: ${new Date(execution.started_at).toLocaleString()}`);
        if (execution.completed_at) {
          console.log(`Completed: ${new Date(execution.completed_at).toLocaleString()}`);
        }
        
        const stages = getStagesForExecution(execution.id);
        if (stages.length > 0) {
          console.log(`\nStages:`);
          stages.forEach((stage) => {
            console.log(`  - ${stage.stage_name}: ${stage.status}`);
            if (stage.verdict) {
              console.log(`    Verdict: ${stage.verdict}`);
            }
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to view task:', error.message);
      process.exit(1);
    }
  });

// Monitor task command
program
  .command('monitor <taskId>')
  .description('Monitor task execution in real-time')
  .option('--no-terminal', 'Monitor inline instead of opening new terminal window')
  .action(async (taskId, options) => {
    try {
      const task = getTaskById(taskId);
      
      if (!task) {
        console.error('❌ Task not found');
        process.exit(1);
      }
      
      console.log(`\n📋 Task: ${task.title}`);
      console.log(`   ID: ${task.id}`);
      console.log(`   Status: ${task.status}\n`);
      
      // Spawn terminal window with log viewer (unless --no-terminal flag)
      if (options.terminal !== false) {
        const spawned = spawnLogViewer(taskId);
        if (spawned) {
          console.log(`\n💡 New terminal window opened with live agent logs`);
          console.log(`   Close the new terminal to stop viewing logs\n`);
          console.log(`   Current terminal will continue to show task status updates...\n`);
          
          // Continue with status monitoring in current terminal
          monitorStatus(taskId, task);
          return;
        }
      }
      
      // Fallback to inline monitoring
      monitorStatus(taskId, task);
    } catch (error) {
      console.error('❌ Failed to monitor task:', error.message);
      process.exit(1);
    }
  });

// Status monitoring function (used for both modes)
function monitorStatus(taskId, task) {
  console.log(`Press Ctrl+C to stop monitoring\n`);
  
  const interval = setInterval(() => {
    const updatedTask = getTaskById(taskId);
    const execution = getTaskExecution(taskId);
    
    if (updatedTask.status !== task.status) {
      console.log(`[${new Date().toLocaleTimeString()}] Status changed: ${task.status} → ${updatedTask.status}`);
      task.status = updatedTask.status;
    }
    
    if (execution) {
      const stages = getStagesForExecution(execution.id);
      stages.forEach((stage) => {
        if (stage.status === 'running') {
          console.log(`[${new Date().toLocaleTimeString()}] Stage running: ${stage.stage_name}`);
        } else if (stage.status === 'completed' && stage.verdict) {
          console.log(`[${new Date().toLocaleTimeString()}] Stage completed: ${stage.stage_name} - ${stage.verdict}`);
        } else if (stage.status === 'failed') {
          console.log(`[${new Date().toLocaleTimeString()}] Stage failed: ${stage.stage_name}`);
        }
      });
      
      if (execution.status === 'completed') {
        console.log(`\n✅ Task completed successfully!`);
        clearInterval(interval);
        process.exit(0);
      } else if (execution.status === 'failed') {
        console.log(`\n❌ Task failed`);
        clearInterval(interval);
        process.exit(1);
      }
    }
  }, 2000);
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\nMonitoring stopped');
    clearInterval(interval);
    process.exit(0);
  });
}

program.parse();
