import React from 'react';

function GpuSelector({ gpuTypes, selectedGpuTypes, onChange, disabled }) {
  return (
    <ul className="checkbox-list">
      {gpuTypes.map((gpuType) => (
        <li key={gpuType.id} className="checkbox-item">
          <input
            type="checkbox"
            id={`gpu-${gpuType.id}`}
            checked={selectedGpuTypes.includes(gpuType.id)}
            onChange={(e) => onChange(gpuType.id, e.target.checked)}
            disabled={disabled}
          />
          <label htmlFor={`gpu-${gpuType.id}`}>
            {gpuType.name} ({gpuType.size})
          </label>
        </li>
      ))}
    </ul>
  );
}

export default GpuSelector;

