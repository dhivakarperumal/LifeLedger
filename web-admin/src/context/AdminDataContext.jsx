import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "./AuthContext";

const AdminDataContext = createContext();

export function AdminDataProvider({ children }) {
  const { user } = useAuth();
  
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [users, setUsers] = useState([]); // This would normally be from a Users collection if you have one.
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);

    const unsubExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));

    const unsubIncome = onSnapshot(collection(db, "income"), (snap) => {
      setIncome(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));

    const unsubDiaries = onSnapshot(collection(db, "diaries"), (snap) => {
      setDiaries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDataLoading(false);
    }, (err) => { console.error(err); setDataLoading(false); });

    return () => {
      unsubExpenses();
      unsubIncome();
      unsubDiaries();
    };
  }, [user]);

  const value = {
    expenses, income, diaries, users, dataLoading
  };

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export const useAdminData = () => useContext(AdminDataContext);
