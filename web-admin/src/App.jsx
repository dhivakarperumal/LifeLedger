import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AdminDataProvider } from "./context/AdminDataContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";

function App() {
  return (
    <AuthProvider>
      <AdminDataProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="expenses" element={<div className="p-4 text-xl">Expenses Page (To be implemented)</div>} />
              <Route path="income" element={<div className="p-4 text-xl">Income Page (To be implemented)</div>} />
              <Route path="diaries" element={<div className="p-4 text-xl">Diaries Page (To be implemented)</div>} />
              <Route path="memory-management" element={<div className="p-4 text-xl">Memory Management Page (To be implemented)</div>} />
              <Route path="settings" element={<Settings />} />
              <Route path="privacy-policy" element={<PrivacyPolicy />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AdminDataProvider>
    </AuthProvider>
  );
}

export default App;
