import React from "react";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-800">Dashboard</h2>
      <div className="flex items-center space-x-4">
        <div className="text-sm font-medium text-slate-600">
          {user?.email || "Admin"}
        </div>
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
          {user?.email?.[0].toUpperCase() || "A"}
        </div>
      </div>
    </header>
  );
}
