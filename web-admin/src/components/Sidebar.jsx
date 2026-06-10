import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Receipt, Wallet, Book, LogOut, Settings as SettingsIcon, Shield, Cpu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Sidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  const links = [
    { name: "Dashboard", path: "/", icon: <LayoutDashboard size={20} /> },
    { name: "Expenses", path: "/expenses", icon: <Receipt size={20} /> },
    { name: "Income", path: "/income", icon: <Wallet size={20} /> },
    { name: "Diaries", path: "/diaries", icon: <Book size={20} /> },
    { name: "Memory Management", path: "/memory-management", icon: <Cpu size={20} /> },
    { name: "Settings", path: "/settings", icon: <SettingsIcon size={20} /> },
    { name: "Privacy Policy", path: "/privacy-policy", icon: <Shield size={20} /> },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col transition-all duration-300">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-indigo-400">Admin Panel</h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {links.map((link) => {
          const isActive = pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {link.icon}
              <span className="font-medium">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={logout}
          className="flex items-center space-x-3 px-4 py-3 w-full text-slate-300 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
