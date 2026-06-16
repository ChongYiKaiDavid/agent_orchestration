import db from './db.js';
import crypto from 'crypto';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let pollInterval = null;

/**
 * Get PR status from GitHub API
 */
async function getGitHubPRStatus(owner, repo, prNumber, token) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const prData = await response.json();
  
  // Get review comments
  const commentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  const comments = commentsResponse.ok ? await commentsResponse.json() : [];
  
  // Get reviews
  const reviewsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  const reviews = reviewsResponse.ok ? await reviewsResponse.json() : [];

  return {
    state: prData.state,
    merged: prData.merged,
    mergeable: prData.mergeable,
    comments: comments.map(c => ({
      user: c.user?.login,
      body: c.body,
      createdAt: c.created_at,
    })),
    reviews: reviews.map(r => ({
      user: r.user?.login,
      state: r.state, // APPROVED, CHANGES_REQUESTED, COMMENTED
      body: r.body,
      submittedAt: r.submitted_at,
    })),
  };
}

/**
 * Get PR status from Bitbucket API
 */
async function getBitbucketPRStatus(workspace, repoSlug, prNumber, token, username) {
  const authHeader = token 
    ? `Bearer ${token}` 
    : `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;

  const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}`, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Bitbucket API error: ${response.status}`);
  }

  const prData = await response.json();
  
  // Get comments
  const commentsResponse = await fetch(prData.links.comments.href, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
    },
  });

  const commentsData = commentsResponse.ok ? await commentsResponse.json() : { values: [] };
  
  return {
    state: prData.state, // OPEN, MERGED, DECLINED, SUPERSEDED
    merged: prData.state === 'MERGED',
    mergeable: prData.mergeable !== false,
    comments: commentsData.values.map(c => ({
      user: c.user?.display_name,
      body: c.content?.raw,
      createdAt: c.created_on,
    })),
  };
}

/**
 * Parse repository URL to extract provider and details
 */
function parseRepositoryUrl(repository) {
  if (!repository) return null;

  // GitHub
  const githubMatch = repository.match(/(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^.]+)(?:\.git)?/i);
  if (githubMatch) {
    return {
      provider: 'github',
      owner: githubMatch[1],
      repo: githubMatch[2].replace(/\.git$/, ''),
    };
  }

  // Bitbucket
  const bitbucketMatch = repository.match(/(?:https:\/\/bitbucket\.org\/|git@bitbucket\.org:)([^/]+)\/([^.]+)(?:\.git)?/i);
  if (bitbucketMatch) {
    return {
      provider: 'bitbucket',
      workspace: bitbucketMatch[1],
      repo: bitbucketMatch[2].replace(/\.git$/, ''),
    };
  }

  return null;
}

/**
 * Update PR status in database
 */
function updatePRStatus(prId, status, details) {
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE pull_requests
    SET status = ?, merged_at = ?
    WHERE id = ?
  `).run(status, status === 'merged' ? now : null, prId);

  // Record activity
  const activityStmt = db.prepare(`
    INSERT INTO activity_log (id, task_id, event_type, message, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  // Get task_id from execution_id
  const pr = db.prepare('SELECT execution_id FROM pull_requests WHERE id = ?').get(prId);
  if (pr) {
    const execution = db.prepare('SELECT task_id FROM executions WHERE id = ?').get(pr.execution_id);
    if (execution) {
      activityStmt.run(
        crypto.randomUUID(),
        execution.task_id,
        'pr_status_update',
        `PR status updated to ${status}`,
        JSON.stringify(details),
        now
      );
    }
  }
}

/**
 * Poll a single PR for status changes
 */
async function pollPR(prId) {
  const pr = db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(prId);
  if (!pr) {
    console.log(`[pr-poller] PR ${prId} not found`);
    return;
  }

  // Skip if already merged
  if (pr.status === 'merged') {
    return;
  }

  const repoInfo = parseRepositoryUrl(pr.repo);
  if (!repoInfo) {
    console.log(`[pr-poller] Could not parse repository URL: ${pr.repo}`);
    return;
  }

  try {
    let statusData;
    
    if (repoInfo.provider === 'github') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        console.log('[pr-poller] GitHub token not configured');
        return;
      }
      statusData = await getGitHubPRStatus(repoInfo.owner, repoInfo.repo, pr.pr_number, token);
    } else if (repoInfo.provider === 'bitbucket') {
      const token = process.env.BITBUCKET_HTTPS_TOKEN || process.env.BITBUCKET_TOKEN;
      const username = process.env.BITBUCKET_USERNAME;
      if (!token) {
        console.log('[pr-poller] Bitbucket token not configured');
        return;
      }
      statusData = await getBitbucketPRStatus(repoInfo.workspace, repoInfo.repo, pr.pr_number, token, username);
    } else {
      console.log(`[pr-poller] Unsupported provider: ${repoInfo.provider}`);
      return;
    }

    // Determine new status
    let newStatus = pr.status;
    if (statusData.merged) {
      newStatus = 'merged';
    } else if (statusData.state === 'closed' || statusData.state === 'DECLINED') {
      newStatus = 'closed';
    } else if (statusData.reviews?.some(r => r.state === 'CHANGES_REQUESTED')) {
      newStatus = 'changes_requested';
    } else if (statusData.reviews?.some(r => r.state === 'APPROVED')) {
      newStatus = 'approved';
    }

    // Update if status changed
    if (newStatus !== pr.status) {
      console.log(`[pr-poller] PR ${pr.pr_number} status changed: ${pr.status} -> ${newStatus}`);
      updatePRStatus(prId, newStatus, statusData);
    }

    // Extract reviewer feedback
    if (statusData.comments?.length > 0 || statusData.reviews?.length > 0) {
      const feedback = {
        comments: statusData.comments,
        reviews: statusData.reviews,
      };
      console.log(`[pr-poller] PR ${pr.pr_number} has ${feedback.comments?.length || 0} comments, ${feedback.reviews?.length || 0} reviews`);
    }

  } catch (error) {
    console.error(`[pr-poller] Error polling PR ${pr.pr_number}:`, error.message);
  }
}

/**
 * Poll all open PRs
 */
export function pollAllPRs() {
  const openPRs = db.prepare(`
    SELECT * FROM pull_requests
    WHERE status IN ('open', 'approved', 'changes_requested')
  `).all();

  console.log(`[pr-poller] Polling ${openPRs.length} open PR(s)`);

  for (const pr of openPRs) {
    pollPR(pr.id).catch(err => {
      console.error(`[pr-poller] Error polling PR ${pr.pr_number}:`, err.message);
    });
  }

  return { polled: openPRs.length };
}

/**
 * Start PR polling watchdog
 */
export function startPRPolling(intervalMs = POLL_INTERVAL_MS) {
  console.log(`[pr-poller] Starting PR polling with ${intervalMs}ms interval`);
  
  // Initial poll
  pollAllPRs();
  
  pollInterval = setInterval(() => {
    try {
      pollAllPRs();
    } catch (error) {
      console.error('[pr-poller] Polling error:', error.message);
    }
  }, intervalMs);

  return pollInterval;
}

/**
 * Stop PR polling watchdog
 */
export function stopPRPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[pr-poller] PR polling stopped');
  }
}

/**
 * Get PR polling statistics
 */
export function getPRPollingStats() {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN status = 'merged' THEN 1 ELSE 0 END) as merged,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'changes_requested' THEN 1 ELSE 0 END) as changes_requested
    FROM pull_requests
  `).get();

  return {
    ...stats,
    isRunning: pollInterval !== null,
  };
}
