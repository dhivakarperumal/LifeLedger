import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const DataContext = createContext();

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [dataLoading, setDataLoading] = useState(false);
  
  // Data stores
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [memories, setMemories] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [loadedCollections, setLoadedCollections] = useState(new Set());

  useEffect(() => {
    if (!user) {
      // Clear data if logged out
      setExpenses([]);
      setIncome([]);
      setTransfers([]);
      setDiaries([]);
      setMemories([]);
      setReminders([]);
      setIsInitialLoadDone(false);
      setLoadedCollections(new Set());
      return;
    }

    setDataLoading(true);
    setLoadedCollections(new Set());
    
    const checkCollection = (name) => {
      setLoadedCollections(prev => {
        const next = new Set(prev);
        next.add(name);
        if (next.size === 6) {
          setIsInitialLoadDone(true);
          setDataLoading(false);
        }
        return next;
      });
    };

    const userId = user.uid;

    const unsubExpenses = onSnapshot(
      query(collection(db, "expenses"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setExpenses(list);
        checkCollection("expenses");
      },
      (err) => { console.log("Expenses fetch error:", err); checkCollection("expenses"); }
    );

    const unsubIncome = onSnapshot(
      query(collection(db, "income"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setIncome(list);
        checkCollection("income");
      },
      (err) => { console.log("Income fetch error:", err); checkCollection("income"); }
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, "transfers"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTransfers(list);
        checkCollection("transfers");
      },
      (err) => { console.log("Transfers fetch error:", err); checkCollection("transfers"); }
    );

    const unsubDiaries = onSnapshot(
      query(collection(db, "diaries"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDiaries(list);
        checkCollection("diaries");
      },
      (err) => { console.log("Diaries fetch error:", err); checkCollection("diaries"); }
    );

    const unsubMemories = onSnapshot(
      query(collection(db, "memories"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMemories(list);
        checkCollection("memories");
      },
      (err) => { console.log("Memories fetch error:", err); checkCollection("memories"); }
    );

    const unsubReminders = onSnapshot(
      query(collection(db, "reminders"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReminders(list);
        checkCollection("reminders");
      },
      (err) => { console.log("Reminders fetch error:", err); checkCollection("reminders"); }
    );

    return () => {
      unsubExpenses();
      unsubIncome();
      unsubTransfers();
      unsubDiaries();
      unsubMemories();
      unsubReminders();
    };
  }, [user]);

  const value = {
    expenses, income, transfers, diaries, memories, reminders,
    isInitialLoadDone, dataLoading
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
