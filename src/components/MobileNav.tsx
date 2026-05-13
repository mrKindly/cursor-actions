import React from 'react';
import { Search, Compass, Heart, User } from 'lucide-react';

export const MobileNav: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-50 rounded-t-[2rem] shadow-2xl">
      <div className="flex flex-col items-center gap-1 text-slate-400">
        <Search className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Explore</span>
      </div>
      <div className="flex flex-col items-center gap-1 text-accent bg-accent/5 px-4 py-2 rounded-2xl">
        <Compass className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Trips</span>
      </div>
      <div className="flex flex-col items-center gap-1 text-slate-400">
        <Heart className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Saved</span>
      </div>
      <div className="flex flex-col items-center gap-1 text-slate-400">
        <User className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Profile</span>
      </div>
    </nav>
  );
};
