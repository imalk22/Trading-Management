export type EventImpact = "Low" | "Medium" | "High" | "Holiday";

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  impact: EventImpact;
  forecast: string;
  previous: string;
}

export interface CryptoMilestone {
  id: string;
  title: string;
  date: string;
  description: string;
  isEstimate: boolean;
}
