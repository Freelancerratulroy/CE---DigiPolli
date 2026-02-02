
import React, { useState, useEffect } from 'react';
import Header from './components/Header.tsx';
import Auth from './components/Auth.tsx';
import ApiKeyGate from './components/ApiKeyGate.tsx';
import InputSection from './components/InputSection.tsx';
import LeadsTable from './components/LeadsTable.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import UpgradeSection from './components/UpgradeSection.tsx';
import EmailOutreach from './components/EmailOutreach.tsx';
import { SearchState, User } from './types.ts';
import { performSEOLeadGen, verifyApiKey } from './geminiService.ts';
import { backendService } from './services/backendService.ts';

export default function App(): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'SEARCH' | 'OUTREACH' | 'ADMIN' | 'AI_GATE'>('SEARCH');
  const [searchState, setSearchState] = useState<SearchState>({
    status: 'idle',
    progress: 0,
    results: [],
  });

  const isVerified = user?.geminiKeyStatus === 'VERIFIED';

  useEffect(() => {
    const savedUserEmail = localStorage.getItem('current_user_email');
    if (savedUserEmail) {
      const u = backendService.login(savedUserEmail);
      if (u) {
        setUser(u);
        if (u.email === 'ceo.ratulroy@gmail.com') setIsAdmin(true);
        if (u.geminiKeyStatus !== 'VERIFIED') {
          setActiveTab('AI_GATE');
        }
      }
    }
  }, []);

  const handleAuth = (userData: User, adminStatus: boolean) => {
    setUser(userData);
    setIsAdmin(adminStatus);
    localStorage.setItem('current_user_email', userData.email);
    if (userData.geminiKeyStatus !== 'VERIFIED') {
      setActiveTab('AI_GATE');
    } else {
      setActiveTab('SEARCH');
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    if (updatedUser.geminiKeyStatus === 'VERIFIED') {
      setActiveTab('SEARCH');
    }
  };

  const handleSearch = async (niche: string, location: string, targetEmail: string) => {
    if (!user) return;
    
    if (!isVerified) {
      setSearchState((prev) => ({ ...prev, status: 'error', error: "AI NODE DISCONNECTED: Handshake Required." }));
      setActiveTab('AI_GATE');
      return;
    }

    setSearchState((prev) => ({ ...prev, status: 'searching', progress: 5 }));

    try {
      // Create fresh instance via fresh call to verify to ensure injected key is active.
      const check = await verifyApiKey('GEMINI');
      
      if (!check.valid) {
        if (check.error?.includes("RESELECT_REQUIRED")) {
          // Reset key selection state as per guidelines for "Requested entity was not found."
          const revokedUser: User = { ...user, geminiKeyStatus: 'UNSET' };
          backendService.updateUser(revokedUser);
          setUser(revokedUser);
          throw new Error("Node Session Expired: Please re-select your AI Studio project key.");
        }
        throw new Error(check.error || "The AI node refused the mission handshake.");
      }

      const { leads, groundingSources } = await performSEOLeadGen(niche, location);
      
      setSearchState({
        status: 'completed',
        progress: 100,
        results: leads,
        groundingSources
      });

      backendService.logActivity({
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email,
        accountStatus: user.status,
        type: 'LEAD_GEN',
        input: { niche, location },
        output: { rowCount: leads.length, success: true }
      });

      const updatedUser = { ...user, totalQueriesUsed: user.totalQueriesUsed + 1 };
      if (user.status === 'TRIAL') {
        updatedUser.trialQueriesRemaining = Math.max(0, user.trialQueriesRemaining - 1);
      }
      setUser(updatedUser);
      backendService.updateUser(updatedUser);

    } catch (err: any) {
      setSearchState((prev) => ({ ...prev, status: 'error', error: err.message }));
      if (err.message.includes("Expired") || err.message.includes("re-select")) {
        setActiveTab('AI_GATE');
      }
    }
  };

  if (!user) {
    return <Auth onAuthSuccess={handleAuth} />;
  }

  if (activeTab === 'ADMIN' && isAdmin) {
    return <AdminDashboard onExit={() => setActiveTab('SEARCH')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <Header onLogoClick={() => setActiveTab('SEARCH')} />
      
      <main className="max-w-7xl mx-auto px-4 pt-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setActiveTab('SEARCH')}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SEARCH' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Intelligence
            </button>
            <button 
              onClick={() => setActiveTab('OUTREACH')}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'OUTREACH' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Broadcasting
            </button>
            <button 
              onClick={() => setActiveTab('AI_GATE')}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'AI_GATE' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Node Status
            </button>
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('ADMIN')}
                className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-blue-700 transition-all ml-2"
              >
                Admin
              </button>
            )}
          </div>

          <div className="flex items-center gap-6 bg-white px-8 py-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="text-right">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Node ID: {user.id}</div>
              <div className={`text-[10px] font-black uppercase italic leading-none mt-1 ${isVerified ? 'text-emerald-500' : 'text-red-500'}`}>
                {isVerified ? 'Relay Verified' : 'Handshake Required'}
              </div>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm border-2 border-white shadow-md ${isVerified ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              {user.name.charAt(0)}
            </div>
          </div>
        </div>

        {activeTab === 'AI_GATE' && (
          <ApiKeyGate user={user} onSuccess={handleUpdateUser} />
        )}

        {activeTab === 'SEARCH' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isVerified && (
              <div className="bg-red-50 border border-red-200 p-8 rounded-[3rem] mb-12 flex items-center justify-between shadow-xl">
                 <div className="flex items-center gap-6">
                    <div className="bg-red-600 text-white p-4 rounded-2xl shadow-lg shadow-red-500/20">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-red-700 uppercase tracking-[0.3em] mb-1 italic">Security Lockdown</h4>
                      <p className="text-red-600 font-bold italic text-sm">Valid API Node configuration required to execute intelligence missions.</p>
                    </div>
                 </div>
                 <button onClick={() => setActiveTab('AI_GATE')} className="bg-red-600 text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95">Configure Node</button>
              </div>
            )}
            
            <UpgradeSection user={user} onUpgrade={setUser} />
            <InputSection 
              onSearch={handleSearch} 
              isLoading={searchState.status === 'searching'} 
              isLocked={!isVerified || (user.status === 'TRIAL' && user.trialQueriesRemaining <= 0)}
            />
            
            {searchState.status === 'searching' && (
              <div className="py-32 text-center animate-pulse">
                <div className="w-24 h-24 border-8 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-10 shadow-2xl shadow-blue-500/10"></div>
                <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter mb-4 leading-none">Scanning Search Matrix</h3>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.5em] italic">Accessing SERP Nodes • {searchState.progress}% COMPLETE</p>
              </div>
            )}

            {searchState.status === 'error' && (
              <div className="bg-red-50 border border-red-200 p-10 rounded-[3rem] mb-12 flex items-center gap-8 shadow-xl shadow-red-500/5">
                <div className="bg-red-600 text-white p-4 rounded-2xl shadow-lg shadow-red-600/20">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <h4 className="font-black text-red-700 uppercase tracking-[0.2em] text-[11px] mb-2 italic">Intelligence Protocol Failure</h4>
                  <p className="text-red-600 text-lg font-bold italic leading-tight">{searchState.error}</p>
                </div>
              </div>
            )}

            {searchState.results.length > 0 && (
              <div className="space-y-12 animate-in slide-in-from-bottom-12 duration-1000">
                <LeadsTable leads={searchState.results} />
                
                {searchState.groundingSources && searchState.groundingSources.length > 0 && (
                  <div className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-8">
                       <div className="bg-blue-600/10 p-3 rounded-2xl text-blue-600">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       </div>
                       <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] italic leading-none">Validation Matrix (Physical Evidence)</h4>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {searchState.groundingSources.map((chunk: any, i: number) => {
                        const source = chunk.web || chunk.maps;
                        if (!source) return null;
                        return (
                          <a 
                            key={i} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-slate-50 hover:bg-blue-600 hover:text-white border border-slate-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shadow-sm hover:shadow-lg hover:shadow-blue-600/20 active:scale-95 italic"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            {source.title || 'Source Reference'}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'OUTREACH' && (
          <EmailOutreach user={user} onUserUpdate={handleUpdateUser} />
        )}
      </main>
    </div>
  );
}
