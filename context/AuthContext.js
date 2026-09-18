import { onAuthStateChanged, signOut } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (nextUser) => {
          setUser(nextUser);
          setLoading(false);
        },
        (error) => {
          console.error("Firebase auth initialization failed:", error);
          setUser(null);
          setLoading(false);
        },
      );
    } catch (error) {
      console.error("Firebase auth setup failed:", error);
      setUser(null);
      setLoading(false);
    }

    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
