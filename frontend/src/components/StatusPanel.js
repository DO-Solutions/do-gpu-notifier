import React, { useState } from 'react';

function StatusPanel({ availabilityStatus, gpuTypes }) {
  const [expandedResult, setExpandedResult] = useState(null);
  
  if (!availabilityStatus) {
    return <p>Loading status information...</p>;
  }
  
  const { lastCheck, results, isChecking, error, nextCheckAt } = availabilityStatus;
  
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const getGpuName = (gpuTypeId) => {
    const gpuType = gpuTypes.find(t => t.id === gpuTypeId);
    return gpuType ? gpuType.name : gpuTypeId;
  };
  
  const getStatusBadge = (result) => {
    if (!result) {
      return <span className="status-badge unknown">Unknown</span>;
    }
    
    if (result.available) {
      return <span className="status-badge available">Available</span>;
    }
    
    return <span className="status-badge unavailable">Unavailable</span>;
  };
  
  const toggleExpandResult = (gpuTypeId) => {
    if (expandedResult === gpuTypeId) {
      setExpandedResult(null);
    } else {
      setExpandedResult(gpuTypeId);
    }
  };
  
  const renderRegionDetails = (result) => {
    if (!result?.details?.regions || !Array.isArray(result.details.regions)) {
      return null;
    }
    
    return (
      <div style={{ marginTop: '10px', fontSize: '0.9em' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Region Details</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #eee' }}>Region</th>
              <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #eee' }}>Capacity</th>
            </tr>
          </thead>
          <tbody>
            {result.details.regions.map((region, index) => (
              <tr key={index}>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
                  {region.region}
                </td>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
                  <span className={`status-badge ${getCapacityClass(region.capacity)}`}>
                    {region.capacity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  const getCapacityClass = (capacity) => {
    if (!capacity) return 'unknown';
    
    switch (capacity.toUpperCase()) {
      case 'HIGH':
        return 'available';
      case 'MEDIUM':
        return 'available';
      case 'LOW':
        return 'unavailable';
      case 'NONE':
        return 'unavailable';
      default:
        return 'unknown';
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '15px' }}>
        <p><strong>Last check:</strong> {formatDateTime(lastCheck)}</p>
        <p><strong>Next check:</strong> {formatDateTime(nextCheckAt)}</p>
        {isChecking && <p><em>Currently checking...</em></p>}
        {error && <p className="text-danger">Error: {error}</p>}
      </div>
      
      <h3>GPU Status</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>GPU Type</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>Status</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>Message</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(results).map(([gpuTypeId, result]) => (
            <React.Fragment key={gpuTypeId}>
              <tr>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {getGpuName(gpuTypeId)}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {getStatusBadge(result)}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {result?.message || 'No information available'}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {result?.details?.regions && (
                    <button
                      className="button button-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.8em' }}
                      onClick={() => toggleExpandResult(gpuTypeId)}
                    >
                      {expandedResult === gpuTypeId ? 'Hide Details' : 'Show Regions'}
                    </button>
                  )}
                </td>
              </tr>
              {expandedResult === gpuTypeId && (
                <tr>
                  <td colSpan="4" style={{ padding: '0 8px 16px 8px', backgroundColor: '#f9f9f9' }}>
                    {renderRegionDetails(result)}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StatusPanel;

