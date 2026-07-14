// AI ADAPTER - streams from the backend OpenAI concierge.
import { API, getToken } from "./api";
import { api } from "./api";

export const aiAdapter = {
  getHistory: (sessionId) => api.get(`/ai/history/${sessionId}`).then((r) => r.data),
  generateBrief: (sessionId) => api.post("/ai/brief", { session_id: sessionId }).then((r) => r.data),

  async streamChat(sessionId, message, onDelta) {
    const token = getToken();
    const res = await fetch(`${API}/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ session_id: sessionId, message }),
    });
    if (!res.ok || !res.body) {
      let detail = `The concierge is unavailable (${res.status}).`;
      try { const j = await res.json(); if (j.detail) detail = j.detail; } catch { /* non-JSON */ }
      throw new Error(detail);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") return;
        try {
          const obj = JSON.parse(payload);
          if (obj.delta) onDelta(obj.delta);
          if (obj.error) throw new Error(obj.error);
        } catch (e) {
          if (e.message && !e.message.includes("JSON")) throw e;
        }
      }
    }
  },
};
