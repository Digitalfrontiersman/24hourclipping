import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAdapter } from "@/services/authAdapter";

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hydrate the session from a stored token on load.
  useEffect(() => {
    if (authAdapter.isAuthenticated()) {
      authAdapter
        .me()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (creds) => {
    const u = await authAdapter.login(creds);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (data) => {
    const u = await authAdapter.register(data);
    setUser(u);
    return u;
  }, []);

  const google = useCallback(async (payload) => {
    const u = await authAdapter.google(payload);
    setUser(u);
    return u;
  }, []);

  const loginDemo = useCallback(async (role) => {
    const u = await authAdapter.demo(role);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    authAdapter.logout();
    setUser(null);
  }, []);

  // Real role switch: flip the active dashboard mode for a multi-role account
  // (re-issues the JWT server-side; no re-login).
  const switchRole = useCallback(async (role) => {
    const u = await authAdapter.switchRole(role);
    setUser(u);
    return u;
  }, []);

  const completeOnboarding = useCallback(async (payload) => {
    const u = await authAdapter.completeOnboarding(payload);
    setUser(u);
    return u;
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        role: user?.role || null,
        roles: user?.roles || [],
        activeRole: user?.role || null,
        onboarded: user?.onboarded ?? false,
        loading,
        isAuthed: !!user,
        login,
        register,
        google,
        loginDemo,
        logout,
        switchRole,
        completeOnboarding,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
