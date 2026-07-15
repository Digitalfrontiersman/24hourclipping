// REAL AUTH ADAPTER - talks to the FastAPI auth endpoints and stores the JWT.
import { api, setToken, clearToken, getToken } from "./api";

export const authAdapter = {
  async register({ email, password, name, role }) {
    // Local signups are NOT logged in here - they must verify their email first.
    // Returns { verification_required, email }.
    const { data } = await api.post("/auth/register", { email, password, name, role });
    return data;
  },
  async verifyEmail(token) {
    const { data } = await api.post("/auth/verify-email", { token });
    setToken(data.access_token);
    return data.user;
  },
  async resendVerification(email) {
    const { data } = await api.post("/auth/resend-verification", { email });
    return data;
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
