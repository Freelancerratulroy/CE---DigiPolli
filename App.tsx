
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Auth from './components/Auth';
import ApiKeyGate from './components/ApiKeyGate';
import InputSection from './components/InputSection';
import LeadsTable from './components/LeadsTable';
import AdminDashboard from './components/AdminDashboard';
import UpgradeSection from './components/UpgradeSection';
import EmailOutreach from './components/EmailOutreach';
import { SearchState, User } from './types';
import { performSEOLeadGen, verifyApiKey } from './geminiService';
import { backendService } from './services/backendService';

const App: React.FC = () => {
  const [view, setView] = useState<'USER' | 'ADMIN' | 'OUTREACH' | 'AI_GATE'>('USER');
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
        if (wasAdmin) {
          setView('ADMIN');
        } else {
          // STRICT BYOK Check: If the user hasn't verified a key, force them to the gate
          const isKeyVerified = user.geminiKeyStatus === 'VERIFIED' || user.openaiKeyStatus === 'VERIFIED';
          if (!isKeyVerified) setView('AI_GATE');
        }
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
      const isKeyVerified = user.geminiKeyStatus === 'VERIFIED' || user.openaiKeyStatus === 'VERIFIED';
      setView(isKeyVerified ? 'USER' : 'AI_GATE');
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    setView('USER'); // Return to main dash after key setup
  };

  const handleLogout = () => {
    localStorage.removeItem('active_user_email');
    localStorage.removeItem('is_admin_session');
    setCurrentUser(null);
    setView('USER');
  };

  const handleSearch = async (niche: string, location: string) => {
    if (!currentUser) return;
    
    const userKey = currentUser.activeAiProvider === 'GEMINI' ? currentUser.geminiApiKey : currentUser.openaiApiKey;
    if (!userKey || userKey.trim() === '') {
      alert("AI NODE DISCONNECTED: No personal API Key detected. Redirecting to Socket Gate.");
      setView('AI_GATE');
      return;
    }

    if (currentUser.status === 'TRIAL' && currentUser.trialQueriesRemaining <= 0) {
      alert("Trial mission limit reached. Please upgrade to Pro for unlimited node operations.");
      return;
    }

    setState({ status: 'searching', progress: 5, results: [] });
    
    try {
      // FINAL SECURITY CHECK: Re-verify key before heavy tool execution
      const check = await verifyApiKey(currentUser.activeAiProvider, userKey);
      if (!check.valid) {
        throw new Error(check.error || "The connected API node has lost authorization. Please re-verify your key.");
      }

      const { leads, groundingSources } = await performSEOLeadGen(niche, location, userKey.trim());
      
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
      console.error("Mission Interrupted:", err);
      setState({ status: 'error', progress: 0, results: [], error: err.message });
      
      // If auth failed, redirect to gate
      if (err.message.includes("API key") || err.message.includes("authorization")) {
        setTimeout(() => setView('AI_GATE'), 2000);
      }
    }
  };

  const renderMainContent = () => {
    if (view === 'AI_GATE') {
      return <ApiKeyGate user={currentUser!} onSuccess={handleUpdateUser} />;
    }

    if (view === 'OUTREACH') {
      return <EmailOutreach user={currentUser!} onUserUpdate={handleUpdateUser} />;
    }

    return (
      <>
        <InputSection onSearch={handleSearch} isLoading={state.status === 'searching'} isLocked={currentUser!.status === 'TRIAL' && currentUser!.trialQueriesRemaining <= 0} />

        {state.status === 'searching' && (
          <div className="mb-20 space-y-8 max-w-xl mx-auto text-center animate-in fade-in">
            <div className="h-5 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner p-1">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(37,99,235,0.4)]" style={{ width: `${state.progress}%` }} />
            </div>
            <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.5em] animate-pulse italic">Establishing Data Relay with User Node...</p>
          </div>
        )}

        {state.status === 'completed' && (
          <div className="space-y-12 mb-32 animate-in slide-in-from-bottom-12 duration-700">
            <div className="flex justify-between items-center border-b border-slate-200 pb-10">
              <h3 className="text-4xl font-black uppercase text-slate-900 italic tracking-tighter leading-none">Harvested Targets ({state.results.length})</h3>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic bg-slate-100 px-4 py-2 rounded-full border border-slate-200">Personal Node Link: Active</div>
            </div>
            <LeadsTable leads={state.results} />
            
            {state.groundingSources && state.groundingSources.length > 0 && (
              <div className="mt-16 p-12 bg-slate-950 rounded-[4rem] border border-slate-800 shadow-4xl">
                <h4 className="text-[11px] font-black text-white uppercase tracking-[0.6em] mb-10 italic border-b border-slate-800 pb-6 flex items-center gap-4">
                   <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                   Grounding Intelligence Matrix
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {state.groundingSources.map((chunk, idx) => chunk.web && (
                    <a key={idx} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="p-8 bg-slate-900 rounded-3xl border border-slate-800 hover:border-blue-500 hover:bg-slate-800 transition-all group shadow-2xl">
                      <div className="text-sm font-black text-blue-400 group-hover:text-blue-300 truncate italic mb-3">{chunk.web.title || "Intelligence Source"}</div>
                      <div className="text-[9px] text-slate-600 truncate font-mono tracking-widest uppercase">{chunk.web.uri}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {state.status === 'error' && (
          <div className="p-12 bg-red-50 border border-red-200 rounded-[3rem] text-red-600 text-sm font-bold mb-24 flex items-center gap-8 shadow-2xl animate-in zoom-in-95">
             <div className="bg-red-600 text-white p-5 rounded-2xl shadow-lg shadow-red-500/20">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             </div>
             <div>
               <div className="text-[11px] uppercase tracking-[0.4em] mb-2 font-black italic">Transmission Protocol Fault</div>
               <div className="opacity-80 italic font-medium text-lg leading-tight">{state.error}</div>
             </div>
          </div>
        )}
      </>
    );
  };

  const renderContent = () => {
    if (view === 'ADMIN') return <AdminDashboard onExit={() => { setView('USER'); localStorage.setItem('is_admin_session', 'false'); }} />;
    if (!currentUser) return <Auth onAuthSuccess={handleAuthSuccess} />;

    const isNodeActive = currentUser.geminiKeyStatus === 'VERIFIED' || currentUser.openaiKeyStatus === 'VERIFIED';

    return (
      <div className="animate-in fade-in duration-1000">
        <div className="max-w-4xl mx-auto mb-20 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] border border-blue-100 shadow-xl shadow-blue-500/5 italic">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              NODE: {currentUser.id}
            </div>
            
            <button 
              onClick={() => setView('AI_GATE')}
              className={`inline-flex items-center gap-3 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border transition-all shadow-xl italic ${
                isNodeActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200 animate-pulse'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isNodeActive ? 'bg-emerald-600' : 'bg-red-600'}`}></span>
              AI NODE: {isNodeActive ? 'UPLINK ESTABLISHED' : 'LINK DISCONNECTED'}
            </button>

            <button onClick={handleLogout} className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] border border-slate-800 hover:bg-slate-800 transition-all shadow-2xl active:scale-95 italic">Disconnect</button>
          </div>

          <h2 className="text-7xl font-black text-slate-900 mb-8 tracking-tighter uppercase italic leading-none">Intelligence Hub</h2>
          <p className="text-2xl text-slate-500 font-medium leading-relaxed max-w-3xl mx-auto tracking-tight italic">
            Commanding autonomous agents powered by your individual API node.
          </p>
        </div>

        {currentUser.status === 'TRIAL' && view !== 'AI_GATE' && <UpgradeSection user={currentUser} onUpgrade={setCurrentUser} />}

        <div className="flex flex-col sm:flex-row justify-center gap-6 mb-20">
          <button onClick={() => setView('USER')} className={`px-14 py-6 rounded-[2rem] text-[11px] font-black tracking-[0.4em] uppercase transition-all shadow-3xl active:scale-95 ${view === 'USER' ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300'}`}>Leads Hub</button>
          <button onClick={() => setView('OUTREACH')} className={`px-14 py-6 rounded-[2rem] text-[11px] font-black tracking-[0.4em] uppercase transition-all shadow-3xl active:scale-95 ${view === 'OUTREACH' ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'}`}>Outreach Matrix</button>
          <button onClick={() => setView('AI_GATE')} className={`px-14 py-6 rounded-[2rem] text-[11px] font-black tracking-[0.4em] uppercase transition-all shadow-3xl active:scale-95 ${view === 'AI_GATE' ? 'bg-slate-950 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>Node Settings</button>
        </div>

        {renderMainContent()}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-blue-600 selection:text-white">
      <Header onLogoClick={() => setView('USER')} />
      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 w-full">{renderContent()}</main>
      <footer className="py-24 bg-white border-t border-slate-100 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <button 
            onClick={() => {
              const pwd = window.prompt("Enter Master Infrastructure Key");
              if (pwd === 'Ratul1234') setView('ADMIN');
            }} 
            className="text-[10px] text-slate-300 font-black uppercase tracking-[0.6em] hover:text-blue-600 transition-all italic bg-slate-50 px-8 py-4 rounded-full border border-slate-100 shadow-inner"
          >
            System Infrastructure Terminal
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
