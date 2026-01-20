
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
    setTimeout(() => setLoading(false), 500);
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalCampaigns: campaigns.length,
    emailsSent: sentEmails.length,
    opens: sentEmails.filter(e => e.opened).length,
    avgOpenRate: sentEmails.length > 0 ? Math.round((sentEmails.filter(e => e.opened).length / sentEmails.length) * 100) : 0,
    failureRate: sentEmails.length > 0 ? Math.round((sentEmails.filter(e => e.status === 'FAILED').length / sentEmails.length) * 100) : 0,
    aiModePct: campaigns.length > 0 ? Math.round((campaigns.filter(c => c.mode === 'AI_CUSTOM').length / campaigns.length) * 100) : 0
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
        <p className="font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">Initializing Command Console...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 text-slate-100 p-12 rounded-[3.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] border border-slate-800/50 min-h-[800px] animate-in slide-in-from-bottom-12 duration-1000">
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-12 mb-16 border-b border-slate-800 pb-12">
        <div className="flex items-center gap-6">
          <div className="w-4 h-16 bg-blue-600 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.4)]"></div>
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-2">Admin Terminal</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">Global Infrastructure • Client Engine Management</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-2 rounded-[2rem] border border-slate-800">
          <button onClick={() => setView('LOGS')} className={`px-6 py-3 rounded-2xl text-[9px] font-black tracking-widest uppercase transition-all ${view === 'LOGS' ? 'bg-blue-600 text-white shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}>Activity</button>
          <button onClick={() => setView('USERS')} className={`px-6 py-3 rounded-2xl text-[9px] font-black tracking-widest uppercase transition-all ${view === 'USERS' || view === 'USER_DETAIL' ? 'bg-blue-600 text-white shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}>Subscribers</button>
          <button onClick={() => setView('CAMPAIGNS')} className={`px-6 py-3 rounded-2xl text-[9px] font-black tracking-widest uppercase transition-all ${view === 'CAMPAIGNS' ? 'bg-blue-600 text-white shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}>Missions</button>
          <button onClick={() => setView('SENT')} className={`px-6 py-3 rounded-2xl text-[9px] font-black tracking-widest uppercase transition-all ${view === 'SENT' ? 'bg-blue-600 text-white shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}>Dispatch Logs</button>
          <button onClick={onExit} className="px-6 py-3 text-slate-400 hover:text-red-500 transition-colors text-[9px] font-black uppercase tracking-widest">Logout</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {[
          { label: 'Intelligence Nodes', val: stats.totalUsers, sub: 'ACCOUNTS REGISTERED' },
          { label: 'Global Missions', val: stats.totalCampaigns, sub: 'CAMPAIGNS CREATED' },
          { label: 'Sent Volume', val: stats.emailsSent, sub: 'BROADCASTS DELIVERED' },
          { label: 'Global Open Rate', val: `${stats.avgOpenRate}%`, sub: `FAILED: ${stats.failureRate}%` },
        ].map((s, i) => (
          <div key={i} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 group hover:border-slate-600 transition-all">
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{s.label}</div>
            <div className="text-4xl font-black text-white mb-2">{s.val}</div>
            <div className={`text-[8px] font-black uppercase text-slate-500`}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="animate-in fade-in duration-500">
        {view === 'LOGS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-slate-700 text-[9px] font-black uppercase tracking-[0.4em] px-8">
                  <th className="pb-6 px-8">Timestamp</th>
                  <th className="pb-6 px-8">Identity</th>
                  <th className="pb-6 px-8">Event Profile</th>
                  <th className="pb-6 px-8 text-right">Yield</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="bg-slate-900/40 hover:bg-slate-900 transition-all group">
                    <td className="py-6 px-8 rounded-l-[2rem] font-mono text-[10px] text-slate-600 border-l border-slate-800">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-6 px-8 font-black text-xs text-white italic">{log.userEmail}</td>
                    <td className="py-6 px-8">
                       <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${
                        log.type === 'SECURITY_EVENT' ? 'bg-red-500/10 text-red-500' :
                        log.type === 'CAMPAIGN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="py-6 px-8 text-right rounded-r-[2rem] border-r border-slate-800">
                      <div className="text-xs font-black text-blue-500">{log.output.sentCount || log.output.rowCount || (log.output.success ? 'OK' : 'ERR')}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'USERS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {users.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setSelectedUserId(u.id); setView('USER_DETAIL'); }}
                className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 hover:border-blue-600/60 transition-all relative overflow-hidden group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="font-black text-white text-xl italic mb-1">{u.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{u.email}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest ${u.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'}`}>
                    {u.status}
                  </span>
                </div>
                <div className="space-y-4 pt-8 border-t border-slate-800 font-black text-[10px] uppercase tracking-widest text-slate-500">
                   <div className="flex justify-between"><span>Node ID</span><span className="text-white">{u.id}</span></div>
                   <div className="flex justify-between"><span>Provider</span><span className="text-blue-500">{u.activeAiProvider}</span></div>
                   <div className="flex justify-between"><span>Total Usage</span><span className="text-white">{u.totalQueriesUsed} Queries</span></div>
                </div>
                <div className="mt-8 text-center text-[8px] font-black text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Click for User Dossier</div>
              </div>
            ))}
          </div>
        )}

        {view === 'USER_DETAIL' && userDetailData && (
          <div className="space-y-12 animate-in fade-in">
            <div className="flex justify-between items-center mb-12">
               <button onClick={() => setView('USERS')} className="text-blue-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:underline">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Back to Subscriber List
               </button>
               <h3 className="text-2xl font-black italic text-white uppercase tracking-tighter">Identity: {userDetailData.user.name} dossier</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 col-span-1">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Account Profile</h4>
                  <div className="space-y-6 font-mono text-[11px]">
                     <div className="flex justify-between"><span className="text-slate-600">ID:</span><span className="text-white">{userDetailData.user.id}</span></div>
                     <div className="flex justify-between"><span className="text-slate-600">Status:</span><span className="text-emerald-500">{userDetailData.user.status}</span></div>
                     <div className="flex justify-between"><span className="text-slate-600">Created:</span><span className="text-white">{new Date(userDetailData.user.createdAt).toLocaleDateString()}</span></div>
                     <div className="flex justify-between"><span className="text-slate-600">Total Missions:</span><span className="text-blue-500">{userDetailData.campaigns.length}</span></div>
                  </div>
               </div>

               <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 col-span-2">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">User Missions (Campaigns)</h4>
                  <div className="space-y-4">
                     {userDetailData.campaigns.length === 0 ? (
                       <p className="text-slate-600 text-xs italic">No mission data recorded for this node.</p>
                     ) : (
                       userDetailData.campaigns.map(c => (
                         <div key={c.id} className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                           <div>
                              <div className="text-sm font-black text-white italic">{c.name}</div>
                              <div className="text-[9px] text-slate-600 uppercase tracking-widest">{c.mode} • {new Date(c.createdAt).toLocaleDateString()}</div>
                           </div>
                           <div className="text-right">
                              <div className="text-blue-500 font-black text-xs">{c.stats.sent} Sent</div>
                              <div className="text-[9px] text-emerald-500 font-bold">{c.stats.opened} Opened</div>
                           </div>
                         </div>
                       ))
                     )}
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 rounded-[3rem] border border-slate-800 overflow-hidden">
               <div className="px-10 py-6 bg-slate-950 border-b border-slate-800">
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Recent Node Transmissions</h4>
               </div>
               <table className="w-full text-left font-mono text-[10px]">
                  <thead className="text-slate-600 uppercase">
                     <tr>
                        <th className="px-10 py-4">Recipient</th>
                        <th className="px-10 py-4">Subject</th>
                        <th className="px-10 py-4">Status</th>
                        <th className="px-10 py-4 text-right">Timestamp</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {userDetailData.emails.slice(0, 20).map((e, idx) => (
                       <tr key={idx} className="hover:bg-slate-950/40">
                          <td className="px-10 py-4 text-white">{e.recipient}</td>
                          <td className="px-10 py-4 text-slate-500 truncate max-w-[200px]">{e.subject}</td>
                          <td className="px-10 py-4">
                             <span className={e.status === 'SENT' ? 'text-emerald-500' : 'text-red-500'}>{e.status}</span>
                             {e.opened && <span className="ml-2 text-blue-400">[OPENED]</span>}
                          </td>
                          <td className="px-10 py-4 text-right text-slate-600">{new Date(e.timestamp).toLocaleTimeString()}</td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {view === 'SENT' && (
           <div className="bg-slate-900 rounded-[3rem] border border-slate-800 overflow-hidden shadow-2xl">
              <div className="px-10 py-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                 <h4 className="text-[11px] font-black text-white uppercase tracking-widest italic">Global Dispatch Ledger (Last 100)</h4>
                 <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Master Logs • Encrypted Stream</div>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left font-mono text-[10px]">
                    <thead className="bg-slate-950 text-slate-700 uppercase tracking-widest">
                       <tr>
                          <th className="px-10 py-6">Mission ID</th>
                          <th className="px-10 py-6">Node</th>
                          <th className="px-10 py-6">Recipient</th>
                          <th className="px-10 py-6">Status</th>
                          <th className="px-10 py-6 text-right">Dispatch Time</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                       {sentEmails.slice(0, 100).map((e, i) => (
                          <tr key={i} className="hover:bg-slate-950/40 transition-colors">
                             <td className="px-10 py-6 text-slate-500 italic">{e.campaignId.slice(0, 10)}...</td>
                             <td className="px-10 py-6 text-blue-500 font-bold">{e.businessName || 'UNKNOWN'}</td>
                             <td className="px-10 py-6 text-white">{e.recipient}</td>
                             <td className="px-10 py-6">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${
                                   e.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                }`}>
                                   {e.status}
                                </span>
                                {e.opened && <span className="ml-2 text-blue-500 font-black animate-pulse">[OPENED]</span>}
                             </td>
                             <td className="px-10 py-6 text-right text-slate-600">{new Date(e.timestamp).toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {view === 'CAMPAIGNS' && (
           <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                 <thead>
                    <tr className="text-slate-700 text-[9px] font-black uppercase tracking-[0.4em] px-8">
                       <th className="pb-6 px-8">Mission Name</th>
                       <th className="pb-6 px-8">Mode</th>
                       <th className="pb-6 px-8">Yield</th>
                       <th className="pb-6 px-8">Opens</th>
                       <th className="pb-6 px-8 text-right">Owner Node</th>
                    </tr>
                 </thead>
                 <tbody>
                    {campaigns.map(c => {
                       const stats = backendService.getCampaignStats(c.id);
                       return (
                          <tr key={c.id} className="bg-slate-900/40 hover:bg-slate-900 transition-all group">
                             <td className="py-6 px-8 rounded-l-[2rem] font-black text-white italic border-l border-slate-800">{c.name}</td>
                             <td className="py-6 px-8">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${c.mode === 'AI_CUSTOM' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>{c.mode}</span>
                             </td>
                             <td className="py-6 px-8 font-mono text-blue-500 font-bold">{stats.sent} Sent</td>
                             <td className="py-6 px-8 font-mono text-emerald-500 font-bold">{stats.opened} ({stats.openRate}%)</td>
                             <td className="py-6 px-8 text-right rounded-r-[2rem] border-r border-slate-800 text-slate-500 text-[10px]">{c.userId}</td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
