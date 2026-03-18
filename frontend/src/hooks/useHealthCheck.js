import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';

const normalizeStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'limited') return 'degraded';
  return value || 'unknown';
};

export const useHealthCheck = (intervalMs = 30000) => {
  const [healthStatus, setHealthStatus] = useState({
    status: 'unknown',
    services: {
      api: 'unknown',
      database: 'unknown'
    },
    lastChecked: null,
    error: null
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();
        const normalizedData = {
          ...data,
          status: normalizeStatus(data.status),
          services: {
            ...data.services,
            api: normalizeStatus(data?.services?.api),
            database: normalizeStatus(data?.services?.database),
          },
        };
        setHealthStatus({
          ...normalizedData,
          lastChecked: new Date().toISOString(),
          error: null
        });
      } else {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Health check error:', error);
      setHealthStatus({
        status: 'unhealthy',
        services: {
          api: 'error',
          database: 'unknown'
        },
        lastChecked: new Date().toISOString(),
        error: error.message
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Initial health check
    checkHealth();

    // Set up periodic health checks
    const interval = setInterval(checkHealth, intervalMs);

    return () => clearInterval(interval);
  }, [checkHealth, intervalMs]);

  return {
    healthStatus,
    isChecking,
    checkHealth
  };
};
