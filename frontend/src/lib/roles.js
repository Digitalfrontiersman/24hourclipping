// Single source of truth for role → dashboard home + display labels.
// Previously duplicated across Navbar, ProtectedRoute, Login and Register.

export const ROLE_HOME = { customer: "/customer", clipper: "/clipper", admin: "/admin" };
export const ROLE_LABEL = { customer: "Customer", clipper: "Clipper", admin: "Admin" };

// Product-facing names for the two participant roles.
export const ROLE_NOUN = { customer: "Creator", clipper: "Clipper", admin: "Admin" };

// Where to send a user after auth: onboarding first, else their active dashboard.
export function homeFor(user) {
  if (!user) return "/login";
  if (!user.onboarded) return "/onboarding";
  return ROLE_HOME[user.role] || "/";
}
