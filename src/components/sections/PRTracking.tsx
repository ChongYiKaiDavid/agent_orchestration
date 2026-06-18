import { useState, useEffect } from 'react';

interface PullRequest {
  id: string;
  execution_id: string;
  repo: string;
  pr_number: string;
  url: string;
  status: string;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PRTrackingProps {
  taskId?: string;
}

export default function PRTracking({ taskId }: PRTrackingProps) {
  const [prs, setPRs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);

  useEffect(() => {
    fetchPRs();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchPRs, 30000);
    return () => clearInterval(interval);
  }, [taskId]);

  const fetchPRs = async () => {
    try {
      let url = 'http://localhost:5174/api/pull-requests';
      if (taskId) {
        url = `http://localhost:5174/api/tasks/${taskId}/pull-requests`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        console.error('Failed to fetch PRs:', response.status, response.statusText);
        setPRs([]);
        setLoading(false);
        return;
      }
      const data = await response.json();
      setPRs(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch PRs:', error);
      setPRs([]);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'merged':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'closed':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'changes_requested':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return '🔓';
      case 'merged':
        return '🔀';
      case 'closed':
        return '🔒';
      case 'approved':
        return '✅';
      case 'changes_requested':
        return '🔄';
      default:
        return '❓';
    }
  };

  const getRepoName = (repoUrl: string) => {
    try {
      const url = new URL(repoUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts.slice(-2).join('/');
    } catch {
      return repoUrl;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-800 rounded"></div>
            <div className="h-16 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Pull Requests</h3>
        <button
          onClick={fetchPRs}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Refresh
        </button>
      </div>

      {prs.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No pull requests found
        </div>
      ) : (
        <div className="space-y-3">
          {prs.map((pr) => (
            <div
              key={pr.id}
              className={`bg-gray-800 rounded-lg p-4 border cursor-pointer hover:bg-gray-750 transition-colors ${
                selectedPR?.id === pr.id ? 'border-blue-500' : 'border-gray-700'
              }`}
              onClick={() => setSelectedPR(pr)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{getStatusIcon(pr.status)}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(pr.status)}`}>
                      {pr.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-white font-medium mb-1">
                    PR #{pr.pr_number}
                  </div>
                  <div className="text-sm text-gray-400 mb-2">
                    {getRepoName(pr.repo)}
                  </div>
                  {pr.url && (
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on {pr.url.includes('github') ? 'GitHub' : 'Bitbucket'} →
                    </a>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400">
                  <div>Created: {new Date(pr.created_at).toLocaleDateString()}</div>
                  {pr.merged_at && (
                    <div className="text-green-400">Merged: {new Date(pr.merged_at).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPR && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h4 className="text-white font-medium mb-2">PR Details</h4>
          <div className="bg-gray-800 rounded-lg p-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-gray-400">Status:</div>
              <div className="text-white capitalize">{selectedPR.status.replace('_', ' ')}</div>
              <div className="text-gray-400">PR Number:</div>
              <div className="text-white">#{selectedPR.pr_number}</div>
              <div className="text-gray-400">Repository:</div>
              <div className="text-white">{getRepoName(selectedPR.repo)}</div>
              <div className="text-gray-400">Created:</div>
              <div className="text-white">{new Date(selectedPR.created_at).toLocaleString()}</div>
              <div className="text-gray-400">Updated:</div>
              <div className="text-white">{new Date(selectedPR.updated_at).toLocaleString()}</div>
              {selectedPR.merged_at && (
                <>
                  <div className="text-gray-400">Merged:</div>
                  <div className="text-green-400">{new Date(selectedPR.merged_at).toLocaleString()}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
