import React from 'react';
import { ExperienceData } from '../data/experience';

interface DestinationMapProps {
  data: ExperienceData;
}

export const DestinationMap: React.FC<DestinationMapProps> = ({ data }) => {
  return (
    <div className="rounded-[2.5rem] overflow-hidden h-72 grayscale contrast-125 opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-700 shadow-lg border border-slate-200">
      <img 
        alt="Destination Map" 
        className="w-full h-full object-cover"
        src={data.mapImage}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
