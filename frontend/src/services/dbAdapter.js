// MOCK DATABASE ADAPTER — thin wrapper around the demo FastAPI backend.
// Replace endpoints here to connect the production database without touching components.
import { api } from "./api";

export const dbAdapter = {
  getClippers: () => api.get("/clippers").then((r) => r.data),
  getClipper: (id) => api.get(`/clippers/${id}`).then((r) => r.data),
  getProjects: (params) => api.get("/projects", { params }).then((r) => r.data),
  getProject: (id) => api.get(`/projects/${id}`).then((r) => r.data),
  createProject: (data) => api.post("/projects", data).then((r) => r.data),
  fundProject: (id, method) => api.post(`/projects/${id}/fund`, { payment_method: method }).then((r) => r.data),
  createCardCheckout: (id) => api.post(`/projects/${id}/checkout`).then((r) => r.data),
  confirmCardCheckout: (id, sessionId) => api.post(`/projects/${id}/checkout/confirm`, { session_id: sessionId }).then((r) => r.data),
  getBids: (projectId) => api.get(`/projects/${projectId}/bids`).then((r) => r.data),
  createBid: (projectId, data) => api.post(`/projects/${projectId}/bids`, data).then((r) => r.data),
  acceptBid: (bidId) => api.post(`/bids/${bidId}/accept`).then((r) => r.data),
  getContracts: (status) => api.get("/contracts", { params: status ? { status } : {} }).then((r) => r.data),
  getContract: (id) => api.get(`/contracts/${id}`).then((r) => r.data),
  activateContract: (id) => api.post(`/contracts/${id}/activate`).then((r) => r.data),
  deliver: (id, data) => api.post(`/contracts/${id}/deliver`, data).then((r) => r.data),
  requestRevision: (id, text) => api.post(`/contracts/${id}/revision`, { sender: "customer", text }).then((r) => r.data),
  approve: (id, rating) => api.post(`/contracts/${id}/approve`, { rating }).then((r) => r.data),
  triggerRescue: (id) => api.post(`/contracts/${id}/rescue`).then((r) => r.data),
  relaunch: (id) => api.post(`/contracts/${id}/relaunch`).then((r) => r.data),
  getMessages: (contractId) => api.get(`/contracts/${contractId}/messages`).then((r) => r.data),
  sendMessage: (contractId, sender, text) => api.post(`/contracts/${contractId}/messages`, { sender, text }).then((r) => r.data),
  getBrandProfiles: () => api.get("/brand-profiles").then((r) => r.data),
  updateBrandProfile: (id, data) => api.put(`/brand-profiles/${id}`, data).then((r) => r.data),
  adminOverview: () => api.get("/admin/overview").then((r) => r.data),
  resetDemo: () => api.post("/demo/reset").then((r) => r.data),
};

export const bondFor = (budget) => {
  if (budget < 50) return 5;
  if (budget < 100) return Math.round(budget * 0.15 * 100) / 100;
  return Math.round(budget * 0.2 * 100) / 100;
};
