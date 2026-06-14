import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

// Allow explicit override via VITE_API_URL for cross-machine dev setups (e.g., Mac)
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? `http://${window.location.hostname}:5001/api`
    : `${window.location.origin}/api`);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user on mount and verify session validity
  useEffect(() => {
    const checkAuth = async () => {
      const storedUser = localStorage.getItem("intellmeet_user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const res = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${parsed.token}` },
          });
          if (res.ok) {
            setUser(parsed);
          } else {
            // Token is invalid or backend restarted
            localStorage.removeItem("intellmeet_user");
            setUser(null);
          }
        } catch (err) {
          localStorage.removeItem("intellmeet_user");
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Register User
  const register = async (name, email, password, avatar) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, avatar }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      localStorage.setItem("intellmeet_user", JSON.stringify(data));
      setUser(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Login User
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("intellmeet_user", JSON.stringify(data));
      setUser(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update Profile
  const updateProfile = async (name, avatar) => {
    setError(null);
    try {
      const stored = JSON.parse(localStorage.getItem("intellmeet_user"));
      if (!stored || !stored.token) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${stored.token}`,
        },
        body: JSON.stringify({ name, avatar }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Profile update failed");
      }

      const updated = { ...stored, ...data };
      localStorage.setItem("intellmeet_user", JSON.stringify(updated));
      setUser(updated);
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Real OAuth2 Google Login
  const loginWithGoogle = async (credential) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Google OAuth2 login failed");
      }

      localStorage.setItem("intellmeet_user", JSON.stringify(data));
      setUser(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // SSO fallback for manual provider prompts (email + name)
  const loginWithSSO = async (email, name, provider) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/sso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, provider }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "SSO login failed");
      }

      localStorage.setItem("intellmeet_user", JSON.stringify(data));
      setUser(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout User
  const logout = () => {
    localStorage.removeItem("intellmeet_user");
    setUser(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        register,
        login,
        updateProfile,
        logout,
        clearError,
        loginWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
