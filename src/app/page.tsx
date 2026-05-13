"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { MobileNav } from '../components/MobileNav';
import { Hero } from '../components/Hero';
import { BookingWidget } from '../components/BookingWidget';
import { ExperienceInfo } from '../components/ExperienceInfo';
import { Amenities } from '../components/Amenities';
import { DestinationMap } from '../components/DestinationMap';
import { ExperienceData } from '../data/experience';

export default function App() {
  const [data, setData] = useState<ExperienceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/experience');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching experience data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-headline font-bold text-blue-900 animate-pulse">Synchronizing your wanderlust...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 md:pb-20">
      <Navbar data={data} />
      
      <main className="pt-24 pb-12">
        <Hero data={data} />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Content */}
          <div className="lg:col-span-7 flex flex-col gap-12">
            <ExperienceInfo data={data} />
            <Amenities data={data} />
            <DestinationMap data={data} />
          </div>

          {/* Right Column: Booking Widget */}
          <BookingWidget data={data} />
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
