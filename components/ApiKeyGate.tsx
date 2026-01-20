
import React, { useState } from 'react';
import { User, AiProvider } from '../types';
import { verifyApiKey } from '../geminiService';
import { backendService } from '../services/backendService';

interface Props {
  user: User;
  onSuccess: (updatedUser: User) => void;
}

const ApiKeyGate: React.FC<Props> = ({ user, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<AiProvider>(user.activeAiProvider || 'GEMINI');
  const [apiKey, setApiKey] = useState(activeTab === 'GEMINI' ? (user.geminiApiKey || '') : (user.openaiApiKey || ''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    
    if (!cleanKey) {
      setError("API Key is required to power your agents.");
      return;
    }

    setIsVerifying(true);
    setError(null);
    setIsSuccess(false);

    try {
      // PERFORM REAL-TIME HARD HANDSHAKE WITH GOOGLE SERVERS
      const result = await verifyApiKey(activeTab, cleanKey);

      if (result.valid) {
        // ONLY triggers if Google actually returned a 200 OK response
        setIsSuccess(true);
        
        const updatedUser: User = {
          ...user,
          activeAiProvider: activeTab,
          ...(activeTab === 'GEMINI' ? 
            { geminiApiKey: cleanKey, geminiKeyStatus: 'VERIFIED' } : 
            { openaiApiKey: cleanKey, openaiKeyStatus: 'VERIFIED' }
          ),
          apiKeyVerifiedAt: new Date().toISOString(),
        };
        
        // SAVE SECURELY ONLY AFTER SUCCESSFUL HANDSHAKE
        backendService.updateUser(updatedUser);
        
        // Delay to allow the success UI to be seen
        setTimeout(() => {
          onSuccess(updatedUser);
        }, 1500);
      } else {
        // EXPLICIT REJECTION: Google rejected the key or it was malformed
        setError(result.error || `Invalid API Key – Connection Failed.`);
        setIsVerifying(false);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected system fault occurred during node authorization.");
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-6 animate-in fade-in duration-700">
      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-10 md:p-14 text-center overflow-hidden relative">
        
        {/* SUCCESS OVERLAY - Only reachable via successful API response */}
        {isSuccess && (
          <div className="absolute inset-0 bg-emerald-600 z-50 flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 border-4 border-white/40 shadow-xl scale-in-center">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-3xl font-black uppercase italic tracking-tighter">API Connected Successfully</h3>
            <p className="text-emerald-100 font-bold text-sm mt-2 uppercase tracking-widest animate-pulse italic">Establishing Node Session...</p>
          </div>
        )}

        <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-10 shadow-xl shadow-blue-500/5">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        
        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter uppercase italic leading-none">AI Socket Gate</h2>
        <p className="text-slate-500 text-lg mb-12 font-medium">Validation is mandatory. Enter a live API key to authorize your node.</p>

        <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-12">
          <button 
            type="button"
            onClick={() => { setActiveTab('GEMINI'); setError(null); }}
            disabled={isVerifying}
            className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'GEMINI' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Google Gemini
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('OPENAI'); setError(null); }}
            disabled={isVerifying}
            className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'OPENAI' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            OpenAI GPT-4
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="text-left">
            <label className="block text-[11px] font-black text-slate-700 uppercase mb-4 tracking-[0.5em] ml-2 italic">Enter Secret Key (Required)</label>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={activeTab === 'GEMINI' ? 'AIzaSy...' : 'sk-...'}
              className={`w-full px-8 py-5.5 bg-slate-50 border rounded-[2rem] text-slate-900 font-mono text-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder-slate-300 shadow-inner ${error ? 'border-red-300' : 'border-slate-200'}`}
              disabled={isVerifying}
              autoComplete="off"
              required
            />
          </div>
          
          {error && (
            <div className="p-8 bg-red-50 border border-red-200 rounded-[2.5rem] text-left animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-start gap-4">
                <div className="bg-red-600 text-white p-1 rounded-full shrink-0">
                   <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="font-black uppercase tracking-widest text-[10px] italic text-red-700">Authorization Failure</p>
                  <p className="text-xs leading-relaxed font-bold italic text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <button 
            type="submit"
            disabled={isVerifying || !apiKey.trim()}
            className={`w-full py-7 rounded-[3rem] font-black uppercase tracking-[0.8em] text-[11px] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 ${
              isVerifying ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'
            }`}
          >
            {isVerifying ? (
              <>
                <div className="w-5 h-5 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                Testing Connection...
              </>
            ) : (
              <>
                Authorize & Connect Node
              </>
            )}
          </button>
        </form>
        
        <div className="mt-14 pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
          <div className="flex gap-6">
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline italic">Get Gemini Key</a>
            <div className="w-px h-3 bg-slate-200"></div>
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline italic">Get OpenAI Key</a>
          </div>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest italic font-bold">Physical Handshake Required • No Cloud Caching</p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyGate;
