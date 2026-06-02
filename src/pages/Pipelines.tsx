import React, { useState } from 'react';
import { X } from 'lucide-react';

const PipelinesPage: React.FC = () => {
  const [selectedPipeline, setSelectedPipeline] = useState('plan-code-review');
  const [selectedStage, setSelectedStage] = useState(0);

  const pipelines = [
    {
      id: 'code-only',
      displayName: 'Code Only',
      builtIn: true,
      stages: ['coding'],
    },
    {
      id: 'plan-code-review',
      displayName: 'Plan → Code → Review',
      builtIn: true,
      stages: ['planning', 'coding', 'reviewing'],
    },
    {
      id: 'release-ready',
      displayName: 'Plan → Code → Review → Merge',
      builtIn: false,
      stages: ['planning', 'coding', 'reviewing', 'merging'],
    },
  ];

  const stageDetails = {
    planning: {
      name: 'planning',
      agent: 'Planner',
      next: 'coding',
      override: false,
      retryCleanup: false,
      generateDiff: false,
      verifyFiles: ['planner.requirements.md', 'planner.design.md'],
    },
    coding: {
      name: 'coding',
      agent: 'Code Executor',
      next: 'reviewing',
      override: false,
      retryCleanup: false,
      generateDiff: false,
      verifyFiles: [],
    },
    reviewing: {
      name: 'reviewing',
      agent: 'Reviewer',
      next: '',
      override: false,
      retryCleanup: false,
      generateDiff: false,
      verifyFiles: [],
    },
    merging: {
      name: 'merging',
      agent: 'Shipper',
      next: '',
      override: false,
      retryCleanup: false,
      generateDiff: false,
      verifyFiles: ['reviewer.review.md', 'delivery.summary.md'],
    },
  };

  const current = pipelines.find((p) => p.id === selectedPipeline) || pipelines[0];
  const currentStage = stageDetails[current.stages[selectedStage] as keyof typeof stageDetails];

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
                <div className="pipelines-list-name">{pipeline.displayName}</div>
                <div className="pipelines-list-stages">
                  {pipeline.stages.length} stage{pipeline.stages.length !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="pipelines-detail">
          <div className="pipelines-detail-field">
            <span className="pipelines-detail-label">Name</span>
            <div className="pipelines-detail-value">{current.id}</div>
          </div>

          <div className="pipelines-detail-field">
            <span className="pipelines-detail-label">Display Name</span>
            <div className="pipelines-detail-value">{current.displayName}</div>
          </div>

          <div className="pipelines-stages-section">
            <div className="pipelines-detail-label">Stages</div>
            <div className="pipelines-stages-diagram">
              {current.stages.map((stage, idx) => (
                <React.Fragment key={stage}>
                  <button
                    type="button"
                    className={`pipelines-stage-box ${selectedStage === idx ? 'active' : ''}`}
                    onClick={() => setSelectedStage(idx)}
                  >
                    {stage}
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
                <div className="pipelines-value">{currentStage.name}</div>
              </div>

              <div className="pipelines-field">
                <label className="pipelines-label">Agent</label>
                <select className="pipelines-select">
                  <option>{currentStage.agent}</option>
                </select>
              </div>
            </div>

            <div className="pipelines-field">
              <label className="pipelines-label">Next</label>
              <div className="pipelines-next-wrap">
                <span className="pipelines-next-stage">{currentStage.next}</span>
                <button className="pipelines-override-btn" type="button">
                  Override
                </button>
              </div>
            </div>

            <div className="pipelines-checkboxes">
              <label className="pipelines-checkbox">
                <input type="checkbox" defaultChecked={currentStage.retryCleanup} />
                <span>Retry cleanup</span>
              </label>
              <label className="pipelines-checkbox">
                <input type="checkbox" defaultChecked={currentStage.generateDiff} />
                <span>Generate diff (post_stage)</span>
              </label>
            </div>

            {currentStage.verifyFiles.length > 0 && (
              <div className="pipelines-field">
                <label className="pipelines-label">Verify (file_exists_checks)</label>
                <div className="pipelines-verify-list">
                  {currentStage.verifyFiles.map((file) => (
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
