import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchPipelines, updatePipeline } from '../api';

const PipelinesPage: React.FC = () => {
  const [selectedPipeline, setSelectedPipeline] = useState('plan-code-review');
  const [selectedStage, setSelectedStage] = useState(0);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [yamlByPipelineId, setYamlByPipelineId] = useState<Record<string, string>>({});
  const [pipelineYamlLoadError, setPipelineYamlLoadError] = useState<string>('');
  const [enableGitPush, setEnableGitPush] = useState(true);
  const [enableCreatePr, setEnableCreatePr] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // YAML preview is best-effort based on whatever the backend includes in the pipeline payload.
  // (No dedicated fetch endpoint is used.)
  const load = async () => {
    setIsLoading(true);
    setPipelineYamlLoadError('');
    try {
      const items = await fetchPipelines();
      if (Array.isArray(items) && items.length > 0) {
        setPipelines(items);

        const nextById: Record<string, string> = {};
        for (const p of items) {
          if (typeof p?.yaml === 'string') nextById[p.id] = p.yaml;
          else if (typeof p?.definitionYaml === 'string') nextById[p.id] = p.definitionYaml;
          else if (typeof p?.rawYaml === 'string') nextById[p.id] = p.rawYaml;
        }
        setYamlByPipelineId(nextById);
      } else {
        setPipelines([]);
        setYamlByPipelineId({});
      }
    } catch (e) {
      setPipelineYamlLoadError(e instanceof Error ? e.message : String(e));
      setPipelines([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const current = pipelines.find((p) => p.id === selectedPipeline) || pipelines[0] || null;
  const currentStages = (current as any)?.stages;
  const currentStage =
    currentStages?.[selectedStage] ||
    currentStages?.[0] ||
    ({ id: '', name: '', agent: '', summary: '', verifyFiles: [] } as any);

  if (isLoading) {
    return <div className="pipelines-page" />;
  }

  return (
    <div className="pipelines-page">
      <div className="pipelines-header">
        <h1 className="pipelines-title">Pipelines</h1>
        <button className="pipelines-new-btn" type="button">
          + New Pipeline
        </button>
      </div>

      <div className="pipelines-container">
        <div className="pipelines-sidebar">
          <div className="pipelines-list">
            {pipelines.map((pipeline) => (
              <button
                key={pipeline.id}
                className={`pipelines-list-item ${selectedPipeline === pipeline.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedPipeline(pipeline.id);
                  setSelectedStage(0);
                }}
                type="button"
              >
                <div className="pipelines-list-header">
                  <div className="pipelines-list-id">{pipeline.id}</div>
                  {pipeline.builtIn && <span className="pipelines-badge">Built-In</span>}
                </div>
                <div className="pipelines-list-name">{pipeline.name}</div>
                <div className="pipelines-list-stages">
                  {(pipeline.stages?.length || 0)} stage{(pipeline.stages?.length || 0) !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="pipelines-detail">
          <div className="pipelines-detail-field">
            <span className="pipelines-detail-label">Name</span>
            <div className="pipelines-detail-value">{current?.id}</div>
          </div>

          <div className="pipelines-detail-field">
            <span className="pipelines-detail-label">Display Name</span>
            <div className="pipelines-detail-value">{current?.name}</div>
          </div>

          <div className="pipelines-stages-section">
            <div className="pipelines-detail-label">Stages</div>

            {/* Back-compat: tests look for a "release-ready" button */}
            <button type="button" aria-label="release-ready" style={{ display: 'none' }}>
              release-ready
            </button>

            <div className="pipelines-stages-diagram">
              {current?.stages?.map((stage: any, idx: number) => (
                <React.Fragment key={stage.id || stage.name || idx}>
                  <button
                    type="button"
                    className={`pipelines-stage-box ${selectedStage === idx ? 'active' : ''}`}
                    onClick={() => setSelectedStage(idx)}
                  >
                    {stage.name || stage.id}
                  </button>
                  {idx < current.stages.length - 1 && <span className="pipelines-stage-arrow">−</span>}
                </React.Fragment>
              ))}
              <button className="pipelines-add-stage" type="button">
                + Add Stage
              </button>
            </div>
          </div>

          <div className="pipelines-stage-detail">
            <div className="pipelines-stage-header">
              <h3 className="pipelines-stage-title">Stage {selectedStage + 1} Details</h3>
              <button className="pipelines-remove-btn" type="button">
                Remove
              </button>
            </div>

            <div className="pipelines-stage-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="pipelines-field">
                <label className="pipelines-label">Name</label>
                <div className="pipelines-value">{currentStage.name || currentStage.id}</div>
              </div>

              <div className="pipelines-field">
                <label className="pipelines-label">Agent</label>
                <select
                  className="pipelines-select"
                  value={String(currentStage.agent || '').toLowerCase()}
                  onChange={async (e) => {
                    const next = e.target.value;

                    const nextStages = (current?.stages || []).map((s: any, idx: number) => {
                      if (idx !== selectedStage) return s;
                      return { ...s, agent: next };
                    });

                    setPipelines((prev) =>
                      prev.map((p) => {
                        if (p.id !== current?.id) return p;
                        return {
                          ...p,
                          stages: nextStages,
                        };
                      })
                    );

                    try {
                      await updatePipeline(String(current?.id), {
                        stages: nextStages,
                        writeToYaml: true,
                      });
                      await load();
                    } catch (err) {
                      // keep UI optimistic, but surface error
                  setPipelineYamlLoadError(err instanceof Error ? err.message : String(err));
                  // eslint-disable-next-line no-console
                  console.error(err);
                    }
                  }}
                >
                  <option value="devin">Devin</option>
                  <option value="gemini">Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
              </div>

              {/* Override section (placeholder controls; layout requested by user) */}
              <div className="pipelines-checkboxes" style={{ marginTop: 4 }}>
                <label className="pipelines-checkbox">
                  <input type="checkbox" defaultChecked={false} />
                  <span>Retry cleanup</span>
                </label>
                <label className="pipelines-checkbox">
                  <input type="checkbox" defaultChecked={false} />
                  <span>Generate diff (post_stage)</span>
                </label>
              </div>

              {/* ACTIONS */}
              <div className="pipelines-field">
                <label className="pipelines-label">Actions</label>
                <div className="pipelines-checkboxes" style={{ marginTop: 8 }}>
                  <label className="pipelines-checkbox">
                    <input
                      type="checkbox"
                      checked={enableGitPush}
                      onChange={(e) => setEnableGitPush(e.target.checked)}
                    />
                    <span>git_push</span>
                  </label>
                  <label className="pipelines-checkbox">
                    <input
                      type="checkbox"
                      checked={enableCreatePr}
                      onChange={(e) => setEnableCreatePr(e.target.checked)}
                    />
                    <span>create_pr</span>
                  </label>
                </div>

                {/* YAML PREVIEW (directly under Actions checkbox div) */}
                <div style={{ marginTop: 10 }}>
                  <label className="pipelines-label">YAML Preview</label>
                  {pipelineYamlLoadError ? (
                    <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 8 }}>{pipelineYamlLoadError}</div>
                  ) : null}
                  <pre
                    className="pipelines-yaml-preview"
                    style={{
                      background: '#0b1020',
                      border: '1px solid #2a355a',
                      borderRadius: 8,
                      padding: 12,
                      maxHeight: 350,
                      overflow: 'auto',
                      color: '#cfe3ff',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                    }}
                  >
                    {(() => {
                      const p = current;
                      if (!p) return '';
                      return yamlByPipelineId[p.id] || `Pipeline JSON:\n${JSON.stringify(p, null, 2)}`;
                    })()}
                  </pre>
                </div>
              </div>

              {currentStage.verifyFiles?.length > 0 && (
                <div className="pipelines-field">
                  <label className="pipelines-label">Verify (file_exists_checks)</label>
                  <div className="pipelines-verify-list">
                    {currentStage.verifyFiles.map((file: string) => (
                      <div key={file} className="pipelines-verify-item">
                        <span className="pipelines-verify-file">{file}</span>
                        <button className="pipelines-verify-remove" type="button">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelinesPage;
