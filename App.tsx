
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Auth from './components/Auth';
import InputSection from './components/InputSection';
import LeadsTable from './components/LeadsTable';
import AdminDashboard from './components/AdminDashboard';
import UpgradeSection from './components/UpgradeSection';
import EmailOutreach from './components/EmailOutreach';
import { SearchState, User } from './types';
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
    const wasAdmin = localStorage.getItem('is_admin_session') === 'true';
    if (savedEmail) {
      const user = backendService.login(savedEmail);
      if (user) {
        setCurrentUser(user);
        if (wasAdmin) setView('ADMIN');
      }
    }
  }, []);

  const handleAuthSuccess = (user: User, isAdmin: boolean) => {
    setCurrentUser(user);
    localStorage.setItem('active_user_email', user.email);
    if (isAdmin) {
      localStorage.setItem('is_admin_session', 'true');
      setView('ADMIN');
    } else {
      localStorage.setItem('is_admin_session', 'false');
      setView('USER');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('active_user_email');
    localStorage.removeItem('is_admin_session');
    setCurrentUser(null);
    setView('USER');
  };

  const handleSearch = async (niche: string, location: string) => {
    if (!currentUser) return;
    
    if (currentUser.status === 'TRIAL' && currentUser.trialQueriesRemaining <= 0) {
      alert("Trial limit reached. Please upgrade to Pro.");
      return;
    }

    setState({ status: 'searching', progress: 5, results: [] });
    try {
      // Fix: Capture groundingSources returned from the API service call
      const { leads, groundingSources } = await performSEOLeadGen(currentUser.activeAiProvider, '', niche, location);
      
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

      // Update local state with both search results and mandatory grounding sources
      setState({ status: 'completed', progress: 100, results: leads, groundingSources });
    } catch (err: any) {
      console.error("Tool Execution Failed:", err);
      setState({ status: 'error', progress: 0, results: [], error: err.message });
    }
  };

  const renderContent = () => {
    if (view === 'ADMIN') return <AdminDashboard onExit={() => { setView('USER'); localStorage.setItem('is_admin_session', 'false'); }} />;
    if (!currentUser) return <Auth onAuthSuccess={handleAuthSuccess} />;
    
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
              NODE ID: {currentUser.id}
            </div>
            <button onClick={handleLogout} className="px-5 py-2 rounded-full bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-[0.3em] border border-red-100 hover:bg-red-100 transition-all">Logout</button>
          </div>
          <h2 className="text-6xl font-black text-slate-900 mb-8 tracking-tighter uppercase italic leading-none">Intelligence Engine</h2>
          <p className="text-2xl text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto tracking-tight">
            Deploying AI crawl agents for real-time market harvesting.
          </p>
        </div>

        {currentUser.status === 'TRIAL' && <UpgradeSection user={currentUser} onUpgrade={setCurrentUser} />}

        <div className="flex flex-col sm:flex-row justify-center gap-6 mb-16">
          <button onClick={() => setView('USER')} className={`px-14 py-6 rounded-[2.5rem] text-[11px] font-black tracking-[0.4em] uppercase transition-all shadow-2xl ${view === 'USER' ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-white text-slate-500 border border-slate-100'}`}>Leads Hub</button>
          <button onClick={() => setView('OUTREACH')} className={`px-14 py-6 rounded-[2.5rem] text-[11px] font-black tracking-[0.4em] uppercase transition-all shadow-2xl ${view === 'OUTREACH' ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-white text-slate-500 border border-slate-100'}`}>Outreach Center</button>
        </div>

        <InputSection onSearch={handleSearch} isLoading={state.status === 'searching'} isLocked={currentUser.status === 'TRIAL' && currentUser.trialQueriesRemaining <= 0} />

        {state.status === 'searching' && (
          <div className="mb-20 space-y-8 max-w-xl mx-auto text-center">
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${state.progress}%` }} />
            </div>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest animate-pulse">Syncing with remote data matrix...</p>
          </div>
        )}

        {state.status === 'completed' && (
          <div className="space-y-12 mb-32">
            <h3 className="text-3xl font-black uppercase text-slate-900 italic">Extracted Leads ({state.results.length})</h3>
            <LeadsTable leads={state.results} />
            
            {/* Fix: Mandatory display of Google Search Grounding Sources */}
            {state.groundingSources && state.groundingSources.length > 0 && (
              <div className="mt-12 p-10 bg-white rounded-[3rem] border border-slate-200 shadow-xl animate-in slide-in-from-bottom-4 duration-500">
                <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-[0.5em] mb-8 italic border-b border-slate-100 pb-4">Verification Intelligence (Grounding)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {state.groundingSources.map((chunk, idx) => chunk.web && (
                    <a 
                      key={idx} 
                      href={chunk.web.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex flex-col gap-2 p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-white transition-all shadow-sm group"
                    >
                      <div className="text-xs font-black text-blue-600 group-hover:text-blue-700 underline truncate italic">
                        {chunk.web.title || "Reference Point Node"}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate font-mono">{chunk.web.uri}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {state.status === 'error' && (
          <div className="p-10 bg-red-50 border border-red-100 rounded-[2.5rem] text-red-600 text-sm font-bold mb-24">
             Error: {state.error}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header onLogoClick={() => setView('USER')} />
      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 w-full">{renderContent()}</main>
      <footer className="py-12 bg-white border-t border-slate-100 mt-auto text-center">
          <button 
            onClick={() => {
              const pwd = window.prompt("System Override: Enter Key");
              if (pwd === 'Ratul1234') setView('ADMIN');
            }} 
            className="text-[10px] text-slate-300 font-black uppercase tracking-[0.5em] hover:text-blue-500 transition-colors"
          >
            System Administration Terminal
          </button>
      </footer>
    </div>
  );
};

export default App;
