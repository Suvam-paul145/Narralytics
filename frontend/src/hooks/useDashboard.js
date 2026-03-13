import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function useDashboard() {
  const [confirmed, setConfirmed] = useState([]);
  const [pending, setPending]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const { token } = useAuth();

  const submitQuery = async (prompt) => {
    setLoading(true);
    setError(null);
    setPending(null);

    try {
      // Basic history: just the prompts/titles from confirmed charts for now
      const history = confirmed.map(c => ({ role: 'user', content: c.spec.title }));
      
      const res = await axios.post(
        `${API_BASE}/query`,
        { prompt, history },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.cannot_answer) {
        setError(res.data.reason || "I couldn't generate a chart for that question.");
      } else {
        setPending(res.data);
      }
    } catch (err) {
      setError("Failed to connect to the visualization engine.");
    } finally {
      setLoading(false);
    }
  };

  const selectChart = (option) => {
    setConfirmed(prev => [option, ...prev]);
    setPending(null);
  };

  const dismissPending = () => setPending(null);

  const askAboutChart = (item, setMode, sendMessage) => {
    setMode("chat");
    sendMessage(`Analyze this: ${item.spec.title}. ${item.spec.insight}`);
  };

  return { confirmed, pending, loading, error, submitQuery, selectChart, dismissPending, askAboutChart };
}
