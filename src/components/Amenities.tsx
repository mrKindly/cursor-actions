import React from 'react';
import { Info, CheckCircle2 } from 'lucide-react';
import { ExperienceData } from '../data/experience';

interface AmenitiesProps {
  data: ExperienceData;
}

export const Amenities: React.FC<AmenitiesProps> = ({ data }) => {
  return (
    <section className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full"></div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <Info className="w-6 h-6 text-accent" />
          <h2 className="font-headline font-bold text-lg uppercase tracking-[0.2em] text-accent">Essential Amenities</h2>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12">
          {data.amenities.map((amenity) => (
            <li key={amenity} className="flex items-center gap-4 group">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <CheckCircle2 className="w-5 h-5 text-accent" />
              </div>
              <span className="font-medium text-slate-200">{amenity}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
