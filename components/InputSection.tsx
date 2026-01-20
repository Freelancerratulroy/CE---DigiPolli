
import React, { useState, useMemo } from 'react';

interface Props {
  onSearch: (niche: string, location: string, email: string) => void;
  isLoading: boolean;
  isLocked?: boolean;
}

const InputSection: React.FC<Props> = ({ onSearch, isLoading, isLocked }) => {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  
  const isFormValid = niche.trim() !== '' && location.trim() !== '' && email.trim() !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !isLocked) {
      onSearch(niche, location, email);
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 transition-opacity ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        <div className="flex flex-col">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Business Niche</label>
          <input
            type="text"
            placeholder="e.g. Roofers"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <div className="flex flex-col">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Location</label>
          <input
            type="text"
            placeholder="e.g. New York"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="flex flex-col">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Lead Email Target</label>
          <input
            type="email"
            placeholder="report@agency.com"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="lg:mt-6.5">
          <button
            type="submit"
            disabled={isLoading || !isFormValid || isLocked}
            className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg mt-0 sm:mt-6.5 lg:mt-0 ${
              isLoading || !isFormValid || isLocked
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLocked ? 'Trial Expired' : isLoading ? 'Processing...' : 'Generate 80+ Leads'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InputSection;
