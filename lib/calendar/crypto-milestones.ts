import type { CryptoMilestone } from "./types";

export const CRYPTO_MILESTONES: CryptoMilestone[] = [
  {
    id: "bitcoin-halving-2028",
    title: "Bitcoin Halving",
    date: "2028-04-01",
    description:
      "The block reward drops from 3.125 to 1.5625 BTC at block 1,050,000. The date is an estimate based on Bitcoin's ~10-minute average block time, not a fixed calendar date - halvings are determined by block height, not the calendar.",
    isEstimate: true,
  },
];
