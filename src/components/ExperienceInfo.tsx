import React from 'react';
import { Clock, Anchor, Utensils, Waves } from 'lucide-react';
import { motion } from 'motion/react';
import { ExperienceData } from '../data/experience';

const IconMap: Record<string, React.ReactNode> = {
  Clock: <Clock className="w-4 h-4 text-secondary" />,
  Anchor: <Anchor className="w-4 h-4 text-secondary" />,
  Utensils: <Utensils className="w-6 h-6 text-secondary" />,
  Waves: <Waves className="w-6 h-6 text-secondary" />
};

interface ExperienceInfoProps {
  data: ExperienceData;
}

export const ExperienceInfo: React.FC<ExperienceInfoProps> = ({ data }) => {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-4">
        <div className="bg-white px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-sm border border-slate-100">
          {IconMap.Clock}
          <span className="text-sm font-semibold text-slate-600">{data.duration}</span>
        </div>
        <div className="bg-white px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-sm border border-slate-100">
          {IconMap.Anchor}
          <span className="text-sm font-semibold text-slate-600">{data.location}</span>
        </div>
      </div>

      <p className="text-xl leading-relaxed text-slate-600 font-body font-medium">
        {data.description}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.features.map((feature) => (
          <motion.div 
            key={feature.title}
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-3xl flex flex-col gap-4 shadow-sm border border-slate-100"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
              {IconMap[feature.icon]}
            </div>
            <h3 className="font-headline font-bold text-xl text-slate-900">{feature.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
