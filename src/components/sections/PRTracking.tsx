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

const STATUS_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  open:              { color: '#6b9eff', bg: 'rgba(107,158,255,0.12)', icon: '🔓' },
  merged:            { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: '🔀' },
  closed:            { color: 'rgba(243,244,246,0.4)', bg: 'rgba(255,255,255,0.06)', icon: '🔒' },
  approved:          { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: '✅' },
  changes_requested: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: '🔄' },
};

const getStatus = (s: string) => STATUS_STYLE[s.toLowerCase()] ?? STATUS_STYLE.closed;

const getRepoName = (url: string) => {
  try { return new URL(url).pathname.split('/').filter(Boolean).slice(-2).join('/'); }
  catch { return url; }
};

export default function PRTracking({ taskId }: { taskId?: string }) {
  const [prs, setPRs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPRs = async () => {
    try {
      const url = taskId ? `/api/tasks/${taskId}/pull-requests` : `/api/pull-requests`;
      const data = await fetch(url).then(r => r.json());
      setPRs(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchPRs();
    const interval = setInterval(fetchPRs, 30000);
    return () => clearInterval(interval);
  }, [taskId]);

  if (loading) return <div style={{ color: 'rgba(243,244,246,0.4)', padding: '24px 0' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="td-card-title" style={{ margin: 0 }}>Pull Requests</div>
        <button onClick={fetchPRs} style={{ background: 'none', border: 'none', color: '#6b9eff', fontSize: 13, cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {prs.length === 0 ? (
        <div style={{ color: 'rgba(243,244,246,0.4)', fontSize: 14, padding: '16px 0' }}>No pull requests found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {prs.map((pr) => {
            const s = getStatus(pr.status);
            return (
              <div key={pr.id} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span>{s.icon}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: s.bg, color: s.color, textTransform: 'uppercase',
                      }}>{pr.status.replace('_', ' ')}</span>
                      <span style={{ fontWeight: 600, color: '#f3f4f6', fontSize: 14 }}>PR #{pr.pr_number}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(243,244,246,0.45)', marginBottom: 8 }}>
                      {getRepoName(pr.repo)}
                    </div>
                    {pr.url && (
                      <a href={pr.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 13, color: '#6b9eff', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        View on {pr.url.includes('github') ? 'GitHub' : 'Bitbucket'} →
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(243,244,246,0.4)', textAlign: 'right', flexShrink: 0 }}>
                    <div>Created: {new Date(pr.created_at).toLocaleDateString()}</div>
                    {pr.merged_at && <div style={{ color: '#4ade80' }}>Merged: {new Date(pr.merged_at).toLocaleDateString()}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
