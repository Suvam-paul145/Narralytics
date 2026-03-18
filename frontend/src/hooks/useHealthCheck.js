import { useState, useEffect, useCallback, useRef } from 'react';
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
  const lastLoggedErrorRef = useRef(null);

  const createTimeoutSignal = (timeoutMs) => {
    // AbortSignal.timeout is not available in all browsers/environments.
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(timeoutMs);
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  };

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const healthEndpoints = [API_ENDPOINTS.HEALTH, API_ENDPOINTS.BASIC_HEALTH].filter(Boolean);
      let data = null;
      let lastError = null;

      for (const endpoint of healthEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            // Avoid custom headers to prevent CORS preflight on health checks
            signal: createTimeoutSignal(10000)
          });
          if (!response.ok) {
            throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
          }
          data = await response.json();
          break;
        } catch (endpointError) {
          lastError = endpointError;
        }
      }

      if (!data) {
        throw lastError || new Error('Health check failed');
      }

      const normalizedData = {
        ...data,
        status: normalizeStatus(data?.status === 'ok' ? 'healthy' : data.status),
        services: {
          ...data.services,
          api: normalizeStatus(data?.services?.api || data?.status),
          database: normalizeStatus(data?.services?.database),
        },
      };

      lastLoggedErrorRef.current = null;
      setHealthStatus({
        ...normalizedData,
        lastChecked: new Date().toISOString(),
        error: null
      });
    } catch (error) {
      const errorMessage = error?.name === 'AbortError' ? 'Health check timed out' : (error?.message || 'Health check failed');
      if (lastLoggedErrorRef.current !== errorMessage) {
        console.warn('Health check warning:', errorMessage);
        lastLoggedErrorRef.current = errorMessage;
      }
      setHealthStatus({
        status: 'unhealthy',
        services: {
          api: 'error',
          database: 'unknown'
        },
        lastChecked: new Date().toISOString(),
        error: errorMessage
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
