import React, { useState } from 'react';
import { Star, Calendar as CalendarIcon, Minus, Plus, ShieldCheck } from 'lucide-react';
import { ExperienceData } from '../data/experience';

interface BookingWidgetProps {
  data: ExperienceData;
}

export const BookingWidget: React.FC<BookingWidgetProps> = ({ data }) => {
  const [passengers, setPassengers] = useState(2);
  const subtotal = data.pricePerPerson * passengers;
  const total = subtotal + data.portTaxes;

  return (
    <div className="lg:col-span-5">
      <div className="sticky top-28 bg-white rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,30,66,0.08)] flex flex-col gap-8 border border-slate-100">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-[10px] font-body font-bold uppercase tracking-[0.2em] text-slate-400">Starting at</span>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-900">${data.pricePerPerson}</span>
              <span className="text-slate-500 font-medium">/ person</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full">
            <Star className="w-4 h-4 text-secondary fill-secondary" />
            <span className="text-sm font-bold text-secondary">4.9</span>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Date Selector */}
          <div className="flex flex-col gap-2">
            <label className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-1">Departure Date</label>
            <button className="flex items-center gap-3 bg-surface-container-low p-4 rounded-2xl cursor-pointer hover:bg-surface-container-high transition-all text-left border border-transparent hover:border-slate-200">
              <CalendarIcon className="w-5 h-5 text-secondary" />
              <span className="font-semibold text-slate-700">October 24, 2024</span>
            </button>
          </div>

          {/* Quantity Adjuster */}
          <div className="flex flex-col gap-2">
            <label className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-1">Passengers</label>
            <div className="flex items-center justify-between bg-surface-container-low p-2 rounded-2xl border border-slate-100">
              <button 
                onClick={() => setPassengers(Math.max(1, passengers - 1))}
                className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm hover:bg-blue-50 transition-colors active:scale-95 disabled:opacity-50"
                disabled={passengers <= 1}
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-2xl font-bold font-headline text-slate-800">{passengers.toString().padStart(2, '0')}</span>
              <button 
                onClick={() => setPassengers(Math.min(data.maxPassengers, passengers + 1))}
                className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm hover:bg-blue-50 transition-colors active:scale-95 disabled:opacity-50"
                disabled={passengers >= data.maxPassengers}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <span className="text-[9px] text-center font-bold uppercase tracking-widest text-slate-400 mt-1">Maximum {data.maxPassengers} passengers per boat</span>
          </div>
        </div>

        <div className="pt-4 flex flex-col gap-4">
          <div className="flex justify-between items-center text-sm px-1">
            <span className="text-slate-500">Subtotal (${data.pricePerPerson} × {passengers})</span>
            <span className="font-bold text-slate-800">${subtotal}</span>
          </div>
          <div className="flex justify-between items-center text-sm px-1">
            <span className="text-slate-500">Port Taxes</span>
            <span className="font-bold text-slate-800">${data.portTaxes}</span>
          </div>
          <div className="border-t border-dashed border-slate-200 my-2"></div>
          <div className="flex justify-between items-center px-1">
            <span className="text-lg font-bold text-slate-900">Total</span>
            <span className="text-3xl font-extrabold text-slate-900">${total}</span>
          </div>
          
          <button className="w-full sunset-glow text-white py-5 rounded-2xl font-headline font-bold text-lg tracking-tight hover:brightness-110 active:scale-[0.98] transition-all mt-4 shadow-lg shadow-accent/20">
            Checkout
          </button>

          <div className="flex items-center justify-center gap-2 mt-2">
            <ShieldCheck className="w-4 h-4 text-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Secure Payment Guaranteed</span>
          </div>
        </div>
      </div>
    </div>
  );
};
