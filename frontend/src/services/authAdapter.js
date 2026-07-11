// MOCK AUTH ADAPTER — replace with real auth provider (JWT / OAuth) later.
const USERS = {
  customer: { id: "demo-customer", name: "Aria Chen", label: "Customer", credits: 150 },
  clipper: { id: "clipper-1", name: "Maya Torres", label: "Clipper" },
  admin: { id: "demo-admin", name: "Admin", label: "Administrator" },
};

export const authAdapter = {
  getRole: () => localStorage.getItem("24hc_role") || "customer",
  setRole: (role) => localStorage.setItem("24hc_role", role),
  getUser: (role) => USERS[role] || USERS.customer,
  isAuthenticated: () => true,
};
