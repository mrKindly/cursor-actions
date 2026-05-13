import React from 'react';
import { motion } from 'motion/react';
import { ExperienceData } from '../data/experience';

interface HeroProps {
  data: ExperienceData;
}

export const Hero: React.FC<HeroProps> = ({ data }) => {
  return (
    <section className="max-w-7xl mx-auto px-6 mb-12">
      <div className="relative h-[500px] md:h-[650px] rounded-[2.5rem] overflow-hidden group shadow-2xl">
        <img 
          alt={`${data.title} Hero`} 
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          src={data.heroImage}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        <div className="absolute bottom-12 left-8 md:left-12 right-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col gap-2"
          >
            <span className="text-white/90 font-body tracking-[0.2em] text-xs md:text-sm font-bold uppercase">{data.subtitle}</span>
            <h1 className="text-white font-headline text-4xl md:text-7xl font-extrabold tracking-tighter leading-tight">{data.title}</h1>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
