import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Settings() {
  const { logout } = useAuth();

  const handleDeleteAccount = () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      alert("Account deletion functionality to be implemented.");
      // Add actual delete account logic here
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Settings</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-8">
        
        {/* Profile Section */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 border-b pb-2">Profile</h2>
          <div className="space-y-4">
            <p className="text-slate-600">Manage your profile details and preferences.</p>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Edit Profile
            </button>
          </div>
        </section>

        {/* Privacy Policy Section */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 border-b pb-2">Privacy Policy</h2>
          <div className="space-y-4">
            <p className="text-slate-600">Review our privacy policy and data usage terms.</p>
            <Link to="/privacy-policy" className="inline-block text-indigo-600 hover:text-indigo-800 font-medium underline">
              Read Privacy Policy
            </Link>
          </div>
        </section>

        {/* Account Management Section (Logout Options & Delete Account) */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 border-b pb-2">Account Management</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-700">Logout</h3>
                <p className="text-sm text-slate-500">Sign out of your current session.</p>
              </div>
              <button 
                onClick={logout}
                className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Logout
              </button>
            </div>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-red-100">
              <div>
                <h3 className="font-medium text-red-600">Delete Account</h3>
                <p className="text-sm text-slate-500">Permanently delete your account and all data.</p>
              </div>
              <button 
                onClick={handleDeleteAccount}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
