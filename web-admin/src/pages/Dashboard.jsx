import React from "react";
import { useAdminData } from "../context/AdminDataContext";
import { Receipt, Wallet, Book, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Dashboard() {
  const { expenses, income, diaries, dataLoading } = useAdminData();

  if (dataLoading) {
    return <div className="text-slate-500 text-lg">Loading dashboard data...</div>;
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const totalIncome = income.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);

  const stats = [
    { title: "Total Income", value: `$${totalIncome.toFixed(2)}`, icon: <Wallet size={24} className="text-emerald-600" />, bg: "bg-emerald-100", trend: "up" },
    { title: "Total Expenses", value: `$${totalExpenses.toFixed(2)}`, icon: <Receipt size={24} className="text-red-600" />, bg: "bg-red-100", trend: "down" },
    { title: "Total Diaries", value: diaries.length, icon: <Book size={24} className="text-indigo-600" />, bg: "bg-indigo-100", trend: "neutral" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
              <h3 className="text-3xl font-bold text-slate-800">{stat.value}</h3>
            </div>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${stat.bg}`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Recent Expenses</h2>
          <div className="space-y-4">
            {expenses.slice(0, 5).map((exp) => (
              <div key={exp.id} className="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                    <ArrowDownRight size={20} className="text-red-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{exp.category || "Uncategorized"}</p>
                    <p className="text-sm text-slate-500">{new Date(exp.date?.seconds * 1000).toLocaleDateString() || "Unknown date"}</p>
                  </div>
                </div>
                <div className="font-bold text-red-600">-${exp.amount}</div>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-slate-500">No expenses recorded yet.</p>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Recent Income</h2>
          <div className="space-y-4">
            {income.slice(0, 5).map((inc) => (
              <div key={inc.id} className="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <ArrowUpRight size={20} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{inc.source || "Unknown Source"}</p>
                    <p className="text-sm text-slate-500">{new Date(inc.date?.seconds * 1000).toLocaleDateString() || "Unknown date"}</p>
                  </div>
                </div>
                <div className="font-bold text-emerald-600">+${inc.amount}</div>
              </div>
            ))}
             {income.length === 0 && <p className="text-slate-500">No income recorded yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
