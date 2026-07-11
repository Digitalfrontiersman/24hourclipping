// AI ADAPTER — streams from the demo backend (Emergent LLM key).
// Swap the base URL / auth here to connect a production AI service.
import { API } from "./api";
import { api } from "./api";

export const aiAdapter = {
  getHistory: (sessionId) => api.get(`/ai/history/${sessionId}`).then((r) => r.data),
  generateBrief: (sessionId) => api.post("/ai/brief", { session_id: sessionId }).then((r) => r.data),

  async streamChat(sessionId, message, onDelta) {
    const res = await fetch(`${API}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message }),
    });
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
