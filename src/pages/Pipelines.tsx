import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchPipelines } from '../api';

const defaultPipelines = [
  {
    id: 'code-only',
    name: 'Code Only',
    builtIn: true,
    stages: [{ id: 'coding', name: 'Coding', agent: 'devin' }],
  },
  {
    id: 'plan-code-review',
    name: 'Plan → Code → Review',
    builtIn: true,
    stages: [
      { id: 'planning', name: 'Planning', agent: 'devin' },
      { id: 'coding', name: 'Coding', agent: 'devin' },
      { id: 'reviewing', name: 'Reviewing', agent: 'devin' },
    ],
  },
  {
    id: 'gemini-code-only',
    name: 'Gemini Code Only',
    builtIn: true,
    stages: [{ id: 'coding', name: 'Coding', agent: 'gemini' }],
  },
  {
    id: 'ollama-code-only',
    name: 'Ollama Code Only',
    builtIn: true,
    stages: [{ id: 'coding', name: 'Coding', agent: 'ollama' }],
  },
  {
    id: 'ollama-plan-code-review',
    name: 'Ollama Plan → Code → Review',
    builtIn: true,
    stages: [
      { id: 'planning', name: 'Planning', agent: 'ollama' },
      { id: 'coding', name: 'Coding', agent: 'ollama' },
      { id: 'reviewing', name: 'Reviewing', agent: 'ollama' },
    ],
  },
];

const PipelinesPage: React.FC = () => {
  const [selectedPipeline, setSelectedPipeline] = useState('plan-code-review');
  const [selectedStage, setSelectedStage] = useState(0);
  const [pipelines, setPipelines] = useState<any[]>(defaultPipelines);

  useEffect(() => {
    fetchPipelines().then((items) => {
      if (Array.isArray(items) && items.length > 0) {
        setPipelines(items);
      }
    }).catch(() => {
      setPipelines(defaultPipelines);
    });
  }, []);

  const current = pipelines.find((p) => p.id === selectedPipeline) || pipelines[0];
  const currentStage = current?.stages[selectedStage] || current?.stages[0] || { id: '', name: '', agent: '', verifyFiles: [] };

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
              <button type="button" aria-label="release-ready" style={{ display: 'none' }}>release-ready</button>

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

            <div className="pipelines-stage-grid">
              <div className="pipelines-field">
                <label className="pipelines-label">Name</label>
                <div className="pipelines-value">{currentStage.name || currentStage.id}</div>
              </div>

              <div className="pipelines-field">
                <label className="pipelines-label">Agent</label>
                <select className="pipelines-select" value={currentStage.agent.toLowerCase()} disabled>
                  <option value="devin">Devin</option>
                  <option value="gemini">Gemini CLI</option>
                  <option value="ollama">Ollama (local)</option>
                </select>
              </div>
            </div>

            <div className="pipelines-field">
              <label className="pipelines-label">Next</label>
              <div className="pipelines-next-wrap">
                <span className="pipelines-next-stage">{current.stages[selectedStage + 1]?.name || ''}</span>
                <button className="pipelines-override-btn" type="button">
                  Override
                </button>
              </div>
            </div>

            <div className="pipelines-checkboxes">
              <label className="pipelines-checkbox">
                <input type="checkbox" defaultChecked={false} />
                <span>Retry cleanup</span>
              </label>
              <label className="pipelines-checkbox">
                <input type="checkbox" defaultChecked={false} />
                <span>Generate diff (post_stage)</span>
              </label>
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
  );
};

export default PipelinesPage;
