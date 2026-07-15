import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPipelineTemplate, deletePipeline, fetchAgents, fetchPipelines } from '../api';

type CreatePipelineFormState = {
  id: string;
  name: string;
  description: string;
  stageAgentId: string;
  stageSummary: string;
};

const EMPTY_FORM: CreatePipelineFormState = {
  id: 'unique-pipeline-id',
  name: '',
  description: '',
  stageAgentId: '',
  stageSummary: 'Describe what this stage does',
};

const PipelinesPage: React.FC = () => {
  const [selectedPipeline, setSelectedPipeline] = useState('plan-code-review');
  const [selectedStage, setSelectedStage] = useState(0);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [yamlByPipelineId, setYamlByPipelineId] = useState<Record<string, string>>({});
  const [yamlPathByPipelineId, setYamlPathByPipelineId] = useState<Record<string, string | null>>({});
  const [pipelineYamlLoadError, setPipelineYamlLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPipeline, setIsCreatingPipeline] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [pipelineCreateError, setPipelineCreateError] = useState('');
  const [lastRunTaskId, setLastRunTaskId] = useState('');
  const [createForm, setCreateForm] = useState<CreatePipelineFormState>(EMPTY_FORM);
  const [createStageNumberOverride, setCreateStageNumberOverride] = useState<number | null>(null);


  const loadPipelines = async () => {
    setIsLoading(true);
    setPipelineYamlLoadError('');
    try {
      const items = await fetchPipelines();
      const nextPipelines = Array.isArray(items) ? items : [];
      setPipelines(nextPipelines);

      const nextById: Record<string, string> = {};
      const nextYamlPaths: Record<string, string | null> = {};
      for (const pipeline of nextPipelines) {
        if (!pipeline?.id) continue;
        if (typeof pipeline.rawYaml === 'string') nextById[pipeline.id] = pipeline.rawYaml;
        else if (typeof pipeline.yaml === 'string') nextById[pipeline.id] = pipeline.yaml;
        else if (typeof pipeline.definitionYaml === 'string') nextById[pipeline.id] = pipeline.definitionYaml;
        nextYamlPaths[pipeline.id] = typeof pipeline.yamlPath === 'string' ? pipeline.yamlPath : null;
      }
      setYamlByPipelineId(nextById);
      setYamlPathByPipelineId(nextYamlPaths);
    } catch (error) {
      setPipelineYamlLoadError(error instanceof Error ? error.message : String(error));
      setPipelines([]);
      setYamlByPipelineId({});
      setYamlPathByPipelineId({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPipelines();
    fetchAgents()
      .then((items) => setAgents(Array.isArray(items) ? items : []))
      .catch(() => setAgents([]));
  }, []);

  const current = pipelines.find((pipeline) => pipeline.id === selectedPipeline) || pipelines[0] || null;
  const currentStages = Array.isArray((current as any)?.stages) ? (current as any).stages : [];
  const currentStage = currentStages[selectedStage] || currentStages[0] || { id: '', name: '', agent: '', summary: '' };
  const currentYaml = current?.id ? yamlByPipelineId[current.id] || '' : '';
  const currentYamlPath = current?.id ? yamlPathByPipelineId[current.id] || null : null;

  // Stage Agent dropdown should list all configured agents.
  const stage1AgentChoices = agents;
  const stage1AgentDefaultId = stage1AgentChoices[0]?.id || agents[0]?.id || '';

  // Determine the stage number displayed in the modal:
  // - If the user is creating a brand new pipeline: always show Stage 1.
  // - Otherwise: show the next stage after the selected stage index.
  const createStageNumber = createStageNumberOverride ?? (isCreateModalOpen ? 1 : 1);

  const openCreateModal = () => {
    setPipelineCreateError('');
    setCreateStageNumberOverride(1);
    setCreateForm({

      id: 'unique-pipeline-id',
      name: '',
      description: '',
      stageAgentId: stage1AgentDefaultId,
      stageSummary: 'Describe what this stage does',
    });
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setPipelineCreateError('');
    setIsCreatingPipeline(false);
    setCreateStageNumberOverride(null);
  };

  const handleCreatePipeline = async () => {
    setPipelineCreateError('');
    setIsCreatingPipeline(true);

    try {
      const pipelineId = createForm.id.trim();
      if (!pipelineId) {
        setPipelineCreateError('Please enter a pipeline id.');
        return;
      }

      const pipelineName = createForm.name.trim();
      if (!pipelineName) {
        setPipelineCreateError('Please enter a pipeline display name.');
        return;
      }

      if (pipelines.some((pipeline) => String(pipeline?.name || '').trim().toLowerCase() === pipelineName.toLowerCase())) {
        setPipelineCreateError(`Pipeline name '${pipelineName}' is already taken. Please choose another name.`);
        return;
      }

      const selectedAgent = stage1AgentChoices.find((agent) => agent.id === createForm.stageAgentId)
        || agents.find((agent) => agent.id === createForm.stageAgentId)
        || null;
      if (!selectedAgent?.id) {
        setPipelineCreateError('Please choose a valid agent for the first stage.');
        return;
      }

      const firstStageSummary = createForm.stageSummary.trim();
      if (!firstStageSummary) {
        setPipelineCreateError('Please enter a stage summary for the first stage.');
        return;
      }

      const firstStageAgentSkills = Array.isArray(selectedAgent.skills) ? selectedAgent.skills : [];
      const firstStageSkillsText = firstStageAgentSkills.join(' ').toLowerCase();
      const stageKind = firstStageSkillsText.includes('review') || firstStageSkillsText.includes('reviewer')
        ? 'reviewing'
        : firstStageSkillsText.includes('code') || firstStageSkillsText.includes('coder')
          ? 'coding'
          : 'planning';

      const stageKindToStageName: Record<string, string> = {
        planning: 'Planning',
        coding: 'Coding',
        reviewing: 'Reviewing',
      };

      const template = {
        id: pipelineId,
        name: pipelineName,
        description: createForm.description.trim(),
        stages: [
          {
            id: 'stage-1',
            name: stageKindToStageName[stageKind] || 'Planning',
            agent: selectedAgent.id,
            summary: firstStageSummary,
          },
        ],
      };

      await createPipelineTemplate({ pipeline: template });
      await loadPipelines();
      setSelectedPipeline(pipelineId);
      setSelectedStage(0);
      setLastRunTaskId('');
      setIsCreateModalOpen(false);
    } catch (error) {
      setPipelineCreateError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingPipeline(false);
    }
  };

  const handleDeletePipeline = async () => {
    if (!current?.id || current?.builtIn) return;

    const deletedId = String(current.id);
    const ok = window.confirm(`Delete pipeline '${deletedId}'? This will remove server/pipelines/${deletedId}.yaml`);
    if (!ok) return;

    try {
      await deletePipeline(deletedId);
      await loadPipelines();
      setSelectedPipeline('');
      setSelectedStage(0);
    } catch (error) {
      setPipelineYamlLoadError(error instanceof Error ? error.message : String(error));
    }
  };

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
          onClick={openCreateModal}
          disabled={isCreatingPipeline}
          aria-label="create-pipeline"
          title="Create a pipeline from scratch"
        >
          {isCreatingPipeline ? 'Creating…' : '+ Create Pipeline'}
        </button>
      </div>

      {isCreateModalOpen && (
        <div className="pipelines-create-overlay" role="presentation" onClick={closeCreateModal}>
          <div
            className="pipelines-create-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create pipeline"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pipelines-create-header">
              <h2 className="pipelines-create-title">Create Pipeline</h2>
              <button type="button" className="pipelines-create-close" onClick={closeCreateModal} aria-label="Close create pipeline dialog">
                <X size={16} />
              </button>
            </div>

            {pipelineCreateError ? <div className="pipelines-create-error">{pipelineCreateError}</div> : null}

            <div className="pipelines-create-grid">
              {/* Create pipeline stage numbers are based on the stage diagram selection.
                  For a brand-new pipeline (no selection), show Stage 1. */}
              <label className="pipelines-create-field">
                <span className="pipelines-create-label">Pipeline ID</span>
                <input
                  className="pipelines-create-input"
                  value={createForm.id}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, id: event.target.value }))}
                  placeholder="unique-pipeline-id"
                />
              </label>

              <label className="pipelines-create-field">
                <span className="pipelines-create-label">Display Name</span>
                <input
                  className="pipelines-create-input"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="My Pipeline"
                />
              </label>

              <label className="pipelines-create-field pipelines-create-field--full">
                <span className="pipelines-create-label">Description</span>
                <textarea
                  className="pipelines-create-textarea"
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Optional pipeline description"
                  rows={3}
                />
              </label>

              <label className="pipelines-create-field">
                  <span className="pipelines-create-label">Stage {createStageNumber} Agent</span>
                  <select
                  className="pipelines-select pipelines-create-input"
                  value={createForm.stageAgentId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, stageAgentId: event.target.value }))}
                >
                  <option value="" disabled>
                    Select an agent
                  </option>
                  {stage1AgentChoices.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.displayName || agent.label || agent.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pipelines-create-field pipelines-create-field--full">
                  <span className="pipelines-create-label">Stage {createStageNumber} Summary</span>
                <textarea
                  className="pipelines-create-textarea"
                  value={createForm.stageSummary}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, stageSummary: event.target.value }))}
                  placeholder="Describe what the first stage does"
                  rows={4}
                />
              </label>
            </div>

            <div className="pipelines-create-actions">
              <button type="button" className="pipelines-create-secondary" onClick={closeCreateModal} disabled={isCreatingPipeline}>
                Cancel
              </button>
              <button type="button" className="pipelines-new-btn" onClick={handleCreatePipeline} disabled={isCreatingPipeline}>
                {isCreatingPipeline ? 'Creating…' : 'Create Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              onClick={handleDeletePipeline}
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

            {pipelineYamlLoadError ? (
              <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 6, marginBottom: 8 }}>{pipelineYamlLoadError}</div>
            ) : null}

            {lastRunTaskId ? (
              <div style={{ color: '#7ee787', fontSize: 12, marginTop: 6, marginBottom: 8 }}>Last run task id: {lastRunTaskId}</div>
            ) : null}

            <button type="button" aria-label="release-ready" style={{ display: 'none' }}>
              release-ready
            </button>

            <div className="pipelines-stages-diagram">
              {currentStages.map((stage: any, idx: number) => (
                <React.Fragment key={stage.id || stage.name || idx}>
                  <button
                    type="button"
                    className={`pipelines-stage-box ${selectedStage === idx ? 'active' : ''}`}
                    onClick={() => setSelectedStage(idx)}
                  >
                    {stage.name || stage.id}
                  </button>
                  <span className="pipelines-stage-arrow">−</span>
                </React.Fragment>
              ))}

              <button
                type="button"
                className="pipelines-stage-box pipelines-add-stage"
                onClick={() => {
                  // Reuse the create-pipeline modal behavior by pre-filling a default stage-1 form.
                  // A dedicated “add stage” modal can be implemented later.
                  setPipelineCreateError('');
                  setCreateStageNumberOverride(currentStages.length + 1);
                  setCreateForm((prev) => ({

                    ...prev,
                    id: current?.id ? String(current.id) : prev.id,
                    name: current?.name ? String(current.name) : prev.name,
                    stageAgentId: agents[0]?.id || prev.stageAgentId,
                    stageSummary: 'Describe what this stage does',
                  }));
                  setIsCreateModalOpen(true);
                }}
                aria-label="add-stage"
                title="Add another stage"
              >
                Add stage
              </button>
            </div>
          </div>

          <div className="pipelines-stage-detail">
            <div className="pipelines-stage-header">
              <h3 className="pipelines-stage-title">Stage {selectedStage + 1} Details</h3>
            </div>

            <div className="pipelines-stage-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="pipelines-field">
                <label className="pipelines-label">Name</label>
                <div className="pipelines-value">{currentStage.name || currentStage.id}</div>
              </div>

              <div className="pipelines-field">
                <label className="pipelines-label">Agent</label>
                <div className="pipelines-value">
                  {(() => {
                    const agent = agents.find((item) => item.id === currentStage.agent);
                    return agent?.displayName || currentStage.agent || 'devin';
                  })()}
                </div>
              </div>

              <div className="pipelines-field">
                <label className="pipelines-label">Summary</label>
                <div className="pipelines-value">{currentStage.summary || 'No summary provided.'}</div>
              </div>

              <div className="pipelines-field">
                <label className="pipelines-label">YAML Preview</label>
                {!currentYamlPath ? (
                  <div style={{ color: '#a7b6d4', fontSize: 12, marginBottom: 8 }}>This pipeline is not backed by a YAML file, so the preview is read-only.</div>
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
                    fontFamily: 'monospace',
                  }}
                  value={currentYaml}
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelinesPage;
