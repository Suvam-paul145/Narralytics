import React from 'react';
import HealthStatus from '../components/common/HealthStatus';
import { useHealthCheck } from '../hooks/useHealthCheck';

const SystemStatus = () => {
  const { healthStatus, isChecking, checkHealth } = useHealthCheck(10000); // Check every 10 seconds

  const handleManualCheck = () => {
    checkHealth();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Status</h1>
          <p className="mt-2 text-gray-600">
            Monitor the health and connectivity of all system components
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Health Status */}
          <div className="lg:col-span-2">
            <HealthStatus showDetails={true} />
          </div>

          {/* Manual Check Button */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Manual Health Check</h3>
            <button
              onClick={handleManualCheck}
              disabled={isChecking}
              className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                isChecking
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isChecking ? 'Checking...' : 'Run Health Check'}
            </button>
          </div>

          {/* System Information */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">System Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Frontend Version:</span>
                <span className="text-sm font-medium">2.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">API Version:</span>
                <span className="text-sm font-medium">2.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Health Check Interval:</span>
                <span className="text-sm font-medium">10 seconds</span>
              </div>
              {healthStatus.timestamp && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Server Time:</span>
                  <span className="text-sm font-medium">
                    {new Date(healthStatus.timestamp).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status History or Logs could be added here */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Connection Details</h3>
          <div className="bg-gray-50 rounded-md p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(healthStatus, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus;