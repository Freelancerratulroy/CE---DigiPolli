
import React, { useState, useEffect } from 'react';
import { User, AiProvider } from '../types';
import { verifyApiKey } from '../geminiService';
import { backendService } from '../services/backendService';

interface Props {
  user: User;
  onSuccess: (updatedUser: User) => void;
}

// Fixed: Aligned with environment-provided AIStudio type to resolve declaration conflicts.
declare global {
  interface Window {
    readonly aistudio: AIStudio;
  }
}

const ApiKeyGate: React.FC<Props> = ({ user, onSuccess }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check current status on mount
  useEffect(() => {
    const checkKey = async () => {
      // Safely access globally defined aistudio
      if (await window.aistudio.hasSelectedApiKey()) {
        const res = await verifyApiKey('GEMINI');
        if (res.valid) {
          setIsSuccess(true);
          handleSuccess();
        }
      }
    };
    checkKey();
  }, []);

  const handleOpenSelector = async () => {
    setError(null);
    setIsVerifying(true);
    
    try {
      // Trigger the platform dialog
      await window.aistudio.openSelectKey();
      
      // As per instructions: Assume the key selection was successful after triggering openSelectKey()
      // Create a new instance right before verifying to ensure it uses the injected key.
      const result = await verifyApiKey('GEMINI');

      if (result.valid) {
        setIsSuccess(true);
        handleSuccess();
      } else {
        setError(result.error || "Handshake Rejected: Please select a valid API key from a paid project.");
        setIsVerifying(false);
      }
    } catch (err: any) {
      setError("Handshake Failed: Access to AI Studio nodes was interrupted.");
      setIsVerifying(false);
    }
  };

  const handleSuccess = () => {
    const updatedUser: User = {
      ...user,
      activeAiProvider: 'GEMINI',
      geminiKeyStatus: 'VERIFIED',
      apiKeyVerifiedAt: new Date().toISOString(),
    };
    backendService.updateUser(updatedUser);
    setTimeout(() => onSuccess(updatedUser), 1000);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 animate-in fade-in duration-700 px-4">
      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 p-10 md:p-14 text-center overflow-hidden relative">
        
        {isSuccess && (
          <div className="absolute inset-0 bg-emerald-600 z-50 flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 border-4 border-white/40 animate-bounce">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-3xl font-black uppercase italic tracking-tighter">Node Synchronized</h3>
            <p className="text-emerald-100 font-bold text-sm mt-2 uppercase tracking-widest animate-pulse italic">Establishing encrypted node socket...</p>
          </div>
        )}

        <div className="w-24 h-24 bg-blue-600/10 rounded-[2.5rem] flex items-center justify-center text-blue-600 mx-auto mb-10 shadow-xl shadow-blue-500/5">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        
        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter uppercase italic leading-none">Node Authentication</h2>
        <p className="text-slate-500 text-lg mb-12 font-medium italic">Establishing a verified uplink to your private AI project.</p>

        {error && (
          <div className="p-8 bg-red-50 border border-red-200 rounded-[3rem] text-left animate-in slide-in-from-top-4 duration-300 mb-8">
            <div className="flex items-start gap-4">
              <div className="bg-red-600 text-white p-1.5 rounded-xl shrink-0 shadow-lg shadow-red-500/20">
                 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="font-black uppercase tracking-widest text-[10px] italic text-red-700">Handshake Rejected</p>
                <p className="text-xs leading-relaxed font-bold italic text-red-600 uppercase">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          <button 
            onClick={handleOpenSelector}
            disabled={isVerifying}
            className={`w-full py-10 rounded-[3rem] font-black uppercase tracking-[0.8em] text-[12px] shadow-2xl transition-all active:scale-95 flex flex-col items-center justify-center gap-4 ${
              isVerifying ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600 shadow-blue-500/20'
            }`}
          >
            {isVerifying ? (
              <>
                <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                Initializing Handshake...
              </>
            ) : (
              <>
                <span className="text-xl">Connect via AI Studio</span>
                <span className="tracking-[0.2em] opacity-60 text-[10px]">Physical Key Handshake</span>
              </>
            )}
          </button>
          
          <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl text-xs text-slate-500 leading-relaxed font-medium italic">
            You must select an API key from a <span className="text-slate-900 font-bold">Paid GCP Project</span> to enable the SEO search tools and high-volume broadcasting.
          </div>
        </div>
        
        <div className="mt-14 pt-8 border-t border-slate-100 flex flex-col items-center gap-6">
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline italic flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Review Billing Documentation
          </a>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest italic font-bold">Encrypted End-to-End • Strictly Validated via Network Ping</p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyGate;
