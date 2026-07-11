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

  // Keep the demo role-switcher UX: switching role = a demo login as that role.
  const switchRole = useCallback((role) => loginDemo(role), [loginDemo]);

  return (
    <AppContext.Provider
      value={{
        user,
        role: user?.role || null,
        loading,
        isAuthed: !!user,
        login,
        register,
        google,
        loginDemo,
        logout,
        switchRole,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
