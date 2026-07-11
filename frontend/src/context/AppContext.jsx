import { createContext, useContext, useState } from "react";
import { authAdapter } from "@/services/authAdapter";

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [role, setRole] = useState(authAdapter.getRole());

  const switchRole = (r) => {
    authAdapter.setRole(r);
    setRole(r);
  };

  return (
    <AppContext.Provider value={{ role, switchRole, user: authAdapter.getUser(role) }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
