import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.js';

export const useHealth = () => {
  const [apiHealth, setApiHealth] = useState({ status: 'checking', data: null, error: null });
  const [dbHealth, setDbHealth] = useState({ status: 'checking', data: null, error: null });
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);

    try {
      const res = await api.health.getHealth();
      setApiHealth({ status: 'ok', data: res, error: null });
    } catch (err) {
      setApiHealth({ status: 'error', data: err.data || null, error: err.message });
    }

    try {
      const res = await api.health.getDbHealth();
      setDbHealth({ status: 'ok', data: res, error: null });
    } catch (err) {
      setDbHealth({ status: 'error', data: err.data || null, error: err.message });
    }

    setLastChecked(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return {
    apiHealth,
    dbHealth,
    loading,
    lastChecked,
    refetch: checkHealth
  };
};

export default useHealth;
