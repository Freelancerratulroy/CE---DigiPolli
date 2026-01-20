
import React from 'react';

interface Props {
  onLogoClick?: () => void;
}

const Header: React.FC<Props> = ({ onLogoClick }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <button 
          onClick={onLogoClick} 
          className="flex items-center gap-2 hover:opacity-80 transition-all active:scale-95 text-left outline-none"
        >
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Client Engine by DigiPolli
          </h1>
        </button>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-[10px] font-bold text-slate-400 tracking-widest uppercase">
            Client Acquisition Node v2.5
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
