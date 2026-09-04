import { NextResponse } from "next/server";

export interface GlobalStats {
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  btcDominance: number;
}

let cache: { data: GlobalStats; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  const res = await fetch("https://api.coingecko.com/api/v3/global");
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch global stats" }, { status: 502 });
  }
  const body = await res.json();
  const data: GlobalStats = {
    totalMarketCapUsd: body.data.total_market_cap.usd,
    totalVolumeUsd: body.data.total_volume.usd,
    btcDominance: body.data.market_cap_percentage.btc,
  };
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(data);
}
