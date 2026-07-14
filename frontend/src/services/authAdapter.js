// REAL AUTH ADAPTER - talks to the FastAPI auth endpoints and stores the JWT.
import { api, setToken, clearToken, getToken } from "./api";

export const authAdapter = {
  async register({ email, password, name, role }) {
    const { data } = await api.post("/auth/register", { email, password, name, role });
    setToken(data.access_token);
    return data.user;
  },
  async login({ email, password }) {
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.access_token);
    return data.user;
  },
  async google({ credential, role }) {
    const { data } = await api.post("/auth/google", { credential, role });
    setToken(data.access_token);
    return data.user;
  },
  async demo(role) {
    const { data } = await api.post("/auth/demo", { role });
    setToken(data.access_token);
    return data.user;
  },
  // Flip the active dashboard mode for a multi-role account (no re-login).
  async switchRole(role) {
    const { data } = await api.post("/auth/switch-role", { role });
    setToken(data.access_token);
    return data.user;
  },
  // Finish signup: set capabilities + seed profiles. `payload` = OnboardingRequest.
  async completeOnboarding(payload) {
    const { data } = await api.post("/auth/onboarding", payload);
    setToken(data.access_token);
    return data.user;
  },
  async me() {
    const { data } = await api.get("/auth/me");
    return data;
  },
  logout() {
    clearToken();
  },
  isAuthenticated: () => !!getToken(),
};
