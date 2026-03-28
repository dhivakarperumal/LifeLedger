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
      return;
    }

    setDataLoading(true);
    let loadsRemaining = 6;
    const checkDone = () => {
      loadsRemaining--;
      if (loadsRemaining === 0) {
        setIsInitialLoadDone(true);
        setDataLoading(false);
      }
    };

    const userId = user.uid;

    const unsubExpenses = onSnapshot(
      query(collection(db, "expenses"), where("userId", "==", userId)), 
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setExpenses(list);
        if (loadsRemaining > 0) checkDone();
      },
      (err) => { console.log("Expenses fetch error:", err); if (loadsRemaining > 0) checkDone(); }
    );

    const unsubIncome = onSnapshot(
      query(collection(db, "income"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setIncome(list);
        if (loadsRemaining > 0) checkDone();
      },
      (err) => { console.log("Income fetch error:", err); if (loadsRemaining > 0) checkDone(); }
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, "transfers"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTransfers(list);
        if (loadsRemaining > 0) checkDone();
      },
      (err) => { console.log("Transfers fetch error:", err); if (loadsRemaining > 0) checkDone(); }
    );

    const unsubDiaries = onSnapshot(
      query(collection(db, "diaries"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDiaries(list);
        if (loadsRemaining > 0) checkDone();
      },
      (err) => { console.log("Diaries fetch error:", err); if (loadsRemaining > 0) checkDone(); }
    );

    const unsubMemories = onSnapshot(
      query(collection(db, "memories"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMemories(list);
        if (loadsRemaining > 0) checkDone();
      },
      (err) => { console.log("Memories fetch error:", err); if (loadsRemaining > 0) checkDone(); }
    );

    const unsubReminders = onSnapshot(
      query(collection(db, "reminders"), where("userId", "==", userId)),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReminders(list);
        if (loadsRemaining > 0) checkDone();
      },
      (err) => { console.log("Reminders fetch error:", err); if (loadsRemaining > 0) checkDone(); }
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
