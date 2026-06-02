import React, { useState } from 'react';

const Decompose: React.FC = () => {
  const [epicDescription, setEpicDescription] = useState('');
  
  const drafts = [
    { id: '1', title: 'Release notes generator', tasks: '3 tasks', updated: '5m ago' },
    { id: '2', title: 'Automated review follow-up', tasks: '4 tasks', updated: '18m ago' },
    { id: '3', title: 'Merge readiness checklist', tasks: '2 tasks', updated: '1h ago' },
  ];

  return (
    <div className="decompose-page">
      <h1 className="decompose-title">Decompose</h1>

      <div className="decompose-form">
        <label className="decompose-field">
          <span className="decompose-label">Epic Description</span>
          <textarea
            className="decompose-textarea"
            placeholder="Describe the feature or epic..."
            rows={5}
            value={epicDescription}
            onChange={(event) => setEpicDescription(event.target.value)}
          />
        </label>

        <button className="decompose-submit" type="button">
          Decompose
        </button>
      </div>
      <div className="decompose-drafts">
        <h3 className="decompose-drafts-title">Drafts</h3>
        <div style={{display:'grid',gap:12}}>
          {drafts.map((d) => (
            <div key={d.id} className="card">
              <div style={{fontWeight:800}}>{d.title}</div>
              <div style={{marginTop:6,color:'rgba(243,244,246,0.65)'}}>{d.tasks} · {d.updated}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Decompose;
