import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import db from './db.js';

/**
 * Check if there are merge conflicts in a repository
 */
export function hasMergeConflicts(repoPath) {
  const result = spawnSync('git', ['status', '--porcelain'], { 
    cwd: repoPath, 
    encoding: 'utf8' 
  });
  
  if (result.status !== 0) {
    console.error('[conflict-resolver] Git status failed:', result.stderr);
    return false;
  }

  // Check for conflicted files (both modified by us and them)
  const conflictedFiles = result.stdout
    .split('\n')
    .filter(line => line.trim().startsWith('UU') || line.trim().startsWith('AA'))
    .map(line => line.substring(3).trim());
  
  return conflictedFiles.length > 0 ? conflictedFiles : false;
}

/**
 * Get list of conflicted files
 */
export function getConflictedFiles(repoPath) {
  const result = spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], { 
    cwd: repoPath, 
    encoding: 'utf8' 
  });
  
  if (result.status !== 0) {
    return [];
  }

  return result.stdout.split('\n').filter(f => f.trim());
}

/**
 * Attempt to resolve conflicts using a strategy
 */
export async function resolveConflicts(repoPath, strategy = 'theirs') {
  const conflictedFiles = getConflictedFiles(repoPath);
  
  if (conflictedFiles.length === 0) {
    return { success: true, resolved: 0, files: [] };
  }

  console.log(`[conflict-resolver] Found ${conflictedFiles.length} conflicted file(s)`);

  let resolved = 0;
  const failed = [];

  for (const file of conflictedFiles) {
    try {
      const filePath = path.join(repoPath, file);
      
      if (strategy === 'theirs') {
        // Accept their version (incoming changes)
        spawnSync('git', ['checkout', '--theirs', file], { cwd: repoPath });
      } else if (strategy === 'ours') {
        // Accept our version (current changes)
        spawnSync('git', ['checkout', '--ours', file], { cwd: repoPath });
      } else if (strategy === 'union') {
        // Try to merge both versions (simple line-based union)
        await resolveWithUnionStrategy(filePath);
      }
      
      // Mark as resolved
      spawnSync('git', ['add', file], { cwd: repoPath });
      resolved++;
    } catch (error) {
      console.error(`[conflict-resolver] Failed to resolve ${file}:`, error.message);
      failed.push(file);
    }
  }

  return {
    success: failed.length === 0,
    resolved,
    failed,
    files: conflictedFiles
  };
}

/**
 * Simple union strategy: keep both versions where possible
 */
async function resolveWithUnionStrategy(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');
  
  const resolvedLines = [];
  let inConflict = false;
  let conflictMarkerCount = 0;
  
  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      conflictMarkerCount++;
      continue;
    }
    if (line.startsWith('>>>>>>>')) {
      inConflict = false;
      continue;
    }
    if (line.startsWith('=======') && inConflict) {
      continue;
    }
    
    if (!inConflict) {
      resolvedLines.push(line);
    }
  }
  
  await fs.writeFile(filePath, resolvedLines.join('\n'), 'utf8');
}

/**
 * Create a conflict resolution task
 */
export async function createConflictResolutionTask(originalTaskId, conflictDetails) {
  const taskId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const insert = db.prepare(`
    INSERT INTO tasks (id, title, description, status, priority, repository, target_branch, pipeline_id, retry_count, created_at, updated_at)
    VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, 0, ?, ?)
  `);
  
  insert.run(
    taskId,
    `Conflict Resolution for task ${originalTaskId.slice(0, 8)}`,
    `Automatic conflict resolution task for rebase conflicts.\n\nOriginal Task: ${originalTaskId}\nConflicted Files: ${conflictDetails.files.join(', ')}\n\nThis task will attempt to resolve git merge conflicts that occurred during rebase.`,
    'high',
    conflictDetails.repository || null,
    conflictDetails.targetBranch || null,
    'code-only',
    now,
    now
  );
  
  // Record activity
  const activityStmt = db.prepare(`
    INSERT INTO activity_log (id, task_id, event_type, message, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  activityStmt.run(
    crypto.randomUUID(),
    taskId,
    'conflict_resolution_created',
    `Conflict resolution task created for ${conflictDetails.files.length} conflicted file(s)`,
    JSON.stringify({ originalTaskId, conflictDetails }),
    now
  );
  
  return taskId;
}

/**
 * Attempt automatic rebase with conflict resolution
 */
export async function attemptRebaseWithResolution(repoPath, targetBranch, taskId) {
  console.log(`[conflict-resolver] Attempting rebase to ${targetBranch}`);
  
  // Fetch latest changes
  const fetchResult = spawnSync('git', ['fetch', 'origin'], { cwd: repoPath });
  if (fetchResult.status !== 0) {
    console.error('[conflict-resolver] Git fetch failed:', fetchResult.stderr);
    return { success: false, error: 'Fetch failed' };
  }
  
  // Attempt rebase
  const rebaseResult = spawnSync('git', ['rebase', `origin/${targetBranch}`], { 
    cwd: repoPath,
    encoding: 'utf8'
  });
  
  if (rebaseResult.status === 0) {
    console.log('[conflict-resolver] Rebase successful');
    return { success: true, conflicts: false };
  }
  
  // Check for conflicts
  const conflictedFiles = hasMergeConflicts(repoPath);
  if (!conflictedFiles) {
    // Rebase failed for other reasons
    console.error('[conflict-resolver] Rebase failed without conflicts:', rebaseResult.stderr);
    return { success: false, error: 'Rebase failed', details: rebaseResult.stderr };
  }
  
  console.log(`[conflict-resolver] Rebase resulted in ${conflictedFiles.length} conflict(s)`);
  
  // Attempt automatic resolution
  const resolutionResult = await resolveConflicts(repoPath, 'theirs');
  
  if (resolutionResult.success) {
    // Continue rebase after resolution
    const continueResult = spawnSync('git', ['rebase', '--continue'], { 
      cwd: repoPath,
      encoding: 'utf8'
    });
    
    if (continueResult.status === 0) {
      console.log('[conflict-resolver] Rebase continued successfully after resolution');
      return { success: true, conflicts: true, resolved: resolutionResult.resolved };
    } else {
      console.error('[conflict-resolver] Failed to continue rebase:', continueResult.stderr);
      // Abort rebase if continue fails
      spawnSync('git', ['rebase', '--abort'], { cwd: repoPath });
      return { success: false, error: 'Rebase continue failed', details: continueResult.stderr };
    }
  } else {
    // Resolution failed, abort rebase
    console.error('[conflict-resolver] Automatic resolution failed');
    spawnSync('git', ['rebase', '--abort'], { cwd: repoPath });
    
    // Create a manual resolution task
    const conflictTaskId = await createConflictResolutionTask(taskId, {
      repository: null, // Would need to extract from context
      targetBranch,
      files: conflictedFiles
    });
    
    return { 
      success: false, 
      error: 'Automatic resolution failed', 
      manualTask: conflictTaskId,
      failedFiles: resolutionResult.failed 
    };
  }
}

/**
 * Abort current rebase operation
 */
export function abortRebase(repoPath) {
  const result = spawnSync('git', ['rebase', '--abort'], { cwd: repoPath });
  return result.status === 0;
}
