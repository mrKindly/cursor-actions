export interface Feature {
  icon: string;
  title: string;
  description: string;
}

export interface ExperienceData {
  title: string;
  subtitle: string;
  heroImage: string;
  duration: string;
  location: string;
  description: string;
  features: Feature[];
  amenities: string[];
  pricePerPerson: number;
  portTaxes: number;
  maxPassengers: number;
  mapImage: string;
}

export const EXPERIENCE_DATA: ExperienceData = {
  title: "Coastal Boat Trip",
  subtitle: "Signature Experience",
  heroImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuCGkliZcAd-pSR7XBK93njY5NGtU_bz0_EvOCFUQ6YRtPpjHqvfy599jPYeG1Ips7vrnVc3GnvtfmWL_8IomfSstT_bFVjAvdgDcGZAvxDp2RQyzkckjXfISKBlupISmrCMPznZmcHVLomlrnpDt1HgmZP_yDJDa2Z948rhKCM8Cz7to4FFIBwceHHGC96lubXw1W70DzXkJRNdvOWxdzlPc5N83ZI6byfGAmJCiyuVqkg2ZgI0FIWGsLcMo1BkgpHdtFIGC43LAGDY",
  duration: "4 Hours",
  location: "Marina Port",
  description: "Embark on an unforgettable nautical journey along the rugged Mediterranean coastline. Our expertly piloted vessel glides through hidden coves and sapphire waters, offering a vantage point of the cliffs only accessible by sea.",
  features: [
    {
      icon: "Utensils",
      title: "Onboard Dining",
      description: "Fresh Mediterranean hors d'oeuvres and chilled beverages served throughout the voyage."
    },
    {
      icon: "Waves",
      title: "Marine Life",
      description: "Frequent sightings of local dolphins and exotic sea birds in their natural habitat."
    }
  ],
  amenities: [
    "Sundeck Loungers",
    "Freshwater Shower",
    "Snorkeling Gear",
    "Wi-Fi Onboard"
  ],
  pricePerPerson: 129,
  portTaxes: 24,
  maxPassengers: 12,
  mapImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuAtKSDXyXj8CC99Z4ESNpkEEOz-nqbQN1ZDzhVX0TowZyDEZeUBiZLIYmQMcmMSabzi0Ie44iY6txQFyQ2n9fO6diVsPYuceFvCYfzVC92XnfvbBed536KldIB0Wl3ubG_4SAvbnbB3Ng1x6ifz0JFjG2rfF2BybXF-WWKzbBKqKeYeZTqJ-oEcgipT7YcOSptu8Qwu6Crlfp4ihMr3UszjsPeYR4jRbctwRcHyQ-zr1L1xFYcVtIi92Chmth-h_oQ2SHvdtSjUCGXT"
};

export const NAV_LINKS = [
  { label: "Explore", href: "#" },
  { label: "Trips", href: "#", active: true },
  { label: "Saved", href: "#" }
];
