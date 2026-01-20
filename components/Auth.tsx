
import React, { useState } from 'react';
import { backendService } from '../services/backendService';
import { User } from '../types';

interface Props {
  onAuthSuccess: (user: User) => void;
}

const Auth: React.FC<Props> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      const user = backendService.login(email);
      if (user) {
        onAuthSuccess(user);
      } else {
        alert("Account not found. Please register first.");
      }
    } else {
      if (!name) return alert("Name is required");
      const user = backendService.register(name, email);
      onAuthSuccess(user);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
      <div className="text-center mb-8">
        <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 text-white">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="text-slate-500 text-sm mt-2">Access Client Engine by DigiPolli</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
            <input 
              type="text" 
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Work Email</label>
          <input 
            type="email" 
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="john@agency.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button 
          type="submit"
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          {isLogin ? 'Sign In' : 'Start Trial (3 Queries Free)'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500">
        {isLogin ? "Don't have an account?" : "Already have an account?"}
        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="ml-1 text-blue-600 font-bold hover:underline"
        >
          {isLogin ? 'Register' : 'Login'}
        </button>
      </div>
    </div>
  );
};

export default Auth;
