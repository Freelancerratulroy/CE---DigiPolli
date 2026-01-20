
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Auth from './components/Auth';
import ApiKeyGate from './components/ApiKeyGate';
import InputSection from './components/InputSection';
import LeadsTable from './components/LeadsTable';
import AdminDashboard from './components/AdminDashboard';
import UpgradeSection from './components/UpgradeSection';
import EmailOutreach from './components/EmailOutreach';
import { SearchState, SEOAudit, User, AiProvider } from './types';
import { performSEOLeadGen } from './geminiService';
import { backendService } from './services/backendService';

const App: React.FC = () => {
  const [view, setView] = useState<'USER' | 'ADMIN' | 'OUTREACH'>('USER');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [state, setState] = useState<SearchState>({
    status: 'idle',
    progress: 0,
    results: [],
  });

  useEffect(() => {
    const savedEmail = localStorage.getItem('active_user_email');
    if (savedEmail) {
      const user = backendService.login(savedEmail);
      if (user) setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  const handleLogoClick = () => {
    if (currentUser) {
      setView('USER');
    }
  };

  const handleToggleAdmin = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (view === 'ADMIN') {
      setView('USER');
    } else {
      const password = window.prompt("SYSTEM OVERRIDE: Enter Root Access Key");
      if (password === 'Ratul1234') {
        setView('ADMIN');
      } else if (password !== null) {
        alert("ACCESS VIOLATION: Invalid Credentials.");
      }
    }
  }, [view]);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('active_user_email', user.email);
  };

  const resetApiKey = () => {
    if (!currentUser) return;
    const provider = currentUser.activeAiProvider;
    const updatedUser: User = {
      ...currentUser,
      ...(provider === 'GEMINI' ? { geminiApiKey: undefined, geminiKeyStatus: 'UNSET' } : { openaiApiKey: undefined, openaiKeyStatus: 'UNSET' })
    };
    backendService.updateUser(updatedUser);
    setCurrentUser(updatedUser);
  };

  const handleSearch = async (niche: string, location: string) => {
    if (!currentUser) return;
    const apiKey = currentUser.activeAiProvider === 'GEMINI' ? currentUser.geminiApiKey : currentUser.openaiApiKey;
    if (!apiKey) return;

    if (currentUser.status === 'TRIAL' && currentUser.trialQueriesRemaining <= 0) {
      alert("Trial limit reached. Please upgrade to Pro.");
      return;
    }

    setState({ status: 'searching', progress: 5, results: [] });
    try {
      const { leads, groundingSources } = await performSEOLeadGen(currentUser.activeAiProvider, apiKey, niche, location);
      const updatedUser = { ...currentUser };
      updatedUser.totalQueriesUsed += 1;
      if (updatedUser.status === 'TRIAL') updatedUser.trialQueriesRemaining -= 1;
      backendService.updateUser(updatedUser);
      setCurrentUser(updatedUser);

      await backendService.logActivity({
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userEmail: currentUser.email,
        accountStatus: currentUser.status,
        type: 'LEAD_GEN',
        input: { niche, location },
        output: { rowCount: leads.length }
      });

      setState({ status: 'completed', progress: 100, results: leads, groundingSources });
    } catch (err: any) {
      console.error("Tool Execution Failed:", err);
      const isQuota = err.message?.includes('QUOTA_EXHAUSTED') || err.message?.includes('429');
      if (isQuota || err.message?.includes('API_KEY_INVALID') || err.message?.includes('403')) {
        const provider = currentUser.activeAiProvider;
        setCurrentUser(prev => prev ? { 
          ...prev, 
          ...(provider === 'GEMINI' ? { geminiKeyStatus: 'ERROR' } : { openaiKeyStatus: 'ERROR' }) 
        } : null);
      }
      setState({ 
        status: 'error', 
        progress: 0, 
        results: [], 
        error: isQuota ? "API QUOTA EXHAUSTED: Hit its limit. Please switch provider or use a paid key." : err.message 
      });
    }
  };

  const renderContent = () => {
    if (view === 'ADMIN') return <AdminDashboard onExit={() => setView('USER')} />;
    if (!currentUser) return <Auth onAuthSuccess={handleAuthSuccess} />;
    
    const activeStatus = currentUser.activeAiProvider === 'GEMINI' ? currentUser.geminiKeyStatus : currentUser.openaiKeyStatus;
    if (activeStatus !== 'VERIFIED') {
      return <ApiKeyGate user={currentUser} onSuccess={(u) => setCurrentUser(u)} />;
    }
    
    if (view === 'OUTREACH') return (
      <EmailOutreach 
        user={currentUser} 
        onUserUpdate={u => setCurrentUser(u)} 
      />
    );

    return (
      <div className="animate-in fade-in duration-700">
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] border border-blue-100 shadow-xl shadow-blue-500/5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              ID: {currentUser.id}
            </div>
            <button 
              onClick={resetApiKey}
              className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] border border-slate-800 shadow-xl hover:bg-slate-800 transition-all active:scale-95"
            >
              <svg className={`h-4 w-4 ${currentUser.activeAiProvider === 'GEMINI' ? 'text-blue-400' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Driver: {currentUser.activeAiProvider} (Swap)
            </button>
          </div>
          <h2 className="text-6xl font-black text-slate-900 mb-8 tracking-tighter uppercase italic leading-none">Intelligence Engine</h2>
          <p className="text-2xl text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto tracking-tight">
            Deep-crawling Google Page 2 results. Powered by {currentUser.activeAiProvider} Intelligence Node.
          </p>
        </div>

        {currentUser.status === 'TRIAL' && <UpgradeSection user={currentUser} onUpgrade={setCurrentUser} />}

        <div className="flex flex-col sm:flex-row justify-center gap-6 mb-16">
          <button onClick={() => setView('USER')} className={`px-14 py-6 rounded-[2.5rem] text-[11px] font-black tracking-[0.4em] uppercase transition-all shadow-2xl active:scale-95 ${view === 'USER' ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}>Leads Hub</button>
          <button onClick={() => setView('OUTREACH')} className={`group relative px-14 py-6 rounded-[2.5rem] text-[11px] font-black tracking-[0.4em] uppercase transition-all shadow-2xl active:scale-95 ${view === 'OUTREACH' ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}>Outreach Center</button>
        </div>

        <InputSection onSearch={handleSearch} isLoading={state.status === 'searching'} isLocked={currentUser.status === 'TRIAL' && currentUser.trialQueriesRemaining <= 0} />

        {state.status === 'searching' && (
          <div className="mb-20 space-y-8 max-w-xl mx-auto text-center">
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner border border-slate-300/20">
              <div className="h-full bg-blue-600 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(37,99,235,0.5)]" style={{ width: `${state.progress}%` }} />
            </div>
            <div className="space-y-2">
               <p className="text-sm font-black uppercase tracking-[0.5em] text-blue-600 animate-pulse italic">Scanning Remote Data Nodes...</p>
               <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{currentUser.activeAiProvider} Node Processing On-Page Logic</p>
            </div>
          </div>
        )}

        {state.status === 'completed' && (
          <div className="space-y-12 mb-32">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <h3 className="text-3xl font-black uppercase text-slate-900 flex items-center gap-6 italic tracking-tighter">
                <span className="w-4 h-12 bg-blue-600 rounded-full shadow-[0_0_25px_rgba(37,99,235,0.3)]"></span>
                Extracted Datasets ({state.results.length})
              </h3>
              <button onClick={() => setView('OUTREACH')} className="bg-slate-950 text-white px-12 py-6 rounded-[2.5rem] font-black text-[11px] uppercase tracking-[0.3em] hover:bg-blue-600 transition-all shadow-2xl active:scale-95 flex items-center gap-4">Deploy Outreach Agent</button>
            </div>
            <LeadsTable leads={state.results} />
          </div>
        )}

        {state.status === 'error' && (
          <div className="p-10 bg-red-50 border border-red-100 rounded-[2.5rem] text-red-600 text-sm font-bold flex flex-col md:flex-row items-center gap-8 mb-24 shadow-xl shadow-red-500/5">
             <div className="bg-red-100 p-6 rounded-3xl text-red-600">
               <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <div className="flex-1 text-center md:text-left">
               <div className="text-[11px] uppercase font-black mb-1 tracking-widest">Protocol Execution Fault</div>
               <div className="font-medium text-red-500/80 mb-4">{state.error}</div>
               <button onClick={resetApiKey} className="bg-red-600 text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-500/20">Swap AI Provider / Key</button>
             </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-blue-600 selection:text-white">
      <Header onLogoClick={handleLogoClick} />
      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 w-full">{renderContent()}</main>
      <footer className="py-24 bg-white border-t border-slate-100 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-8 mb-10 opacity-10">
            <div className="h-px w-24 bg-slate-400"></div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.6em]">Enterprise Grid v4.6.5 • Dual Core AI</p>
            <div className="h-px w-24 bg-slate-400"></div>
          </div>
          <button onClick={handleToggleAdmin} className="group relative inline-flex items-center gap-4 text-[10px] text-slate-400 hover:text-blue-600 transition-all uppercase tracking-[0.5em] font-black py-5 px-12 border-2 border-slate-50 rounded-full hover:bg-slate-50 hover:border-blue-100 shadow-xl shadow-slate-200/50 active:scale-95">System Administration Terminal</button>
        </div>
      </footer>
    </div>
  );
};

export default App;
