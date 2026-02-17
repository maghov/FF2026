import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { ref, set, get, update } from "firebase/database";
import { auth, db } from "../firebase";
import { setManagerId } from "../services/fplApi";

const ADMIN_EMAIL = "maghovk@gmail.com";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [fplCode, setFplCode] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await get(ref(db, `users/${firebaseUser.uid}`));
        const data = snap.val();
        const code = data?.fplCode ?? null;
        if (code) setManagerId(code);
        setFplCode(code);
        setUser(firebaseUser);
      } else {
        setUser(null);
        setFplCode(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function register(name, email, password, code) {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(newUser, { displayName: name });
    await set(ref(db, `users/${newUser.uid}`), {
      name,
      email,
      fplCode: Number(code),
      createdAt: new Date().toISOString(),
    });
    setManagerId(Number(code));
    setFplCode(Number(code));
  }

  async function updateFplCode(newCode) {
    if (!auth.currentUser) return;
    const code = Number(newCode);
    await update(ref(db, `users/${auth.currentUser.uid}`), { fplCode: code });
    setManagerId(code);
    setFplCode(code);
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, fplCode, loading, isAdmin, register, login, logout, updateFplCode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
