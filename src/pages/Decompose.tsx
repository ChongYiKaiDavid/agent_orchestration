import React, { useState } from 'react';

const Decompose: React.FC = () => {
  const [epicDescription, setEpicDescription] = useState('');

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
        <h2 className="decompose-drafts-title">Drafts</h2>
        <div className="decompose-empty-state">No drafts yet. Start a decomposition above.</div>
      </div>
    </div>
  );
};

export default Decompose;
