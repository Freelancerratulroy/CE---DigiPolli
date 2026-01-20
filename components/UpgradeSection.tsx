
import React, { useState } from 'react';
import { backendService } from '../services/backendService';
import { User } from '../types';

interface Props {
  user: User;
  onUpgrade: (updatedUser: User) => void;
}

const UpgradeSection: React.FC<Props> = ({ user, onUpgrade }) => {
  const [promo, setPromo] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleApply = () => {
    const updated = backendService.applyPromo(user.id, promo);
    if (updated) {
      onUpgrade(updated);
      setIsSuccess(true);
      setPromo('');
    } else {
      alert("Invalid promo code or standard payment required.");
    }
  };

  if (user.status === 'PAID') return null;

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-3xl text-white mb-12 shadow-xl relative overflow-hidden">
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="max-w-md">
          <h3 className="text-2xl font-bold mb-2">Upgrade to Pro Unlimited</h3>
          <p className="text-indigo-100 text-sm">
            Unlock infinite searches, deep SERP analysis, and bulk lead exports for your entire team.
          </p>
        </div>

        <div className="w-full md:w-auto flex flex-col gap-3">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Promo Code" 
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 outline-none focus:bg-white/20 text-white placeholder-indigo-200 w-full md:w-48"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
            />
            <button 
              onClick={handleApply}
              className="bg-white text-blue-600 font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              Apply
            </button>
          </div>
          <p className="text-[10px] text-indigo-200 text-center md:text-left">
            Standard pricing: $99/mo. Enter promo key for manual override.
          </p>
        </div>
      </div>
      
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-900/20 rounded-full -ml-32 -mb-32 blur-3xl"></div>
    </div>
  );
};

export default UpgradeSection;
