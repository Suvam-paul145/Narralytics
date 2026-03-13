import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const { token } = useAuth();

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build history from current messages
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const res = await axios.post(
        `${API_BASE}/chat`,
        { message: text, history },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { answer, cannot_answer } = res.data;
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: answer,
        cannot_answer
      }]);
    } catch (err) {
      console.error("Chat API error:", err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm sorry, I encountered an error connecting to the business analyst service. Please check your connection and try again.",
        cannot_answer: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  return { messages, loading, sendMessage, clearChat };
}
