import { collection, onSnapshot, query, where } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
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
      setLoadedCollections((prev) => {
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

    const subscribe = (name, setter, collectionName) => {
      try {
        return onSnapshot(
          query(collection(db, collectionName), where("userId", "==", userId)),
          (snap) => {
            setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            checkCollection(name);
          },
          (error) => {
            console.error(`${name} fetch error:`, error);
            checkCollection(name);
          },
        );
      } catch (error) {
        console.error(`${name} subscription setup failed:`, error);
        checkCollection(name);
        return () => {};
      }
    };

    const unsubExpenses = subscribe("expenses", setExpenses, "expenses");
    const unsubIncome = subscribe("income", setIncome, "income");
    const unsubTransfers = subscribe("transfers", setTransfers, "transfers");
    const unsubDiaries = subscribe("diaries", setDiaries, "diaries");
    const unsubMemories = subscribe("memories", setMemories, "memories");
    const unsubReminders = subscribe("reminders", setReminders, "reminders");

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
    expenses,
    income,
    transfers,
    diaries,
    memories,
    reminders,
    isInitialLoadDone,
    dataLoading,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
