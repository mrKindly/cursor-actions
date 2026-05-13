export interface SavedTrip {
  id: string;
  experienceTitle: string;
  date: string;
  passengers: number;
  totalPrice: number;
  savedAt: string;
}

// In-memory store for trips.
// Note: This will reset on server restart or HMR.
let savedTrips: SavedTrip[] = [];

export const addTrip = (trip: Omit<SavedTrip, 'id' | 'savedAt'>): SavedTrip => {
  const newTrip: SavedTrip = {
    ...trip,
    id: Math.random().toString(36).substring(2, 9),
    savedAt: new Date().toISOString(),
  };
  savedTrips.push(newTrip);
  return newTrip;
};

export const getTrips = (): SavedTrip[] => {
  return [...savedTrips];
};
