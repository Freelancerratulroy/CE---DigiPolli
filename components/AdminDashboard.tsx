
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { backendService } from '../services/backendService';
import { ActivityLog, User, SentEmail, Campaign } from '../types';

interface Props {
  onExit: () => void;
}

const AdminDashboard: React.FC<Props> = ({ onExit }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [view, setView] = useState<'LOGS' | 'USERS' | 'SENT' | 'CAMPAIGNS' | 'USER_DETAIL'>('LOGS');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(() => {
    setLoading(true);
    const fetchedLogs = backendService.getLogs();
    const fetchedUsers = backendService.getUsers();
    const fetchedSent = backendService.getSentEmails();
    const fetchedCampaigns = backendService.getCampaigns();
    setLogs(fetchedLogs || []);
    setUsers(fetchedUsers || []);
    setSentEmails(fetchedSent || []);
    setCampaigns(fetchedCampaigns || []);
    setTimeout(() => setLoading(false), 300);
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalCampaigns: campaigns.length,
    emailsSent: sentEmails.length,
    opens: sentEmails.filter(e => e.opened).length,
    avgOpenRate: sentEmails.length > 0 ? Math.round((sentEmails.filter(e => e.opened).length / sentEmails.length) * 100) : 0,
    failureRate: sentEmails.length > 0 ? Math.round((sentEmails.filter(e => e.status === 'FAILED').length / sentEmails.length) * 100) : 0,
  }), [users, campaigns, sentEmails]);

  const userDetailData = useMemo(() => {
    if (!selectedUserId) return null;
    const user = users.find(u => u.id === selectedUserId);
    if (!user) return null;
    const userCampaigns = campaigns.filter(c => c.userId === user.id);
    const userEmails = sentEmails.filter(e => userCampaigns.some(uc => uc.id === e.campaignId));
    const userLogs = logs.filter(l => l.userId === user.id);
    return { user, campaigns: userCampaigns, emails: userEmails, logs: userLogs };
  }, [selectedUserId, users, campaigns, sentEmails, logs]);

  if (loading) {
    return (
      <div className="min-h-[700px] flex flex-col items-center justify-center bg-slate-950 rounded-[3rem] text-slate-600">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-8"></div>
        <p className="font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">Synchronizing Admin Matrix...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 text-slate-100 p-8 md:p-12 rounded-[3.5rem] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] border border-slate-800 min-h-[850px] animate-in slide-in-from-bottom-8 duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 mb-12 border-b border-slate-800 pb-10">
        <div className="flex items-center gap-6">
          <div className="w-1.5 h-16 bg-blue-600 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.6)]"></div>
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-2">Master Admin Node</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">Global Visibility • Client Engine Infrastructure</p>
          </div>
        </div>
        
        <nav className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-2 rounded-[2rem] border border-slate-800/50">
          <button onClick={() => setView('LOGS')} className={`px-6 py-3 rounded-2xl text-[9px] font-black tracking-widest uppercase transition-all ${view === 'LOGS' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>General Activity</button>
          <button onClick={() => setView('USERS')} className={`px-6 py-3 rounded-2xl text-[9px] font-black tracking-widest uppercase transition-all ${view === 'USERS' || view === 'USER_DETAIL' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>User Base</button>
          <button onClick={() => setView('CAMPAIGNS')} className={`px-6 py-3 rounded-2xl text-[9px] font-black tracking-widest uppercase transition-all ${view === 'CAMPAIGNS' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>Global Missions</button>
          <button onClick={() => setView('SENT')} className={`px-6 py-3 rounded-2xl text-[9px] font-black tracking-widest uppercase transition-all ${view === 'SENT' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>Dispatch Stream</button>
          <button onClick={onExit} className="px-6 py-3 text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors text-[9px] font-black uppercase tracking-widest ml-4">Terminate Session</button>
        </nav>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Total Nodes', val: stats.totalUsers, sub: 'REGISTERED USERS' },
          { label: 'Active Missions', val: stats.totalCampaigns, sub: 'OUTREACH CAMPAIGNS' },
          { label: 'Transmission Volume', val: stats.emailsSent, sub: 'TOTAL SENT EMAILS' },
          { label: 'Conversion Intel', val: `${stats.avgOpenRate}%`, sub: `GLOBAL OPEN RATE` },
        ].map((s, i) => (
          <div key={i} className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800/80 hover:border-blue-600/40 transition-all">
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 italic">{s.label}</div>
            <div className="text-4xl font-black text-white mb-2 italic tracking-tighter">{s.val}</div>
            <div className="text-[8px] font-bold uppercase text-slate-500 tracking-widest">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* View Content Area */}
      <div className="animate-in fade-in duration-500">
        
        {/* LOGS VIEW */}
        {view === 'LOGS' && (
          <div className="bg-slate-900/40 rounded-[3rem] border border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900/80">
                <tr className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em]">
                  <th className="py-6 px-10">Timestamp</th>
                  <th className="py-6 px-10">Identity</th>
                  <th className="py-6 px-10">Protocol</th>
                  <th className="py-6 px-10 text-right">Data Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono text-[11px]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-5 px-10 text-slate-600 italic">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-5 px-10 font-bold text-white">{log.userEmail}</td>
                    <td className="py-5 px-10">
                       <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-[0.2em] uppercase ${
                        log.type === 'SECURITY_EVENT' ? 'bg-red-500/10 text-red-500' :
                        log.type === 'CAMPAIGN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="py-5 px-10 text-right font-black text-blue-500 italic">
                      {log.output.sentCount || log.output.rowCount || (log.output.success ? 'ACK_OK' : 'FAULT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* USERS LIST VIEW */}
        {view === 'USERS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {users.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setSelectedUserId(u.id); setView('USER_DETAIL'); }}
                className="bg-slate-900/60 p-10 rounded-[3.5rem] border border-slate-800 hover:border-blue-600 transition-all relative overflow-hidden group cursor-pointer shadow-xl shadow-black/40"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="font-black text-white text-2xl italic tracking-tighter mb-1 leading-none">{u.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono tracking-widest">{u.email}</div>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-400/20'}`}>
                    {u.status}
                  </span>
                </div>
                <div className="space-y-4 pt-8 border-t border-slate-800/80 font-black text-[10px] uppercase tracking-[0.3em] text-slate-500">
                   <div className="flex justify-between"><span>Node ID:</span><span className="text-white font-mono">{u.id}</span></div>
                   <div className="flex justify-between"><span>AI Engine:</span><span className="text-blue-500">{u.activeAiProvider}</span></div>
                   <div className="flex justify-between"><span>Trial Bal:</span><span className="text-emerald-500">{u.trialQueriesRemaining} Left</span></div>
                   <div className="flex justify-between"><span>Lifetime Ops:</span><span className="text-white">{u.totalQueriesUsed} Actions</span></div>
                </div>
                <div className="mt-10 py-4 bg-blue-600/10 rounded-2xl text-center text-[9px] font-black text-blue-500 uppercase tracking-[0.4em] opacity-0 group-hover:opacity-100 transition-all duration-300">Open Full Dossier</div>
              </div>
            ))}
          </div>
        )}

        {/* DETAILED USER DOSSIER VIEW */}
        {view === 'USER_DETAIL' && userDetailData && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
               <button onClick={() => setView('USERS')} className="group flex items-center gap-4 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.4em] italic">
                  <svg className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Subscriber List
               </button>
               <h3 className="text-5xl font-black italic text-white uppercase tracking-tighter leading-none">Identity: {userDetailData.user.name}</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               {/* Profile Card */}
               <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-2xl">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8 border-b border-slate-800 pb-4 italic">Core Node Profile</h4>
                  <div className="space-y-6 font-mono text-[11px]">
                     <div className="flex flex-col gap-1"><span className="text-[8px] text-slate-600 uppercase tracking-widest">Serial ID:</span><span className="text-white">{userDetailData.user.id}</span></div>
                     <div className="flex flex-col gap-1"><span className="text-[8px] text-slate-600 uppercase tracking-widest">Status:</span><span className="text-emerald-500 font-black">{userDetailData.user.status}</span></div>
                     <div className="flex flex-col gap-1"><span className="text-[8px] text-slate-600 uppercase tracking-widest">Genesis Date:</span><span className="text-white">{new Date(userDetailData.user.createdAt).toLocaleString()}</span></div>
                     <div className="flex flex-col gap-1"><span className="text-[8px] text-slate-600 uppercase tracking-widest">Driver:</span><span className="text-blue-500 font-black">{userDetailData.user.activeAiProvider}</span></div>
                     {userDetailData.user.emailConnection && (
                       <div className="flex flex-col gap-1"><span className="text-[8px] text-slate-600 uppercase tracking-widest">SMTP Link:</span><span className="text-indigo-400 break-all">{userDetailData.user.emailConnection.email}</span></div>
                     )}
                  </div>
               </div>

               {/* Activity Summary */}
               <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { label: 'Lead Gen Ops', val: userDetailData.logs.filter(l => l.type === 'LEAD_GEN').length, icon: '🔍' },
                    { label: 'Total Missions', val: userDetailData.campaigns.length, icon: '🚀' },
                    { label: 'Total Dispatch', val: userDetailData.emails.length, icon: '📧' },
                  ].map((s, i) => (
                    <div key={i} className="bg-slate-900/60 p-10 rounded-[3rem] border border-slate-800 text-center flex flex-col justify-center items-center">
                       <div className="text-4xl mb-4">{s.icon}</div>
                       <div className="text-5xl font-black text-white italic tracking-tighter mb-2">{s.val}</div>
                       <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{s.label}</div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Campaign Table in Dossier */}
            <div className="bg-slate-900 rounded-[3.5rem] border border-slate-800 overflow-hidden shadow-2xl">
               <div className="px-10 py-8 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
                  <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic">Mission History</h4>
                  <span className="text-[9px] font-bold text-slate-600 uppercase">Archive Data Nodes</span>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[10px]">
                     <thead className="text-slate-700 uppercase tracking-widest bg-slate-950/20">
                        <tr>
                           <th className="px-10 py-5">Campaign ID / Name</th>
                           <th className="px-10 py-5">Mode</th>
                           <th className="px-10 py-5 text-center">Volume</th>
                           <th className="px-10 py-5 text-center">Opens</th>
                           <th className="px-10 py-5 text-right">Created</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800/60">
                        {userDetailData.campaigns.length === 0 ? (
                           <tr><td colSpan={5} className="px-10 py-10 text-center text-slate-700 italic">No missions deployed by this node.</td></tr>
                        ) : (
                           userDetailData.campaigns.map(c => (
                              <tr key={c.id} className="hover:bg-slate-950/40 transition-colors">
                                 <td className="px-10 py-6">
                                    <div className="text-white font-black italic text-xs mb-1 uppercase tracking-tighter">{c.name}</div>
                                    <div className="text-slate-600 text-[8px] uppercase">{c.id}</div>
                                 </td>
                                 <td className="px-10 py-6">
                                    <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-widest ${c.mode === 'AI_CUSTOM' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>{c.mode}</span>
                                 </td>
                                 <td className="px-10 py-6 text-center text-blue-500 font-bold">{c.stats.sent}</td>
                                 <td className="px-10 py-6 text-center text-emerald-500 font-bold">{c.stats.opened}</td>
                                 <td className="px-10 py-6 text-right text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Leads Table (extracted from Activity logs) in Dossier */}
            <div className="bg-slate-900 rounded-[3.5rem] border border-slate-800 overflow-hidden shadow-2xl">
               <div className="px-10 py-8 bg-slate-950/60 border-b border-slate-800">
                  <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic">Lead Generation Logs</h4>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[10px]">
                     <thead className="text-slate-700 uppercase tracking-widest bg-slate-950/20">
                        <tr>
                           <th className="px-10 py-5">Niche Target</th>
                           <th className="px-10 py-5">Geolocation</th>
                           <th className="px-10 py-5 text-center">Lead Yield</th>
                           <th className="px-10 py-5 text-right">Operation Time</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800/60">
                        {userDetailData.logs.filter(l => l.type === 'LEAD_GEN').length === 0 ? (
                           <tr><td colSpan={4} className="px-10 py-10 text-center text-slate-700 italic">No search operations recorded.</td></tr>
                        ) : (
                           userDetailData.logs.filter(l => l.type === 'LEAD_GEN').map(l => (
                              <tr key={l.id} className="hover:bg-slate-950/40 transition-colors">
                                 <td className="px-10 py-6 text-white font-black italic text-xs uppercase tracking-tighter">{l.input.niche || 'GLOBAL'}</td>
                                 <td className="px-10 py-6 text-slate-400 font-bold">{l.input.location || 'UNDETECTED'}</td>
                                 <td className="px-10 py-6 text-center text-blue-500 font-black">{l.output.rowCount} Leads</td>
                                 <td className="px-10 py-6 text-right text-slate-600">{new Date(l.timestamp).toLocaleString()}</td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
          </div>
        )}

        {/* GLOBAL CAMPAIGNS VIEW */}
        {view === 'CAMPAIGNS' && (
           <div className="overflow-x-auto bg-slate-900/40 rounded-[3rem] border border-slate-800">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] bg-slate-900/80">
                       <th className="py-6 px-10">Mission Profile</th>
                       <th className="py-6 px-10">Owner Node</th>
                       <th className="py-6 px-10 text-center">Thruput</th>
                       <th className="py-6 px-10 text-center">Intel (Opens)</th>
                       <th className="py-6 px-10 text-right">Created</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800/50 font-mono text-[11px]">
                    {campaigns.map(c => {
                       const cStats = backendService.getCampaignStats(c.id);
                       const owner = users.find(u => u.id === c.userId);
                       return (
                          <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                             <td className="py-6 px-10">
                                <div className="text-white font-black italic uppercase tracking-tighter text-sm mb-1">{c.name}</div>
                                <div className={`text-[8px] font-black uppercase tracking-widest ${c.mode === 'AI_CUSTOM' ? 'text-indigo-400' : 'text-slate-500'}`}>{c.mode}</div>
                             </td>
                             <td className="py-6 px-10">
                                <div className="text-blue-500 font-bold text-xs">{owner?.name || 'UNKNOWN'}</div>
                                <div className="text-[8px] text-slate-600 uppercase">{c.userId}</div>
                             </td>
                             <td className="py-6 px-10 text-center font-bold text-white">{cStats.sent} Sent</td>
                             <td className="py-6 px-10 text-center font-bold text-emerald-500">{cStats.opened} ({cStats.openRate}%)</td>
                             <td className="py-6 px-10 text-right text-slate-600">{new Date(c.createdAt).toLocaleDateString()}</td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        )}

        {/* GLOBAL DISPATCH LOG VIEW */}
        {view === 'SENT' && (
           <div className="bg-slate-900/40 rounded-[3rem] border border-slate-800 overflow-hidden shadow-2xl">
              <div className="px-10 py-6 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
                 <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic leading-none">Global Ledger: Last 200 Units</h4>
                 <div className="text-[8px] text-slate-700 font-black uppercase tracking-[0.6em]">System Sync Matrix</div>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                 <table className="w-full text-left font-mono text-[10px]">
                    <thead className="bg-slate-900/80 sticky top-0 z-10">
                       <tr className="text-slate-600 text-[9px] font-black uppercase tracking-[0.4em]">
                          <th className="py-6 px-10">Identity ACK</th>
                          <th className="py-6 px-10">Subject Packet</th>
                          <th className="py-6 px-10">Status</th>
                          <th className="py-6 px-10 text-right">Dispatch Timestamp</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                       {sentEmails.slice(0, 200).map((e, i) => (
                          <tr key={i} className="hover:bg-slate-950/40 transition-colors">
                             <td className="py-5 px-10">
                                <div className="text-white font-bold">{e.businessName || 'GENERIC_LEAD'}</div>
                                <div className="text-slate-600 text-[8px]">{e.recipient}</div>
                             </td>
                             <td className="py-5 px-10 text-slate-500 truncate max-w-[200px] italic">"{e.subject}"</td>
                             <td className="py-5 px-10">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${
                                   e.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                }`}>
                                   {e.status}
                                </span>
                                {e.opened && <span className="ml-2 text-blue-500 font-black animate-pulse">[ACK_OPEN]</span>}
                             </td>
                             <td className="py-5 px-10 text-right text-slate-700">{new Date(e.timestamp).toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
