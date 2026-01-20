
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
  const [apiKey, setApiKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<{ msg: string; type?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return setError({ msg: "API Key is required." });

    setIsVerifying(true);
    setError(null);

    const result = await verifyApiKey(activeTab, apiKey);

    if (result.valid) {
      const updatedUser: User = {
        ...user,
        activeAiProvider: activeTab,
        ...(activeTab === 'GEMINI' ? { geminiApiKey: apiKey, geminiKeyStatus: 'VERIFIED' } : { openaiApiKey: apiKey, openaiKeyStatus: 'VERIFIED' }),
        apiKeyVerifiedAt: new Date().toISOString(),
      };
      backendService.updateUser(updatedUser);
      onSuccess(updatedUser);
    } else {
      const isQuota = result.error?.includes("QUOTA_EXHAUSTED");
      setError({ 
        msg: result.error || `Invalid ${activeTab} API key. Please try again.`,
        type: isQuota ? 'QUOTA' : 'GENERIC'
      });
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-20 px-6 animate-in fade-in duration-700">
      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-12 text-center">
        <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-10 shadow-xl shadow-blue-500/10">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        
        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter uppercase italic">Secure Socket Gate</h2>
        <p className="text-slate-500 text-lg mb-12 font-medium">Connect your AI Intelligence Node. We support Gemini 3 and OpenAI GPT-4o.</p>

        {/* Provider Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-2xl mb-10">
          <button 
            onClick={() => setActiveTab('GEMINI')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'GEMINI' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Google Gemini
          </button>
          <button 
            onClick={() => setActiveTab('OPENAI')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'OPENAI' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            OpenAI GPT
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="text-left">
            <label className="block text-[11px] font-black text-slate-700 uppercase mb-4 tracking-[0.5em] ml-2">{activeTab} API Key</label>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={activeTab === 'GEMINI' ? 'AIzaSy...' : 'sk-...'}
              className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] text-slate-900 font-mono text-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder-slate-300"
              disabled={isVerifying}
            />
          </div>
          
          {error && (
            <div className={`p-6 border rounded-[2rem] text-left animate-in slide-in-from-top-4 duration-300 ${
              error.type === 'QUOTA' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <div className="flex items-start gap-4">
                <svg className="h-6 w-6 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="space-y-2">
                  <p className="font-black uppercase tracking-widest text-[10px]">Transmission Error Detected</p>
                  <p className="text-xs leading-relaxed font-medium">{error.msg}</p>
                </div>
              </div>
            </div>
          )}
          
          <button 
            type="submit"
            disabled={isVerifying || !apiKey.trim()}
            className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.7em] text-[11px] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 ${
              isVerifying ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isVerifying ? (
              <>
                <div className="w-5 h-5 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                Initializing Node...
              </>
            ) : `Authorize ${activeTab} Access`}
          </button>
        </form>
        
        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col gap-2">
          {activeTab === 'GEMINI' ? (
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Generate new Gemini API Key</a>
          ) : (
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">Generate new OpenAI API Key</a>
          )}
          <p className="text-[9px] text-slate-400 uppercase tracking-widest">Enterprise grade intelligence core active</p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyGate;
