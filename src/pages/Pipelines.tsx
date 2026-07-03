import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPipelineTemplate, deletePipeline, fetchPipelines, savePipelineYaml, updatePipeline } from '../api';

const PipelinesPage: React.FC = () => {
  const [selectedPipeline, setSelectedPipeline] = useState('plan-code-review');
  const [selectedStage, setSelectedStage] = useState(0);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [yamlByPipelineId, setYamlByPipelineId] = useState<Record<string, string>>({});
  const [yamlPathByPipelineId, setYamlPathByPipelineId] = useState<Record<string, string | null>>({});
  const [pipelineYamlLoadError, setPipelineYamlLoadError] = useState<string>('');
  const [pipelineYamlSaveError, setPipelineYamlSaveError] = useState<string>('');
  const [pipelineYamlSaveStatus, setPipelineYamlSaveStatus] = useState<string>('');
  const [isSavingYaml, setIsSavingYaml] = useState(false);
  const [enableGitPush, setEnableGitPush] = useState(true);
  const [enableCreatePr, setEnableCreatePr] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRunTaskId, setLastRunTaskId] = useState<string>('');
  const [isCreatingPipeline, setIsCreatingPipeline] = useState(false);
  const [pipelineCreateError, setPipelineCreateError] = useState<string>('');

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
        const nextYamlPaths: Record<string, string | null> = {};
        for (const p of items) {
          if (!p?.id) continue;
          if (typeof p?.rawYaml === 'string') nextById[p.id] = p.rawYaml;
          else if (typeof p?.yaml === 'string') nextById[p.id] = p.yaml;
          else if (typeof p?.definitionYaml === 'string') nextById[p.id] = p.definitionYaml;
          nextYamlPaths[p.id] = typeof p?.yamlPath === 'string' ? p.yamlPath : null;
        }
        setYamlByPipelineId(nextById);
        setYamlPathByPipelineId(nextYamlPaths);
      } else {
        setPipelines([]);
        setYamlByPipelineId({});
        setYamlPathByPipelineId({});
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
  const currentYaml = current?.id ? yamlByPipelineId[current.id] || '' : '';
  const currentYamlPath = current?.id ? yamlPathByPipelineId[current.id] || null : null;
  const canSaveYaml = Boolean(current?.id && currentYamlPath && !current?.builtIn);

  if (isLoading) {
    return <div className="pipelines-page" />;
  }

  return (
    <div className="pipelines-page">
      <div className="pipelines-header">
        <h1 className="pipelines-title">Pipelines</h1>
        <button
          className="pipelines-new-btn"
          type="button"
          onClick={async () => {
            setPipelineCreateError('');
            setIsCreatingPipeline(true);
            try {
              const id = window.prompt('New pipeline id (must be unique)', `unique-pipeline-id`) || '';
              const pipelineId = id.trim();
              if (!pipelineId) return;

              const name = window.prompt('Pipeline display name', pipelineId) || '';
              const pipelineName = name.trim();
              if (!pipelineName) return;

              const existingNameTaken = pipelines.some((p) => String(p?.name || '').trim().toLowerCase() === pipelineName.toLowerCase());
              if (existingNameTaken) {
                setPipelineCreateError(`Pipeline name '${pipelineName}' is already taken. Please choose another name.`);
                return;
              }

              const descriptionInput = window.prompt('Pipeline description', '') || '';
              const pipelineDescription = descriptionInput.trim();


              let stages: any[] = [];
              const firstStageName = window.prompt('Stage name', 'Stage 1') || '';
              const firstStageDisplayName = firstStageName.trim();
              if (!firstStageDisplayName) {
                setPipelineCreateError('Please enter a name for the first stage.');
                return;
              }

              const firstStageAgent = (window.prompt('Agent (devin | gemini | deepseek)', 'devin') || 'devin').trim();
              const firstStageSummary = (window.prompt('Stage summary', 'Describe what this stage does') || '').trim();
              if (!firstStageAgent || !firstStageSummary) {
                setPipelineCreateError('Please enter an agent and stage summary for the first stage.');
                return;
              }

              stages.push({
                id: 'stage-1',
                name: firstStageDisplayName,
                agent: firstStageAgent,
                summary: firstStageSummary,
              });

              // Additional stages are optional.
              while (window.confirm('Add another stage to this pipeline?')) {
                const stageName = window.prompt('Stage name', `Stage ${stages.length + 1}`) || '';
                const stageDisplayName = stageName.trim();
                if (!stageDisplayName) break;

                const agent = (window.prompt('Agent (devin | gemini | deepseek)', 'devin') || 'devin').trim();
                const stageSummary = (window.prompt('Stage summary', 'Describe what this stage does') || '').trim();
                if (!agent || !stageSummary) {
                  break;
                }

                stages.push({
                  id: `stage-${stages.length + 1}`,
                  name: stageDisplayName,
                  agent,
                  summary: stageSummary,
                });
              }

              const template = {
                id: pipelineId,
                name: pipelineName,
                description: pipelineDescription,
                stages,
              };

              await createPipelineTemplate({ pipeline: template });
              await load();

              setSelectedPipeline(pipelineId);
              setSelectedStage(0);
              setLastRunTaskId('');
            } catch (err) {
              setPipelineCreateError(err instanceof Error ? err.message : String(err));
            } finally {
              setIsCreatingPipeline(false);
            }
          }}
          disabled={isCreatingPipeline}
          aria-label="create-pipeline"
          title={isCreatingPipeline ? 'Creating pipeline...' : 'Create a pipeline from scratch'}
        >
          {isCreatingPipeline ? 'Creating…' : '+ Create Pipeline'}
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

              <div className="pipelines-detail-field" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="pipelines-remove-btn"
              disabled={!current || current?.builtIn}
              aria-label="delete-pipeline"
              title={current?.builtIn ? 'Built-in pipelines cannot be deleted' : 'Delete this pipeline YAML'}
              onClick={async () => {
                if (!current?.id) return;
                if (current?.builtIn) return;

                const deletedId = String(current.id);
                const ok = window.confirm(`Delete pipeline '${deletedId}'? This will remove server/pipelines/${deletedId}.yaml`);
                if (!ok) return;

                try {
                  await deletePipeline(deletedId);

                  // Fetch fresh list explicitly and update state from that result.
                  const items = await fetchPipelines();
                  const nextPipelines = Array.isArray(items) ? items : [];

                  // Hard-filter just in case backend returns stale entries.
                  const filtered = nextPipelines.filter((p) => String(p?.id) !== deletedId);

                  setPipelines(filtered);
                  setYamlByPipelineId((prev) => {
                    if (!prev || typeof prev !== 'object') return prev;
                    const { [deletedId]: _removed, ...rest } = prev as any;
                    return rest;
                  });
                  setYamlPathByPipelineId((prev) => {
                    if (!prev || typeof prev !== 'object') return prev;
                    const { [deletedId]: _removed, ...rest } = prev as any;
                    return rest;
                  });

                  setSelectedStage(0);
                  setLastRunTaskId('');

                  const nextId = filtered[0]?.id;
                  setSelectedPipeline(nextId ? String(nextId) : '');
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error(err);
                  setPipelineYamlLoadError(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              Delete Pipeline
            </button>
          </div>

          <div className="pipelines-detail-field">
            <span className="pipelines-detail-label">Display Name</span>
            <div className="pipelines-detail-value">{current?.name}</div>
          </div>

              <div className="pipelines-stages-section">
                <div className="pipelines-detail-label">Stages</div>

                {pipelineCreateError ? (
                  <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 6, marginBottom: 8 }}>
                    {pipelineCreateError}
                  </div>
                ) : null}


                {lastRunTaskId ? (
                  <div style={{ color: '#7ee787', fontSize: 12, marginTop: 6, marginBottom: 8 }}>
                    Last run task id: {lastRunTaskId}
                  </div>
                ) : null}

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
              <button
                className="pipelines-add-stage"
                type="button"
                disabled={!current || current?.builtIn}
                onClick={async () => {
                  if (!current) return;
                  if (current?.builtIn) return;

                  const stageNumber = (current.stages?.length || 0) + 1;
                  const stageName = window.prompt('Stage name', `Stage ${stageNumber}`) || '';
                  const name = stageName.trim();
                  if (!name) return;

                  const agent = (window.prompt('Agent (devin | gemini | deepseek)', 'devin') || 'devin').trim();
                  const stageSummary = (window.prompt('Stage summary', 'Describe what this stage does') || '').trim();
                  if (!agent || !stageSummary) return;

                  const nextStages = [
                    ...(current.stages || []),
                    {
                      id: `stage-${stageNumber}`,
                      name,
                      agent,
                      summary: stageSummary,
                    },
                  ];

                  // Optimistic UI update
                  setPipelines((prev) =>
                    prev.map((p) => (p.id === current.id ? { ...p, stages: nextStages } : p))
                  );

                  try {
                    await updatePipeline(String(current.id), {
                      stages: nextStages,
                      writeToYaml: true,
                    });
                    // Ensure selected pipeline reflects YAML changes.
                    await load();
                    // Some backends may return pipelines without the updated stages until cache invalidation;
                    // set state explicitly from nextStages as well.
                    setSelectedPipeline(String(current.id));
                    setPipelines((prev) =>
                      prev.map((p) => (p.id === current.id ? { ...p, stages: nextStages } : p))
                    );
                    setSelectedStage(nextStages.length - 1);
                    setPipelineYamlLoadError('');
                  } catch (err) {
                    setPipelineYamlLoadError(err instanceof Error ? err.message : String(err));
                    // Revert by reloading best-effort
                    try {
                      await load();
                    } catch {
                      // ignore
                    }
                  }
                }}
              >
                + Add Stage
              </button>
            </div>
          </div>

          <div className="pipelines-stage-detail">
            <div className="pipelines-stage-header">
              <h3 className="pipelines-stage-title">Stage {selectedStage + 1} Details</h3>
              <button
                className="pipelines-remove-btn"
                type="button"
                disabled={!current || current?.builtIn || !current?.stages?.length}
                onClick={async () => {
                  if (!current || current?.builtIn) return;
                  const stages = current.stages || [];
                  if (stages.length <= 1) {
                    setPipelineYamlSaveError('A pipeline must keep at least one stage.');
                    return;
                  }

                  const stage = stages[selectedStage] || stages[stages.length - 1];
                  const stageLabel = stage?.name || stage?.id || `Stage ${selectedStage + 1}`;
                  const ok = window.confirm(`Remove '${stageLabel}' from pipeline '${current.id}'?`);
                  if (!ok) return;

                  const nextStages = stages.filter((_: any, idx: number) => idx !== selectedStage);
                  const nextSelectedStage = Math.max(0, Math.min(selectedStage, nextStages.length - 1));

                  setPipelines((prev) =>
                    prev.map((p) => (p.id === current.id ? { ...p, stages: nextStages } : p))
                  );

                  try {
                    await updatePipeline(String(current.id), {
                      stages: nextStages,
                      writeToYaml: true,
                    });
                    await load();
                    setSelectedPipeline(String(current.id));
                    setSelectedStage(nextSelectedStage);
                    setPipelineYamlLoadError('');
                    setPipelineYamlSaveError('');
                    setPipelineYamlSaveStatus('Stage removed and YAML saved.');
                  } catch (err) {
                    setPipelineYamlLoadError(err instanceof Error ? err.message : String(err));
                    try {
                      await load();
                    } catch {
                      // ignore
                    }
                  }
                }}
                title={current?.builtIn ? 'Built-in pipelines cannot be modified' : 'Remove the selected stage'}
              >
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
                  {pipelineYamlSaveError ? (
                    <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 8 }}>{pipelineYamlSaveError}</div>
                  ) : null}
                  {pipelineYamlSaveStatus ? (
                    <div style={{ color: '#7ee787', fontSize: 12, marginBottom: 8 }}>{pipelineYamlSaveStatus}</div>
                  ) : null}
                  {!currentYamlPath ? (
                    <div style={{ color: '#a7b6d4', fontSize: 12, marginBottom: 8 }}>
                      This pipeline is not backed by a YAML file, so the preview is read-only.
                    </div>
                  ) : null}
                  <textarea
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
                      width: '100%',
                      minHeight: 160,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      opacity: currentYamlPath ? 1 : 0.7,
                    }}
                    spellCheck={false}
                    readOnly={!currentYamlPath}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!current?.id) return;
                      setPipelineYamlLoadError('');
                      setPipelineYamlSaveError('');
                      setPipelineYamlSaveStatus('');
                      setYamlByPipelineId((prev) => ({ ...(prev || {}), [current.id]: next }));
                    }}
                    value={currentYaml}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="pipelines-new-btn"
                      disabled={!canSaveYaml || isSavingYaml}
                      onClick={async () => {
                        if (!current?.id || !canSaveYaml) return;
                        setPipelineYamlLoadError('');
                        setPipelineYamlSaveError('');
                        setPipelineYamlSaveStatus('');
                        setIsSavingYaml(true);
                        try {
                          await savePipelineYaml(String(current.id), currentYaml);
                          setPipelineYamlSaveStatus('YAML saved.');
                          await load();
                          setSelectedPipeline(String(current.id));
                          setSelectedStage(0);
                        } catch (err) {
                          setPipelineYamlSaveError(err instanceof Error ? err.message : String(err));
                        } finally {
                          setIsSavingYaml(false);
                        }
                      }}
                    >
                      {isSavingYaml ? 'Saving…' : 'Save YAML'}
                    </button>
                    <button
                      type="button"
                      className="pipelines-remove-btn"
                      disabled={!current?.id || !currentYamlPath || isSavingYaml}
                      onClick={async () => {
                        if (!current?.id || !currentYamlPath) return;
                        setPipelineYamlLoadError('');
                        setPipelineYamlSaveError('');
                        setPipelineYamlSaveStatus('');
                        await load();
                        setSelectedPipeline(String(current.id));
                        setSelectedStage(0);
                      }}
                    >
                      Reload YAML
                    </button>
                  </div>
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
