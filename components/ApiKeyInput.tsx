
import React, { useState } from 'react';
import { User, ApiConfig } from '../types';
import { backendService } from '../services/backendService';
import { verifyGenericApi } from '../geminiService';

interface Props {
  user: User;
  onSuccess: (updatedUser: User) => void;
  onBack?: () => void;
}

const ApiKeyInput: React.FC<Props> = ({ user, onSuccess, onBack }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  
  const [config, setConfig] = useState<ApiConfig>({
    providerName: 'Custom AI Node',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authType: 'API-Key',
    testEndpoint: '/v1beta/models'
  });

  const isFormComplete = 
    config.providerName.trim() !== '' &&
    config.apiKey.trim() !== '' && 
    config.baseUrl.trim() !== '' && 
    config.testEndpoint.trim() !== '';

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormComplete) return;

    setError(null);
    setStatusMsg(null);
    setIsVerifying(true);

    try {
      // Execute REAL-TIME HTTP handshake via geminiService
      const result = await verifyGenericApi(config);

      if (result.valid) {
        setStatusMsg(`UPLINK ESTABLISHED (HTTP ${result.status})`);
        
        const updatedUser: User = {
          ...user,
          activeAiProvider: 'CUSTOM',
          geminiKeyStatus: 'VERIFIED',
          apiConfig: config,
          apiKeyVerifiedAt: new Date().toISOString(),
        };
        
        backendService.updateUser(updatedUser);
        
        // Final transition after feedback
        setTimeout(() => onSuccess(updatedUser), 1500);
      } else {
        setError(result.error || "INVALID API KEY – CONNECTION FAILED");
      }
    } catch (err: any) {
      console.error("Manual Uplink Error:", err);
      setError("INVALID API KEY – CONNECTION FAILED");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-[#0B0F17] rounded-[3rem] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.8)] border border-slate-800/50 overflow-hidden">
        <div className="bg-slate-900/40 p-10 border-b border-slate-800 text-center">
          <button 
            onClick={onBack}
            className="absolute left-8 top-8 text-slate-500 hover:text-white transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-6 border border-blue-500/30">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Advanced Uplink</h2>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em]">Direct Infrastructure Access</p>
        </div>

        {error && (
          <div className="mx-10 mt-8 p-5 bg-red-600/10 border border-red-500/50 rounded-2xl animate-in slide-in-from-top-2">
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>
          </div>
        )}

        {statusMsg && (
          <div className="mx-10 mt-8 p-5 bg-emerald-600/10 border border-emerald-500/50 rounded-2xl animate-in slide-in-from-top-2">
            <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest text-center">{statusMsg}</p>
          </div>
        )}

        <form onSubmit={handleVerify} className="p-10 space-y-6">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Provider Label</label>
            <input 
              type="text"
              className="w-full bg-[#151B26] border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-blue-500 transition-all"
              placeholder="e.g. Agency Node 01"
              value={config.providerName}
              onChange={e => setConfig({...config, providerName: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Base Infrastructure URL</label>
            <input 
              type="url"
              className="w-full bg-[#151B26] border border-slate-800 rounded-2xl px-6 py-4 text-blue-400 font-mono text-xs outline-none focus:border-blue-500 transition-all"
              value={config.baseUrl}
              onChange={e => setConfig({...config, baseUrl: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Auth Type</label>
              <select 
                className="w-full bg-[#151B26] border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold text-xs outline-none appearance-none cursor-pointer"
                value={config.authType}
                onChange={e => setConfig({...config, authType: e.target.value as any})}
              >
                <option value="API-Key">X-API-Key Header</option>
                <option value="Bearer">Bearer Token</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Ping Endpoint</label>
              <input 
                type="text"
                className="w-full bg-[#151B26] border border-slate-800 rounded-2xl px-6 py-4 text-slate-300 font-mono text-xs outline-none"
                value={config.testEndpoint}
                onChange={e => setConfig({...config, testEndpoint: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Master Secret Key</label>
            <input 
              type="password"
              className="w-full bg-[#151B26] border border-slate-800 rounded-2xl px-6 py-4 text-blue-500 font-mono text-xs outline-none focus:border-blue-500"
              placeholder="••••••••••••••••"
              value={config.apiKey}
              onChange={e => setConfig({...config, apiKey: e.target.value})}
            />
          </div>

          <button 
            type="submit"
            disabled={isVerifying || !isFormComplete}
            className={`w-full py-6 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all active:scale-95 flex items-center justify-center gap-4 ${
              isVerifying || !isFormComplete ? 'bg-slate-800 text-slate-600' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-2xl shadow-blue-500/20'
            }`}
          >
            {isVerifying ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : 'Establish Connection'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ApiKeyInput;
