import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { NAV_LINKS, ExperienceData } from '../data/experience';

interface NavbarProps {
  data: ExperienceData;
}

export const Navbar: React.FC<NavbarProps> = ({ data }) => {
  return (
    <nav className="fixed top-0 w-full z-50 glass-nav border-b border-slate-200/50">
      <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
        <span className="text-2xl font-bold tracking-tighter text-blue-900 font-headline">WanderSync</span>
        
        <div className="hidden md:flex gap-8 items-center">
          {NAV_LINKS.map((link) => (
            <a 
              key={link.label}
              href={link.href} 
              className={link.active 
                ? "text-blue-700 font-semibold font-headline border-b-2 border-blue-700 pb-0.5" 
                : "text-slate-500 hover:text-blue-900 transition-colors font-medium font-headline"}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 text-blue-900 hover:bg-slate-100 rounded-full transition-all active:scale-90 relative">
            <ShoppingCart className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full border border-white"></span>
          </button>
          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
            <img 
              alt="User profile" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBWmBze4pZ3CPrUB4JC_uoth-ar-PaMrzP0JxNMT0PjlcJzoLomXm5femWJdbm_i8mopgtSh74LMfQUj0ZIQCJEn-U07kO8haWU75NuvOyrcldUmWhS_Z4u4LdLQ4FO_CA3hcIiO8T4RiHVCIvk5x9Y96dTFYtW3t408vu2xZv_9uhhlDGUdMj6RSYSQ-klybjRu5jyS5SGt4M0PUKTQPbXxSU7q9nE24YlnSF0bubykTxh0LbXBtL-NO0g9o1SAmQUcKUows9nvIsn"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </nav>
  );
};
