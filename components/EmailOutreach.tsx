
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, OutreachLead, SentEmail, Campaign, DraftEmail } from '../types.ts';
import { backendService } from '../services/backendService.ts';
import { processOutreachWithAgent, validateEmailsAgent } from '../geminiService.ts';
import { smtpService } from '../services/smtpService.ts';

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
  const [leads, setLeads] = useState< OutreachLead[]>([]);
  const [drafts, setDrafts] = useState<DraftEmail[]>([]);
  const [subject, setSubject] = useState('Personalized SEO Strategy for {Business_Name}');
  const [body, setBody] = useState('Hi {Business_Name},\n\nI was reviewing {Website} and noticed a few SEO issues that are likely holding back your rankings.\n\nWould you be open to a quick chat about fixing these?\n\nBest,\n[Your Name]');
  
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transmissionLogs]);

  const historicalCampaigns = useMemo(() => {
    return backendService.getCampaigns(user.id).filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [user.id, searchQuery]);

  const resetFlow = () => {
    isAbortedRef.current = false;
    setCampaignName('');
    setLeads([]);
    setDrafts([]);
    setProgress(0);
    setTransmissionLogs([]);
    setErrorDetail(null);
    setIsScheduled(false);
    setScheduledDateTime('');
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

  const runMailValidator = async () => {
    if (leads.length === 0) return;
    setIsValidating(true);
    setStep('VALIDATION');
    try {
      const validated = await validateEmailsAgent(leads);
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
        const res = await processOutreachWithAgent(lead, user.emailConnection?.email || user.email, subject, body, mode);
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

    if (isScheduled) {
      if (!scheduledDateTime) {
        alert("Please specify a dispatch timestamp.");
        return;
      }
      const campaign: Campaign = {
        id: campaignId,
        userId: user.id,
        name: campaignName,
        mode,
        fileName: 'manual_ingest.csv',
        senderEmail: user.emailConnection?.email || user.email,
        scheduledTime: scheduledDateTime,
        stats: { total: drafts.length, sent: 0, failed: 0, pending: drafts.length, opened: 0 },
        verificationHash: 'V-' + Math.random().toString(36).substr(2, 6),
        createdAt: new Date().toISOString(),
        status: 'SCHEDULED'
      };
      backendService.saveCampaign(campaign);
      drafts.forEach(draft => {
        backendService.logSentEmail({
            id: `SCH-${Math.random().toString(36).substr(2, 6)}`,
            campaignId,
            recipient: draft.recipient,
            businessName: draft.businessName,
            subject: draft.subject,
            body: draft.body,
            status: 'SCHEDULED',
            opened: false,
            timestamp: new Date().toISOString(),
            scheduledTime: scheduledDateTime
        });
      });
      setResults(backendService.getCampaignStats(campaignId));
      setStep('SUMMARY');
      return;
    }

    setStep('SENDING');
    setProgress(0);
    setTransmissionLogs([`Broadcasting mission: ${campaignName}`]);
    isAbortedRef.current = false;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < drafts.length; i++) {
      if (isAbortedRef.current) break;
      const draft = drafts[i];
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
            subject: draft.subject,
            body: draft.body,
            status: 'SENT',
            opened: false,
            timestamp: new Date().toISOString()
          });
          setTransmissionLogs(prev => [...prev, `🚀 ACK: ${draft.recipient}`]);
        } else { throw new Error(res.error); }
      } catch (err: any) {
        failedCount++;
        setTransmissionLogs(prev => [...prev, `❌ FAIL: ${draft.recipient} - ${err.message}`]);
      }
      setProgress(Math.round(((i + 1) / drafts.length) * 100));
    }

    if (!isAbortedRef.current) {
      const campaign: Campaign = {
        id: campaignId,
        userId: user.id,
        name: campaignName,
        mode,
        fileName: 'broadcast.csv',
        senderEmail: user.emailConnection?.email || user.email,
        stats: { total: drafts.length, sent: sentCount, failed: failedCount, pending: 0, opened: 0 },
        verificationHash: 'V-' + Math.random().toString(36).substr(2, 6),
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
          <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">Archives</h2>
          <p className="text-slate-500 text-lg">Broadcast matrix ledger.</p>
        </div>
        <button onClick={resetFlow} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-2xl active:scale-95">New Mission</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {historicalCampaigns.map(c => {
          const stats = backendService.getCampaignStats(c.id);
          return (
            <div key={c.id} onClick={() => { setSelectedCampaignId(c.id); setStep('CAMPAIGN_DETAIL'); }} className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 hover:border-blue-600 transition-all cursor-pointer group">
               <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-8 truncate group-hover:text-blue-500">{c.name}</h3>
               <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
                 <div className="text-emerald-500">{stats.openRate}% Opened</div>
                 <div className="text-white">{stats.sent} Sent</div>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDetail = () => {
    const campaign = historicalCampaigns.find(c => c.id === selectedCampaignId);
    if (!campaign) return null;
    const stats = backendService.getCampaignStats(campaign.id);
    return (
      <div className="animate-in fade-in py-12 px-6 text-white">
        <button onClick={() => setStep('HISTORY')} className="text-slate-500 hover:text-white mb-12 text-[10px] font-black uppercase tracking-widest">← Back</button>
        <h2 className="text-7xl font-black uppercase italic tracking-tighter mb-8">{campaign.name}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-16">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800">
             <div className="text-[10px] text-slate-500 uppercase mb-2">Sent</div>
             <div className="text-4xl font-black">{stats.sent}</div>
          </div>
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800">
             <div className="text-[10px] text-slate-500 uppercase mb-2">Opened</div>
             <div className="text-4xl font-black text-emerald-500">{stats.opened}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto mb-24 animate-in fade-in">
      <div className="bg-slate-950 rounded-[4rem] shadow-2xl border border-slate-800 overflow-hidden min-h-[800px] flex flex-col">
        <div className="bg-slate-900 px-12 py-10 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Campaign Engine</h2>
          {isVerified && <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest italic animate-pulse">• Relay Operational</div>}
        </div>
        <div className="flex-1 overflow-y-auto">
          {step === 'HISTORY' && renderHistory()}
          {step === 'CAMPAIGN_DETAIL' && renderDetail()}
          {step === 'AUTH_GATE' && (
            <div className="max-w-3xl mx-auto py-24 px-6 text-center">
               <h3 className="text-5xl font-black text-white uppercase italic mb-8">Gmail Authorization</h3>
               <textarea value={accessToken} onChange={e => setAccessToken(e.target.value)} className="w-full h-40 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-blue-500 font-mono text-sm mb-8" placeholder="Paste OAuth Access Token..." />
               <button onClick={handleVerifyConnection} className="w-full bg-blue-600 text-white py-8 rounded-[2rem] font-black uppercase tracking-widest shadow-xl">Initialize Socket</button>
            </div>
          )}
          {step === 'INTAKE' && (
            <div className="max-w-3xl mx-auto py-24 px-6">
              <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-white font-black italic text-2xl mb-8" placeholder="Mission Name..." />
              <div onClick={() => fileInputRef.current?.click()} className="p-20 border-2 border-dashed border-slate-800 bg-slate-950 rounded-3xl text-center cursor-pointer mb-12">
                 <input type="file" ref={fileInputRef} className="hidden" onChange={e => {
                   const file = e.target.files?.[0];
                   if (file) {
                     const r = new FileReader();
                     r.onload = ev => {
                       const txt = ev.target?.result as string;
                       const ls = txt.split('\n').filter(l => l.includes('@')).map(l => ({ email: l.trim(), validationStatus: 'UNCHECKED' as const }));
                       setLeads(ls);
                     };
                     r.readAsText(file);
                   }
                 }} />
                 <p className="text-slate-500 font-black uppercase tracking-widest italic">Upload CSV Dataset ({leads.length} leads loaded)</p>
              </div>
              <button onClick={runMailValidator} className="w-full bg-emerald-600 text-white py-8 rounded-[2rem] font-black uppercase tracking-widest">Verify Nodes</button>
            </div>
          )}
          {step === 'VALIDATION' && (
            <div className="max-w-3xl mx-auto py-24 text-center">
               {isValidating ? <p className="text-white animate-pulse">Scanning records...</p> : (
                 <button onClick={() => setStep('OPTIONS')} className="bg-blue-600 text-white px-20 py-8 rounded-full font-black uppercase tracking-widest">Proceed to Strategy</button>
               )}
            </div>
          )}
          {step === 'OPTIONS' && (
             <div className="max-w-3xl mx-auto py-24 grid grid-cols-2 gap-8 px-6">
                <div onClick={() => { setMode('AI_CUSTOM'); setStep('CONFIG'); }} className="bg-slate-900 p-12 rounded-3xl border border-slate-800 cursor-pointer hover:border-blue-600 text-center">
                  <h4 className="text-2xl font-black text-white uppercase italic">AI Bespoke</h4>
                </div>
                <div onClick={() => { setMode('MANUAL'); setStep('CONFIG'); }} className="bg-slate-900 p-12 rounded-3xl border border-slate-800 cursor-pointer hover:border-white text-center">
                  <h4 className="text-2xl font-black text-white uppercase italic">Template</h4>
                </div>
             </div>
          )}
          {step === 'CONFIG' && (
             <div className="max-w-3xl mx-auto py-24 px-6 space-y-8">
               <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white font-bold italic" />
               <textarea value={body} onChange={e => setBody(e.target.value)} className="w-full h-80 bg-slate-900 border border-slate-800 rounded-3xl p-10 text-white" />
               <button onClick={generateDrafts} className="w-full bg-blue-600 text-white py-8 rounded-[2rem] font-black uppercase tracking-widest">Generate Drafts</button>
             </div>
          )}
          {step === 'GENERATING' && <div className="py-40 text-center text-white animate-pulse">Analyzing profiles... {progress}%</div>}
          {step === 'REVIEW' && (
             <div className="py-12 px-12 space-y-12">
               <button onClick={executeDispatch} className="w-full bg-emerald-600 text-white py-10 rounded-full font-black uppercase tracking-[0.5em]">Authorize Broadcast</button>
               <div className="space-y-4 max-h-[500px] overflow-y-auto">
                 {drafts.map((d, i) => <div key={i} className="bg-slate-900 p-8 rounded-3xl border border-slate-800 text-slate-400 text-xs">{d.recipient}: {d.subject}</div>)}
               </div>
             </div>
          )}
          {step === 'SENDING' && <div className="py-40 text-center text-white font-black text-4xl italic animate-pulse">Dispatching... {progress}%</div>}
          {step === 'SUMMARY' && results && (
            <div className="py-40 text-center">
               <h3 className="text-8xl font-black text-white italic uppercase tracking-tighter mb-8">Mission Complete</h3>
               <button onClick={resetFlow} className="bg-blue-600 text-white px-16 py-8 rounded-full font-black uppercase tracking-widest">Return to Base</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailOutreach;
