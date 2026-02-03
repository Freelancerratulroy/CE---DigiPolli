
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { verifyApiKey } from '../geminiService';
import { backendService } from '../services/backendService';
import ApiKeyInput from './ApiKeyInput';

interface Props {
  user: User;
  onSuccess: (updatedUser: User) => void;
}

const ApiKeyGate: React.FC<Props> = ({ user, onSuccess }) => {
  const [manualKey, setManualKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdvanced, setIsAdvanced] = useState(false);

  // Auto-check on mount if using AI Studio environment
  useEffect(() => {
    const checkExisting = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio && await aistudio.hasSelectedApiKey()) {
        const res = await verifyApiKey('GEMINI');
        if (res.valid) handleSuccess();
      }
    };
    checkExisting();
  }, []);

  const handleManualConnect = async () => {
    const trimmedKey = manualKey.trim();
    if (!trimmedKey) return;
    
    setError(null);
    setIsVerifying(true);
    
    // REAL HANDSHAKE: This calls the actual Google API via geminiService
    const result = await verifyApiKey('GEMINI', trimmedKey);

    if (result.valid) {
      handleSuccess(trimmedKey);
    } else {
      // Hard failure - key is wrong or fake
      setError("INVALID API KEY – CONNECTION FAILED");
      setIsVerifying(false);
    }
  };

  const handleGoogleConnect = async () => {
    setError(null);
    setIsVerifying(true);
    try {
      const aistudio = (window as any).aistudio;
      if (!aistudio) throw new Error("AI Studio context missing");
      
      await aistudio.openSelectKey();
      
      // Verify the selected key works
      const result = await verifyApiKey('GEMINI');
      
      if (result.valid) {
        handleSuccess();
      } else {
        setError("INVALID API KEY – CONNECTION FAILED");
        setIsVerifying(false);
      }
    } catch (err) {
      setError("INVALID API KEY – CONNECTION FAILED");
      setIsVerifying(false);
    }
  };

  const handleSuccess = (key?: string) => {
    setIsSuccess(true);
    const updatedUser: User = {
      ...user,
      activeAiProvider: isAdvanced ? 'CUSTOM' : 'GEMINI',
      geminiApiKey: key,
      geminiKeyStatus: 'VERIFIED',
      apiKeyVerifiedAt: new Date().toISOString(),
    };
    backendService.updateUser(updatedUser);
    
    // Show success state briefly before transitioning
    setTimeout(() => {
      onSuccess(updatedUser);
    }, 1500);
  };

  if (isAdvanced) {
    return (
      <ApiKeyInput 
        user={user} 
        onSuccess={onSuccess} 
        onBack={() => setIsAdvanced(false)} 
      />
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 animate-in fade-in zoom-in-95 duration-700">
      <div className="w-full max-w-xl bg-[#0B0F17] rounded-[4rem] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.8)] border border-slate-800/50 p-12 md:p-16 text-center relative overflow-hidden">
        
        {isSuccess && (
          <div className="absolute inset-0 bg-emerald-600 z-50 flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-3xl font-black uppercase italic tracking-tighter">Connected</h3>
            <p className="text-emerald-100 font-bold text-[10px] uppercase tracking-[0.5em] mt-2">Uplink Active</p>
          </div>
        )}

        <div className="mb-12">
          <div className="w-20 h-20 bg-blue-600/10 rounded-[2rem] flex items-center justify-center text-blue-500 mx-auto mb-10 shadow-3xl shadow-blue-500/20 border border-blue-500/30">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-5xl font-black text-white uppercase tracking-tighter mb-4 leading-none">
            Relay <span className="text-blue-500">Node</span>
          </h2>
          <p className="text-slate-400 font-medium italic max-w-sm mx-auto">
            Provide a valid <span className="text-white font-bold underline">Gemini API Key</span> to initiate the SEO Intelligence protocol.
          </p>
        </div>

        {error && (
          <div className="mb-8 p-5 bg-red-600/10 border border-red-500/50 rounded-2xl animate-in shake">
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="relative group">
            <input 
              type="password"
              placeholder="Paste Gemini Secret Key..."
              className="w-full bg-[#151B26] border border-slate-800 rounded-full px-8 py-6 text-white text-center font-mono text-sm placeholder-slate-600 outline-none focus:border-blue-500 transition-all shadow-inner"
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              disabled={isVerifying}
            />
          </div>

          <button 
            onClick={handleManualConnect}
            disabled={isVerifying || !manualKey.trim()}
            className={`w-full py-6 rounded-full font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl ${
              isVerifying || !manualKey.trim() 
              ? 'bg-slate-800 text-slate-500' 
              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20'
            }`}
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Verifying Handshake...
              </span>
            ) : (
              'Initiate Uplink'
            )}
          </button>

          <div className="relative py-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
            <div className="relative px-6 bg-[#0B0F17] text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">Alternative</div>
          </div>

          <button 
            onClick={handleGoogleConnect}
            disabled={isVerifying}
            className="w-full py-6 rounded-full bg-white text-slate-900 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:bg-slate-100 transition-all active:scale-95 shadow-xl disabled:opacity-50"
          >
            Connect via Google Cloud
          </button>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-900 flex flex-col items-center gap-4">
          <button 
            onClick={() => setIsAdvanced(true)}
            className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors underline decoration-dotted underline-offset-4"
          >
            Custom Infrastructure Setup
          </button>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic">Encrypted Secure Socket • DigiPolli v4</p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyGate;
