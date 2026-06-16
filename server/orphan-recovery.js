import db from './db.js';
import crypto from 'crypto';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let lastHeartbeat = null;

/**
 * Record a heartbeat from the worker
 */
export function recordHeartbeat() {
  lastHeartbeat = Date.now();
}

/**
 * Get the last heartbeat timestamp
 */
export function getLastHeartbeat() {
  return lastHeartbeat;
}

/**
 * Check if the worker is stale (no recent heartbeat)
 */
export function isWorkerStale() {
  if (!lastHeartbeat) return false;
  return (Date.now() - lastHeartbeat) > STALE_THRESHOLD_MS;
}

/**
 * Recover orphaned tasks that are stuck in 'running' status
 * This happens when a worker crashes or loses connection
 */
export function recoverOrphanedTasks() {
  const now = new Date().toISOString();
  
  // Find tasks that have been in 'running' status for too long
  const staleTasks = db.prepare(`
    SELECT id, title, status, updated_at
    FROM tasks
    WHERE status = 'running'
    AND datetime(updated_at) < datetime('now', '-30 minutes')
  `).all();

  if (staleTasks.length === 0) {
    return { recovered: 0, tasks: [] };
  }

  console.log(`[orphan-recovery] Found ${staleTasks.length} stale task(s) to recover`);

  const recovered = [];
  for (const task of staleTasks) {
    try {
      // Reset task status to 'queued' so it can be picked up again
      db.prepare(`
        UPDATE tasks
        SET status = 'queued',
            retry_count = retry_count + 1,
            updated_at = ?
        WHERE id = ?
      `).run(now, task.id);

      // Record recovery activity
      const activityStmt = db.prepare(`
        INSERT INTO activity_log (id, task_id, event_type, message, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      activityStmt.run(
        crypto.randomUUID(),
        task.id,
        'orphan_recovery',
        `Task recovered from stale running state`,
        JSON.stringify({ previousStatus: task.status, recoveredAt: now }),
        now
      );

      recovered.push(task.id);
      console.log(`[orphan-recovery] Recovered task ${task.id}: ${task.title}`);
    } catch (error) {
      console.error(`[orphan-recovery] Failed to recover task ${task.id}:`, error.message);
    }
  }

  return { recovered: recovered.length, tasks: recovered };
}

/**
 * Start the orphan recovery watchdog
 * Runs periodically to check for and recover stale tasks
 */
export function startOrphanRecoveryWatchdog(intervalMs = HEARTBEAT_INTERVAL_MS) {
  console.log(`[orphan-recovery] Starting watchdog with ${intervalMs}ms interval`);
  
  const interval = setInterval(() => {
    try {
      const result = recoverOrphanedTasks();
      if (result.recovered > 0) {
        console.log(`[orphan-recovery] Watchdog recovered ${result.recovered} task(s)`);
      }
    } catch (error) {
      console.error('[orphan-recovery] Watchdog error:', error.message);
    }
  }, intervalMs);

  return interval;
}

/**
 * Stop the orphan recovery watchdog
 */
export function stopOrphanRecoveryWatchdog(interval) {
  if (interval) {
    clearInterval(interval);
    console.log('[orphan-recovery] Watchdog stopped');
  }
}

/**
 * Get statistics about orphan recovery
 */
export function getOrphanRecoveryStats() {
  const staleTasks = db.prepare(`
    SELECT COUNT(*) as count
    FROM tasks
    WHERE status = 'running'
    AND datetime(updated_at) < datetime('now', '-30 minutes')
  `).get();

  const runningTasks = db.prepare(`
    SELECT COUNT(*) as count
    FROM tasks
    WHERE status = 'running'
  `).get();

  const queuedTasks = db.prepare(`
    SELECT COUNT(*) as count
    FROM tasks
    WHERE status = 'queued'
  `).get();

  return {
    staleTasks: staleTasks.count,
    runningTasks: runningTasks.count,
    queuedTasks: queuedTasks.count,
    lastHeartbeat: lastHeartbeat ? new Date(lastHeartbeat).toISOString() : null,
    isWorkerStale: isWorkerStale(),
  };
}
