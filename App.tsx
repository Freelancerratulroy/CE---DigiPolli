
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
import { performSEOLeadGen } from './geminiService.ts';
import { backendService } from './services/backendService.ts';

export default function App(): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'SEARCH' | 'OUTREACH' | 'ADMIN' | 'AI_GATE'>('AI_GATE');
  const [searchState, setSearchState] = useState<SearchState>({
    status: 'idle',
    progress: 0,
    results: [],
  });

  const isVerified = user?.geminiKeyStatus === 'VERIFIED';

  // Force AI_GATE if not verified
  useEffect(() => {
    if (user && !isVerified) {
      setActiveTab('AI_GATE');
    } else if (user && isVerified && activeTab === 'AI_GATE') {
      setActiveTab('SEARCH');
    }
  }, [user, isVerified]);

  useEffect(() => {
    const savedUserEmail = localStorage.getItem('current_user_email');
    if (savedUserEmail) {
      const u = backendService.login(savedUserEmail);
      if (u) {
        setUser(u);
        if (u.email === 'ceo.ratulroy@gmail.com') setIsAdmin(true);
      }
    }
  }, []);

  const handleAuth = (userData: User, adminStatus: boolean) => {
    setUser(userData);
    setIsAdmin(adminStatus);
    localStorage.setItem('current_user_email', userData.email);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const handleSearch = async (niche: string, location: string, targetEmail: string) => {
    if (!user || !isVerified) return;
    
    setSearchState((prev) => ({ ...prev, status: 'searching', progress: 5 }));

    try {
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
      // If error suggests API issue, reset verification
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        handleUpdateUser({ ...user, geminiKeyStatus: 'UNSET' });
      }
    }
  };

  if (!user) {
    return <Auth onAuthSuccess={handleAuth} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <Header onLogoClick={() => isVerified ? setActiveTab('SEARCH') : setActiveTab('AI_GATE')} />
      
      <main className="max-w-7xl mx-auto px-4 pt-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <button 
              onClick={() => isVerified && setActiveTab('SEARCH')}
              disabled={!isVerified}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${!isVerified ? 'opacity-30 cursor-not-allowed' : ''} ${activeTab === 'SEARCH' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Intelligence
            </button>
            <button 
              onClick={() => isVerified && setActiveTab('OUTREACH')}
              disabled={!isVerified}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${!isVerified ? 'opacity-30 cursor-not-allowed' : ''} ${activeTab === 'OUTREACH' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Broadcasting
            </button>
            {isAdmin && isVerified && (
              <button 
                onClick={() => setActiveTab('ADMIN')}
                className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ADMIN' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Admin Terminal
              </button>
            )}
            <button 
              onClick={() => setActiveTab('AI_GATE')}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'AI_GATE' ? 'bg-slate-950 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Uplink Gate
            </button>
          </div>

          <div className="flex items-center gap-6 bg-white px-8 py-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="text-right">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Node: {user.name}</div>
              <div className={`text-[10px] font-black uppercase italic leading-none mt-1 ${isVerified ? 'text-emerald-500' : 'text-red-500'}`}>
                {isVerified ? 'Handshake: Verified' : 'Handshake: Offline'}
              </div>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm border-2 border-white shadow-md ${isVerified ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {user.name.charAt(0)}
            </div>
          </div>
        </div>

        {activeTab === 'AI_GATE' && (
          <ApiKeyGate user={user} onSuccess={handleUpdateUser} />
        )}

        {isVerified && (
          <div className="animate-in fade-in duration-700">
            {activeTab === 'SEARCH' && (
              <div className="space-y-8">
                <UpgradeSection user={user} onUpgrade={setUser} />
                <InputSection 
                  onSearch={handleSearch} 
                  isLoading={searchState.status === 'searching'} 
                  isLocked={user.status === 'TRIAL' && user.trialQueriesRemaining <= 0}
                />
                
                {searchState.status === 'searching' && (
                  <div className="py-32 text-center animate-pulse">
                    <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-10 shadow-3xl shadow-blue-500/20"></div>
                    <h3 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter mb-4 leading-none">Mapping Nodes</h3>
                    <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.6em] italic">Accessing SERP Matrix • {searchState.progress}% SYNC</p>
                  </div>
                )}

                {searchState.status === 'error' && (
                  <div className="bg-red-50 border border-red-200 p-8 rounded-3xl mb-8 flex items-center gap-6">
                    <div className="bg-red-600 text-white p-3 rounded-2xl">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                      <h4 className="font-black text-red-700 uppercase tracking-widest text-xs mb-1">System Interrupt</h4>
                      <p className="text-red-600 font-bold italic">{searchState.error}</p>
                    </div>
                  </div>
                )}

                {searchState.results.length > 0 && (
                  <LeadsTable leads={searchState.results} groundingSources={searchState.groundingSources} />
                )}
              </div>
            )}

            {activeTab === 'OUTREACH' && (
              <EmailOutreach user={user} onUserUpdate={handleUpdateUser} />
            )}
            
            {activeTab === 'ADMIN' && isAdmin && (
              <AdminDashboard onExit={() => setActiveTab('SEARCH')} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
