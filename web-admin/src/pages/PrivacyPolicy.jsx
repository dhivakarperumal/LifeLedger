import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function PrivacyPolicy() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center space-x-4">
        <Link to="/settings" className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl font-bold text-slate-800">Privacy Policy</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6 text-slate-700 leading-relaxed">
        <p className="text-sm text-slate-500">Last updated: June 10, 2026</p>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-3">1. Introduction</h2>
          <p>
            Welcome to MyExpensiveApp. We are committed to protecting your personal information and your right to privacy. 
            If you have any questions or concerns about our policy, or our practices with regards to your personal information, 
            please contact us.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-3">2. Information We Collect</h2>
          <p>
            We collect personal information that you voluntarily provide to us when registering at the app, 
            expressing an interest in obtaining information about us or our products and services, when participating 
            in activities on the app or otherwise contacting us.
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Name and Contact Data</li>
            <li>Credentials</li>
            <li>Financial Data (Expenses and Income entered)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-3">3. How We Use Your Information</h2>
          <p>
            We use personal information collected via our app for a variety of business purposes described below. 
            We process your personal information for these purposes in reliance on our legitimate business interests, 
            in order to enter into or perform a contract with you, with your consent, and/or for compliance with our 
            legal obligations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-3">4. Will Your Information Be Shared With Anyone?</h2>
          <p>
            We only share information with your consent, to comply with laws, to provide you with services, 
            to protect your rights, or to fulfill business obligations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-3">5. How Long Do We Keep Your Information?</h2>
          <p>
            We will only keep your personal information for as long as it is necessary for the purposes set out in 
            this privacy policy, unless a longer retention period is required or permitted by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-3">6. How Do We Keep Your Information Safe?</h2>
          <p>
            We have implemented appropriate technical and organizational security measures designed to protect the 
            security of any personal information we process.
          </p>
        </section>
      </div>
    </div>
  );
}
