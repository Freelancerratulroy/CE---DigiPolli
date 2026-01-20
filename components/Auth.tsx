
import React, { useState } from 'react';
import { backendService } from '../services/backendService';
import { User } from '../types';

interface Props {
  onAuthSuccess: (user: User, isAdmin: boolean) => void;
}

const Auth: React.FC<Props> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // --- MASTER ADMIN OVERRIDE PROTOCOL ---
    if (isLogin && email === 'ceo.ratulroy@gmail.com' && password === 'DigiPolli') {
      let adminUser = backendService.login(email);
      if (!adminUser) {
        adminUser = backendService.register('CEO Ratul Roy', email);
      }
      onAuthSuccess(adminUser, true);
      return;
    }

    if (isLogin) {
      const user = backendService.login(email);
      if (user) {
        onAuthSuccess(user, false);
      } else {
        alert("Node identity not detected. Please register to initialize your agent session.");
      }
    } else {
      if (!name) return alert("Identification label required.");
      const user = backendService.register(name, email);
      onAuthSuccess(user, false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-1 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(37,99,235,0.2)] animate-in zoom-in-95 duration-500">
      <div className="bg-white p-10 md:p-12 rounded-[2.8rem] text-center shadow-inner">
        <div className="text-center mb-10">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-blue-500/30 transform hover:rotate-12 transition-transform">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">{isLogin ? 'Access Node' : 'Initialize Identity'}</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic">Client Engine V4 • Secure Proxy</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div className="text-left animate-in slide-in-from-top-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4 italic">Full Name</label>
              <input 
                type="text" 
                className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-800"
                placeholder="Operational Alias"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="text-left">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4 italic">Work Email</label>
            <input 
              type="email" 
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-800"
              placeholder="operator@nexus.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="text-left">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4 italic">Master Key (Optional for Trials)</label>
            <input 
              type="password" 
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-800 placeholder-slate-200"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[11px] shadow-2xl hover:bg-blue-600 transition-all active:scale-[0.97] mt-8"
          >
            {isLogin ? 'Establish Uplink' : 'Activate Node'}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
          {isLogin ? "No active node?" : "Identity already verified?"}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-blue-600 hover:underline transition-all"
          >
            {isLogin ? 'Register New' : 'Login Securely'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
