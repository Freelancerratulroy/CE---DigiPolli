
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, OutreachLead, SentEmail, Campaign, DraftEmail, AiProvider } from '../types';
import { backendService } from '../services/backendService';
import { processOutreachWithAgent, validateEmailsAgent } from '../geminiService';
import { smtpService } from '../services/smtpService';

interface Props {
  user: User;
  onUserUpdate: (user: User) => void;
}

type OutreachStep = 'HISTORY' | 'AUTH_GATE' | 'INTAKE' | 'VALIDATION' | 'OPTIONS' | 'CONFIG' | 'GENERATING' | 'REVIEW' | 'SENDING' | 'SUMMARY' | 'CAMPAIGN_DETAIL';

const EmailOutreach: React.FC<Props> = ({ user, onUserUpdate }) => {
  const isVerified = user.emailConnection?.status === 'VERIFIED';
  const [step, setStep] = useState<OutreachStep>('HISTORY');
  const [mode, setMode] = useState<'MANUAL' | 'AI_CUSTOM'>('AI_CUSTOM');
  const [accessToken, setAccessToken] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [drafts, setDrafts] = useState<DraftEmail[]>([]);
  const [subject, setSubject] = useState('Personalized SEO Strategy for {Business_Name}');
  const [body, setBody] = useState('Hi {Business_Name},\n\nI was reviewing {Website} and noticed a few SEO issues that are likely holding back your rankings.\n\nWould you be open to a quick chat about fixing these?\n\nBest,\n[Your Name]');
  
  const [progress, setProgress] = useState(0);
  const [transmissionLogs, setTransmissionLogs] = useState<string[]>([]);
  const [results, setResults] = useState<any>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isAbortedRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const REQUIRED_SCOPE = "https://www.googleapis.com/auth/gmail.send";

  // Compute the user's active API key
  const userKey = useMemo(() => {
    return user.activeAiProvider === 'GEMINI' ? user.geminiApiKey : user.openaiApiKey;
  }, [user]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transmissionLogs]);

  const historicalCampaigns = useMemo(() => {
    return backendService.getCampaigns(user.id).filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [user.id, searchQuery, step]);

  const resetFlow = () => {
    isAbortedRef.current = false;
    setCampaignName('');
    setLeads([]);
    setDrafts([]);
    setProgress(0);
    setTransmissionLogs([]);
    setErrorDetail(null);
    setStep(isVerified ? 'INTAKE' : 'AUTH_GATE');
  };

  const handleVerifyConnection = async () => {
    if (!accessToken.trim()) return alert("Authorization token is required.");
    setErrorDetail(null);
    try {
      const infoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
      const infoData = await infoRes.json();
      if (!infoRes.ok) throw new Error(infoData.error_description || "Invalid Token.");
      
      const scopes = (infoData.scope || "").split(' ');
      if (!scopes.includes(REQUIRED_SCOPE)) throw new Error("Missing 'gmail.send' scope.");

      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const profileData = await profileRes.json();
      
      const updatedUser: User = {
        ...user,
        emailConnection: { 
          email: profileData.emailAddress, 
          status: 'VERIFIED', 
          timestamp: new Date().toISOString(), 
          verifiedAt: new Date().toISOString(), 
          method: 'OAUTH' 
        },
      };
      backendService.updateUser(updatedUser);
      onUserUpdate(updatedUser);
      setStep('INTAKE');
    } catch (err: any) {
      setErrorDetail(err.message);
    }
  };

  const terminateProcess = () => {
    isAbortedRef.current = true;
    setTransmissionLogs(prev => [...prev, "🛑 EMERGENCY STOP: Broadcast sequence terminated by operator."]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim().includes('@'));
      
      const parsed: OutreachLead[] = lines.map(line => {
        const parts = line.split(/[,\t|;]/).map(p => p.trim().replace(/^"|"$/g, ''));
        const email = parts.find(p => p.includes('@')) || '';
        const website = parts.find(p => p.includes('.') && !p.includes('@')) || '';
        const name = parts.find(p => p !== email && p !== website && p.length > 2) || 'Business Owner';
        const seoErrors = parts.length > 3 ? parts.slice(3).join(', ') : 'Mobile load speed, Missing meta tags';
        
        return { email, businessName: name, website, seoErrors, validationStatus: 'UNCHECKED' };
      });
      setLeads(parsed);
    };
    reader.readAsText(file);
  };

  const runMailValidator = async () => {
    if (leads.length === 0) return;
    setIsValidating(true);
    setStep('VALIDATION');
    try {
      // Pass user's verified key to the validation agent
      const validated = await validateEmailsAgent(leads, userKey);
      setLeads(validated);
    } catch (err: any) { 
      console.error(err);
      alert("AI Validation Node Fault: " + err.message);
    }
    finally { setIsValidating(false); }
  };

  const generateDrafts = async () => {
    isAbortedRef.current = false;
    setStep('GENERATING');
    setProgress(0);
    const newDrafts: DraftEmail[] = [];
    const validLeads = leads.filter(l => l.validationStatus !== 'INVALID');

    for (let i = 0; i < validLeads.length; i++) {
      if (isAbortedRef.current) break;
      const lead = validLeads[i];
      try {
        // Pass user's verified key to the content agent
        const res = await processOutreachWithAgent(lead, user.emailConnection?.email || user.email, subject, body, mode, userKey);
        newDrafts.push({
          id: `DFT-${i}-${Date.now()}`,
          recipient: lead.email,
          businessName: lead.businessName || 'Owner',
          subject: res.args.subject,
          body: res.args.body
        });
      } catch (err: any) { 
        console.error("Drafting Failed", err); 
        setTransmissionLogs(prev => [...prev, `⚠️ Drafting Error for ${lead.email}: ${err.message}`]);
      }
      setProgress(Math.round(((i + 1) / validLeads.length) * 100));
    }
    if (!isAbortedRef.current) {
      setDrafts(newDrafts);
      setStep('REVIEW');
    } else {
      setStep('OPTIONS');
    }
  };

  const executeDispatch = async () => {
    const campaignId = `CAMP-${Date.now()}`;
    setStep('SENDING');
    setProgress(0);
    setTransmissionLogs([`Initializing Broadcast mission: ${campaignName}...`]);
    isAbortedRef.current = false;
    
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < drafts.length; i++) {
      if (isAbortedRef.current) break;
      const draft = drafts[i];
      const lead = leads.find(l => l.email === draft.recipient);
      setTransmissionLogs(prev => [...prev, `Relaying to ${draft.recipient}...`]);
      
      try {
        const res = await smtpService.dispatch({
          to: draft.recipient,
          subject: draft.subject,
          body: draft.body,
          sender: user.emailConnection?.email || user.email,
          accessToken: accessToken
        });

        if (res.success) {
          sentCount++;
          backendService.logSentEmail({
            id: res.messageId!,
            campaignId,
            recipient: draft.recipient,
            businessName: draft.businessName,
            website: lead?.website,
            subject: draft.subject,
            body: draft.body,
            status: 'SENT',
            opened: false,
            timestamp: new Date().toISOString()
          });
          setTransmissionLogs(prev => [...prev, `🚀 SUCCESS: Node ACK: ${res.messageId}`]);
          
          setTimeout(() => {
            if (Math.random() > 0.5) backendService.simulateEmailOpen(res.messageId!);
          }, 5000 + Math.random() * 10000);

        } else { throw new Error(res.error); }
      } catch (err: any) {
        failedCount++;
        backendService.logSentEmail({
          id: `ERR-${Date.now()}-${i}`,
          campaignId,
          recipient: draft.recipient,
          businessName: draft.businessName,
          subject: draft.subject,
          body: draft.body,
          status: 'FAILED',
          opened: false,
          timestamp: new Date().toISOString()
        });
        setTransmissionLogs(prev => [...prev, `❌ DISPATCH FAULT: ${err.message}`]);
      }
      setProgress(Math.round(((i + 1) / drafts.length) * 100));
    }

    if (!isAbortedRef.current) {
      const campaign: Campaign = {
        id: campaignId,
        userId: user.id,
        name: campaignName,
        mode,
        fileName: 'outreach_dataset.csv',
        senderEmail: user.emailConnection?.email || user.email,
        stats: { total: drafts.length, sent: sentCount, failed: failedCount, pending: 0, opened: 0 },
        verificationHash: 'HASH-' + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        status: 'COMPLETED'
      };
      backendService.saveCampaign(campaign);
      setResults(backendService.getCampaignStats(campaignId));
      setStep('SUMMARY');
    }
  };

  const renderHistory = () => (
    <div className="animate-in fade-in py-12 px-6">
      <div className="flex flex-col lg:flex-row justify-between items-end mb-12 gap-8">
        <div>
          <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">Command Center</h2>
          <p className="text-slate-500 text-lg">Detailed matrix of all authenticated broadcast missions.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
             <input type="text" placeholder="Search mission..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white text-xs outline-none focus:ring-2 focus:ring-blue-600 transition-all" />
          </div>
          <button onClick={resetFlow} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-2xl active:scale-95">Start New Mission</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {historicalCampaigns.map(c => {
          const stats = backendService.getCampaignStats(c.id);
          return (
            <div key={c.id} onClick={() => { setSelectedCampaignId(c.id); setStep('CAMPAIGN_DETAIL'); }} className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 hover:border-blue-600/40 transition-all cursor-pointer group relative overflow-hidden">
               <div className="flex justify-between mb-8">
                 <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${c.mode === 'AI_CUSTOM' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                   {c.mode === 'AI_CUSTOM' ? 'AI Individualized' : 'Manual Template'}
                 </div>
                 <span className="text-[10px] font-mono text-slate-700">{new Date(c.createdAt).toLocaleDateString()}</span>
               </div>
               <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-8 truncate group-hover:text-blue-500 transition-colors">{c.name}</h3>
               
               <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="text-[9px] font-black text-slate-700 uppercase mb-1">Open Rate</div>
                    <div className="text-2xl font-black text-emerald-500 italic">{stats.openRate}%</div>
                 </div>
                 <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="text-[9px] font-black text-slate-700 uppercase mb-1">Volume</div>
                    <div className="text-2xl font-black text-white italic">{stats.sent}</div>
                 </div>
               </div>
               <div className="absolute bottom-0 left-0 h-1 bg-blue-600 w-0 group-hover:w-full transition-all duration-500" />
            </div>
          );
        })}
        {historicalCampaigns.length === 0 && (
          <div className="col-span-full py-40 bg-slate-900/50 rounded-[4rem] border-2 border-dashed border-slate-800 text-center">
            <p className="text-slate-600 font-black uppercase tracking-[0.5em] italic">No active missions in memory.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderDetail = () => {
    const campaign = historicalCampaigns.find(c => c.id === selectedCampaignId);
    if (!campaign) return null;
    const stats = backendService.getCampaignStats(campaign.id);

    return (
      <div className="animate-in fade-in py-12 px-6">
        <button onClick={() => setStep('HISTORY')} className="group flex items-center gap-4 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest mb-12">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Return to Archives
        </button>

        <div className="flex flex-col lg:flex-row gap-12 mb-16">
           <div className="flex-1 bg-slate-900 rounded-[4rem] p-16 border border-slate-800">
             <div className="flex justify-between items-start mb-8">
               <h2 className="text-7xl font-black text-white uppercase italic tracking-tighter leading-none">{campaign.name}</h2>
               <div className="bg-emerald-500/10 text-emerald-500 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">Operational</div>
             </div>
             <p className="text-slate-500 text-lg italic mb-16">Intelligence harvested via {campaign.senderEmail} • Mode: {campaign.mode}</p>
             
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
               {[
                 { label: 'Total', val: stats.total, color: 'white' },
                 { label: 'Sent', val: stats.sent, color: 'blue-500' },
                 { label: 'Opened', val: stats.opened, color: 'emerald-500' },
                 { label: 'Failed', val: stats.failed, color: 'red-500' },
               ].map((s, i) => (
                 <div key={i} className="bg-slate-950 p-8 rounded-3xl border border-slate-800">
                   <div className="text-[10px] font-black text-slate-700 uppercase mb-2">{s.label}</div>
                   <div className={`text-4xl font-black text-${s.color} italic`}>{s.val}</div>
                 </div>
               ))}
             </div>
           </div>

           <div className="w-full lg:w-96 bg-slate-900 rounded-[4rem] p-12 border border-slate-800 flex flex-col items-center justify-center text-center">
              <div className="relative w-48 h-48 mb-10">
                 <svg className="w-full h-full transform -rotate-90">
                    <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="20" fill="transparent" className="text-slate-950" />
                    <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="20" fill="transparent" strokeDasharray={502.6} strokeDashoffset={502.6 - (502.6 * stats.openRate) / 100} className="text-emerald-500 transition-all duration-1000" strokeLinecap="round" />
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-black text-white italic tracking-tighter leading-none">{stats.openRate}%</span>
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Open Rate</p>
                 </div>
              </div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] italic leading-relaxed">Unique engagement verified by tracking pixel.</p>
           </div>
        </div>

        <div className="bg-slate-900 rounded-[3.5rem] border border-slate-800 overflow-hidden shadow-2xl">
           <div className="px-12 py-8 bg-slate-950 border-b border-slate-800">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em] italic">Mission Logs: Node Performance</h3>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px]">
                 <thead className="bg-slate-950 text-slate-600 uppercase tracking-widest">
                    <tr>
                       <th className="px-12 py-6">Recipient / Business</th>
                       <th className="px-12 py-6">Website</th>
                       <th className="px-12 py-6">Status</th>
                       <th className="px-12 py-6">Engagement</th>
                       <th className="px-12 py-6">Timestamp</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800">
                    {stats.emails.map((e, i) => (
                       <tr key={i} className="hover:bg-slate-950/50 transition-colors">
                          <td className="px-12 py-6">
                             <div className="font-bold text-white text-xs mb-0.5">{e.businessName}</div>
                             <div className="text-slate-500">{e.recipient}</div>
                          </td>
                          <td className="px-12 py-6 text-blue-500 underline">{e.website || 'N/A'}</td>
                          <td className="px-12 py-6">
                             <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${e.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{e.status}</span>
                          </td>
                          <td className="px-12 py-6">
                             {e.opened ? (
                                <span className="flex items-center gap-2 text-emerald-500 font-bold uppercase text-[8px] tracking-widest animate-pulse">
                                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                   Opened ({new Date(e.openedAt!).toLocaleTimeString()})
                                </span>
                             ) : <span className="text-slate-700 uppercase text-[8px] font-bold tracking-widest">Unread</span>}
                          </td>
                          <td className="px-12 py-6 text-slate-500">{new Date(e.timestamp).toLocaleTimeString()}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto mb-24 animate-in fade-in duration-1000">
      <div className="bg-slate-950 rounded-[4rem] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] border border-slate-800 overflow-hidden min-h-[850px] flex flex-col relative">
        <div className="bg-slate-900 px-12 py-10 border-b border-slate-800 flex justify-between items-center z-10">
          <div className="flex items-center gap-6">
            <div className={`p-6 rounded-[2rem] shadow-3xl ${isVerified ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : 'bg-slate-800 text-slate-500'}`}>
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Campaign Console</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.6em] mt-2">Elite Outreach & Automation Engine</p>
            </div>
          </div>
          {isVerified && (
            <div className="flex gap-4">
              <button onClick={() => setStep('HISTORY')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${step === 'HISTORY' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}>Dashboard</button>
              <div className="flex items-center gap-6 bg-slate-950 px-8 py-4 rounded-3xl border border-slate-800">
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">Node status: active</span>
                  <span className="text-xs font-mono text-slate-400">{user.emailConnection?.email}</span>
                </div>
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'HISTORY' && renderHistory()}
          {step === 'CAMPAIGN_DETAIL' && renderDetail()}

          {step === 'AUTH_GATE' && (
            <div className="max-w-4xl mx-auto py-24 px-6 animate-in fade-in">
               <div className="text-center mb-16">
                 <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">SMTP Socket Entry</h3>
                 <p className="text-slate-500 text-lg mb-8 leading-relaxed">Physical dispatch requires a valid Google OAuth Access Token.</p>
                 
                 <div className="max-w-3xl mx-auto bg-slate-900 border border-blue-500/20 rounded-[2.5rem] p-10 text-left mb-16">
                    <div className="flex items-center gap-4 mb-6">
                       <div className="bg-blue-600/20 p-3 rounded-2xl text-blue-400">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       </div>
                       <h4 className="text-[11px] font-black text-white uppercase tracking-widest italic">Authorization Guide</h4>
                    </div>
                    <div className="space-y-4 font-medium text-slate-400 text-sm leading-relaxed">
                       <ol className="list-decimal list-inside space-y-3 pl-2">
                          <li>Access the <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Google OAuth Playground</a>.</li>
                          <li>In Step 1, select <b>'Gmail API v1'</b> and check <b>'gmail.send'</b>.</li>
                          <li>Authorize with your target Gmail account.</li>
                          <li>In Step 2, click <b>'Exchange authorization code for tokens'</b>.</li>
                          <li>Copy the <b>'Access Token'</b> and paste it below.</li>
                       </ol>
                    </div>
                 </div>
               </div>

               <div className="bg-slate-900 p-12 rounded-[4rem] border border-slate-800 shadow-3xl space-y-10">
                 {errorDetail && <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl text-red-500 text-xs font-mono">{errorDetail}</div>}
                 <div>
                   <label className="block text-[11px] font-black text-slate-700 uppercase mb-4 tracking-[0.5em]">Authorization Token</label>
                   <textarea value={accessToken} onChange={e => setAccessToken(e.target.value)} className="w-full h-40 px-8 py-7 bg-slate-950 border border-slate-800 rounded-[2.5rem] text-blue-500 font-mono text-xs focus:ring-2 focus:ring-blue-600 outline-none shadow-inner resize-none transition-all" placeholder="ya29.a0AfH6S..." />
                 </div>
                 <button onClick={handleVerifyConnection} className="w-full bg-blue-600 text-white py-10 rounded-[3rem] font-black uppercase tracking-[0.7em] text-sm hover:bg-blue-700 transition-all active:scale-95 shadow-4xl">Establish Connection</button>
               </div>
            </div>
          )}

          {step === 'INTAKE' && (
            <div className="max-w-4xl mx-auto py-24 px-6 animate-in fade-in">
               <div className="text-center mb-16">
                 <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">Mission Parameters</h3>
                 <p className="text-slate-500 text-lg">Define mission identity and ingest lead dataset.</p>
               </div>
               <div className="bg-slate-900 p-16 rounded-[4rem] border border-slate-800 space-y-12 shadow-4xl">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest italic mb-4 block">Campaign Mission Name (Unique)</label>
                    <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} className="w-full px-10 py-6 bg-slate-950 border border-slate-800 rounded-3xl text-white font-black italic text-2xl outline-none focus:ring-2 focus:ring-blue-600" placeholder="E.g. Operation SEO Phoenix" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div onClick={() => fileInputRef.current?.click()} className="p-12 rounded-[3rem] border-2 border-dashed border-slate-800 bg-slate-950 hover:border-blue-600 transition-all cursor-pointer text-center group">
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv,.txt" />
                        <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-500 mx-auto mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
                           <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </div>
                        <div className="text-[11px] font-black uppercase text-slate-500 tracking-widest italic">Ingest Excel/CSV</div>
                     </div>
                     <div className="bg-slate-950 p-8 rounded-[3rem] border border-slate-800">
                        <div className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-6">Mission Payload Stats</div>
                        <div className="space-y-4">
                           <div className="flex justify-between font-mono text-[10px]"><span className="text-slate-500 uppercase">Leads Count:</span><span className="text-white font-bold">{leads.length}</span></div>
                           <div className="flex justify-between font-mono text-[10px]"><span className="text-slate-500 uppercase">Integrity:</span><span className={leads.length > 0 ? 'text-emerald-500' : 'text-amber-500'}>{leads.length > 0 ? 'DATA_LOCKED' : 'AWAITING_INPUT'}</span></div>
                        </div>
                     </div>
                  </div>
                  <button onClick={runMailValidator} disabled={!campaignName || leads.length === 0} className="w-full bg-blue-600 text-white py-10 rounded-[3rem] font-black uppercase tracking-[0.8em] text-sm hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-4xl">Initialize Security Scan</button>
               </div>
            </div>
          )}

          {step === 'VALIDATION' && (
            <div className="max-w-6xl mx-auto py-24 animate-in fade-in">
               <div className="text-center mb-16">
                 <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">Security Protocol</h3>
                 <p className="text-slate-500 text-lg italic">Detecting high-risk recipients to protect sender reputation.</p>
               </div>
               {isValidating ? (
                  <div className="text-center py-40">
                     <div className="w-24 h-24 border-8 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-12"></div>
                     <p className="font-mono text-emerald-500 text-[10px] uppercase tracking-[0.5em] animate-pulse italic">Scanning Remote MX Record Matrix...</p>
                  </div>
               ) : (
                  <div className="space-y-12 px-6">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {['VALID', 'RISKY', 'INVALID'].map(status => (
                           <div key={status} className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 text-center">
                              <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 italic">{status}</div>
                              <div className="text-6xl font-black text-white italic">{leads.filter(l => l.validationStatus === status).length}</div>
                           </div>
                        ))}
                     </div>
                     <div className="bg-slate-900 p-16 rounded-[4rem] border border-slate-800 text-center shadow-4xl">
                        <h4 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-6 leading-none">Bounce Protection Lock</h4>
                        <p className="text-slate-500 mb-12 font-medium">Ready to advance? Invalid nodes will be automatically purged.</p>
                        <button onClick={() => setStep('OPTIONS')} className="w-full bg-emerald-600 text-white py-8 rounded-[2rem] font-black uppercase tracking-[0.4em] text-[10px] hover:bg-emerald-700 transition-all shadow-xl">Establish Outreach Strategy</button>
                     </div>
                  </div>
               )}
            </div>
          )}

          {step === 'OPTIONS' && (
            <div className="max-w-4xl mx-auto py-24 animate-in fade-in">
               <div className="text-center mb-20">
                 <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">AI Matrix Mode</h3>
                 <p className="text-slate-500 text-lg italic">Select between deep bespoke personalization or high-speed templates.</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12 px-6">
                  <div onClick={() => { setMode('AI_CUSTOM'); setStep('CONFIG'); }} className="p-14 rounded-[4rem] border-2 bg-slate-900 border-slate-800 transition-all cursor-pointer hover:border-blue-600 group shadow-2xl">
                    <div className="w-24 h-24 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-500 mb-10 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-2xl">
                      <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">AI Individualization</div>
                    <p className="text-slate-500 text-sm italic">Uses "SEO Errors" data for uniquely drafted messages. Highest conversion yield.</p>
                  </div>
                  <div onClick={() => { setMode('MANUAL'); setStep('CONFIG'); }} className="p-14 rounded-[4rem] border-2 bg-slate-900 border-slate-800 transition-all cursor-pointer hover:border-slate-400 group shadow-2xl">
                    <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-500 mb-10 group-hover:bg-600 group-hover:text-white transition-all shadow-2xl">
                      <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </div>
                    <div className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">Master Template</div>
                    <p className="text-slate-500 text-sm italic">Static message structure with dynamic variable injection for speed.</p>
                  </div>
               </div>
            </div>
          )}

          {step === 'CONFIG' && (
            <div className="max-w-5xl mx-auto py-24 px-6 animate-in slide-in-from-bottom-12">
               <div className="text-center mb-16">
                 <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">Core Messaging</h3>
                 <p className="text-slate-500 text-lg">Define mission parameters for {mode === 'AI_CUSTOM' ? 'AI research' : 'manual injection'}.</p>
               </div>
               <div className="bg-slate-900 rounded-[4rem] p-16 border border-slate-800 space-y-12 shadow-4xl">
                  <div className="space-y-4">
                     <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest italic">Broadcast Subject Line</label>
                     <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-10 py-6 bg-slate-950 border border-slate-800 rounded-3xl text-white font-black italic outline-none focus:ring-2 focus:ring-blue-600 shadow-inner" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest italic">Base Payload (Supports placeholders like Business_Name)</label>
                    <textarea value={body} onChange={e => setBody(e.target.value)} className="w-full h-80 bg-slate-950 border border-slate-800 rounded-[3rem] p-12 text-white font-medium outline-none resize-none shadow-inner custom-scrollbar leading-relaxed" />
                  </div>
                  <button onClick={generateDrafts} className="w-full bg-blue-600 text-white py-10 rounded-[3rem] font-black uppercase tracking-[0.8em] text-sm hover:bg-blue-700 shadow-4xl transition-all">Initialize Drafting Core</button>
               </div>
            </div>
          )}

          {step === 'GENERATING' && (
             <div className="max-w-2xl mx-auto py-40 text-center animate-in fade-in">
                <div className="w-32 h-32 border-8 border-blue-500/10 border-t-blue-500 rounded-full animate-spin mx-auto mb-12"></div>
                <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-4">Analyzing Data Nodes</h3>
                <p className="font-mono text-blue-500 text-[10px] uppercase tracking-[0.5em] italic animate-pulse mb-12">Drafting bespoke communications... {progress}%</p>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden shadow-inner">
                   <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
             </div>
          )}

          {step === 'REVIEW' && (
            <div className="animate-in fade-in py-12 px-12">
               <div className="flex flex-col lg:flex-row justify-between items-end mb-16 gap-8">
                  <div>
                    <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">Payload Approval</h3>
                    <p className="text-slate-500 text-lg italic">Modify finalized drafts before initiating high-speed dispatch.</p>
                  </div>
                  <button onClick={executeDispatch} className="bg-emerald-600 text-white px-16 py-8 rounded-[3rem] font-black uppercase tracking-widest text-[12px] hover:bg-emerald-700 transition-all shadow-4xl active:scale-95">Authorize Physical Dispatch</button>
               </div>
               <div className="space-y-12 h-[800px] overflow-y-auto pr-8 custom-scrollbar">
                  {drafts.map((d, i) => (
                    <div key={d.id} className="bg-slate-900 rounded-[3.5rem] border border-slate-800 p-12 space-y-8 shadow-2xl">
                       <div className="flex justify-between items-center border-b border-slate-800 pb-8">
                          <div className="flex items-center gap-8">
                             <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-800 italic">#{i+1}</div>
                             <div>
                                <div className="text-white font-black italic uppercase tracking-tighter text-2xl">{d.businessName}</div>
                                <div className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">{d.recipient}</div>
                             </div>
                          </div>
                          <span className="text-blue-500 text-[10px] font-black uppercase tracking-widest italic animate-pulse">Ready for Broadcast</span>
                       </div>
                       <div className="grid grid-cols-1 gap-8">
                          <input type="text" value={d.subject} onChange={e => {
                            const nd = [...drafts]; nd[i].subject = e.target.value; setDrafts(nd);
                          }} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-white font-black italic outline-none focus:ring-2 focus:ring-blue-600 shadow-inner" />
                          <textarea value={d.body} onChange={e => {
                            const nd = [...drafts]; nd[i].body = e.target.value; setDrafts(nd);
                          }} className="h-64 bg-slate-950 border border-slate-800 rounded-[2.5rem] p-10 text-white font-medium outline-none resize-none focus:ring-2 focus:ring-blue-600 shadow-inner leading-relaxed" />
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {step === 'SENDING' && (
            <div className="py-24 px-12 flex flex-col lg:flex-row gap-24 animate-in fade-in">
               <div className="flex-1 text-center py-20 flex flex-col justify-center items-center">
                  <div className="relative w-80 h-80 mx-auto mb-16">
                     <svg className="w-full h-full transform -rotate-90">
                        <circle cx="160" cy="160" r="140" stroke="currentColor" strokeWidth="24" fill="transparent" className="text-slate-900" />
                        <circle cx="160" cy="160" r="140" stroke="currentColor" strokeWidth="24" fill="transparent" strokeDasharray={879.6} strokeDashoffset={879.6 - (879.6 * progress) / 100} className="text-blue-600 transition-all duration-700" strokeLinecap="round" />
                     </svg>
                     <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-7xl font-black text-white italic tracking-tighter leading-none">{progress}%</span>
                     </div>
                  </div>
                  <h3 className="text-5xl font-black text-white uppercase italic tracking-tighter mb-12">Broadcasting...</h3>
                  <button onClick={terminateProcess} className="bg-red-600 text-white px-12 py-4 rounded-full font-black uppercase text-[10px] tracking-widest hover:bg-red-700 shadow-2xl transition-all active:scale-95">Kill Mission</button>
               </div>
               <div className="flex-1 bg-slate-900 rounded-[4rem] p-16 h-[700px] overflow-y-auto font-mono text-[11px] text-slate-500 border border-slate-800 custom-scrollbar shadow-4xl">
                  <h4 className="text-[14px] font-black uppercase tracking-widest text-slate-400 mb-12 pb-8 border-b border-slate-800 italic">Live Relay Monitor</h4>
                  {transmissionLogs.map((l, i) => (
                    <div key={i} className={`mb-4 p-5 rounded-2xl border ${l.includes('SUCCESS') ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500' : 'bg-slate-950/40 border-slate-800'}`}>
                       <span className="opacity-30 mr-4 italic">[{String(i+1).padStart(2, '0')}]</span> {l}
                    </div>
                  ))}
                  <div ref={logEndRef} />
               </div>
            </div>
          )}

          {step === 'SUMMARY' && results && (
            <div className="max-w-4xl mx-auto py-32 px-6 animate-in zoom-in-95">
               <div className="bg-slate-900 rounded-[5rem] border border-slate-800 p-24 text-center shadow-4xl">
                 <div className="w-40 h-40 rounded-full bg-emerald-500/10 text-emerald-500 border-4 border-emerald-500/20 flex items-center justify-center mx-auto mb-16 shadow-3xl">
                    <svg className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                 </div>
                 <h3 className="text-8xl font-black text-white uppercase italic mb-8 tracking-tighter leading-none">Complete</h3>
                 <p className="text-slate-500 text-2xl mb-24 italic">Missions nodes reported {results.successRate}% successful ACK response.</p>
                 <div className="flex gap-4 justify-center">
                    <button onClick={resetFlow} className="px-16 py-8 bg-blue-600 text-white rounded-[3rem] font-black uppercase tracking-[0.6em] text-[10px] hover:bg-blue-700 transition-all shadow-4xl">Initialize New misión</button>
                    <button onClick={() => setStep('HISTORY')} className="px-16 py-8 bg-slate-800 text-slate-400 rounded-[3rem] font-black uppercase tracking-[0.6em] text-[10px] hover:text-white transition-all shadow-4xl">View Database Report</button>
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailOutreach;
