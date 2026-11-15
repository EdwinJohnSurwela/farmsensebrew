import { createContext, useContext, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('farmsense_user');
    return saved && getToken() ? JSON.parse(saved) : null;
  });

  const login = async (username, password, force = false) => {
    let res;
    try {
      res = await api.login(username, password, force);
    } catch (err) {
      // The Pi's message names the device and when it was last active
      // (a session blocks a new sign-in only if seen in the last 2 minutes).
      if (err.status === 409 && !force) {
        const displace = window.confirm(
          err.message || 'This account is in use on another device. Sign it out there and continue here?'
        );
        if (!displace) throw err;
        res = await api.login(username, password, true);
      } else {
        throw err;
      }
    }
    setToken(res.token);
    localStorage.setItem('farmsense_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* best effort */
    }
    setToken(null);
    localStorage.removeItem('farmsense_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
