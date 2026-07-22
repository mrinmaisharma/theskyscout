export type Voucher = {
  code: string;
  origin: { city: string; airport: string; code: string };
  destination: { city: string; airport: string; code: string };
  flightType: string;
  durationMinutes: number;
  carryOnKg: number;
  checkedBaggageKg: number;
  defaultTravelDate: string;
  earliestTravelDate: string;
  latestTravelDate: string;
  travelDates: string[];
};
