import React from 'react';
import { useHealthCheck } from '../../hooks/useHealthCheck';

const HealthStatus = ({ showDetails = false, className = '' }) => {
  const { healthStatus, isChecking } = useHealthCheck();

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'unhealthy':
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return '●';
      case 'degraded':
        return '◐';
      case 'unhealthy':
      case 'error':
        return '●';
      default:
        return '○';
    }
  };

  if (!showDetails) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className={`${getStatusColor(healthStatus.status)} text-sm`}>
          {getStatusIcon(healthStatus.status)}
        </span>
        <span className="text-sm text-gray-600">
          {isChecking ? 'Checking...' : healthStatus.status}
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">System Status</h3>
        <div className={`flex items-center space-x-2 ${getStatusColor(healthStatus.status)}`}>
          <span>{getStatusIcon(healthStatus.status)}</span>
          <span className="font-medium capitalize">{healthStatus.status}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">API Server:</span>
          <span className={`text-sm font-medium ${getStatusColor(healthStatus.services.api)}`}>
            {healthStatus.services.api}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Database:</span>
          <span className={`text-sm font-medium ${getStatusColor(healthStatus.services.database)}`}>
            {healthStatus.services.database}
          </span>
        </div>
        
        {healthStatus.lastChecked && (
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-xs text-gray-500">Last checked:</span>
            <span className="text-xs text-gray-500">
              {new Date(healthStatus.lastChecked).toLocaleTimeString()}
            </span>
          </div>
        )}
        
        {healthStatus.error && (
          <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
            Error: {healthStatus.error}
          </div>
        )}
        
        {isChecking && (
          <div className="text-xs text-gray-500 italic">
            Checking system status...
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthStatus;