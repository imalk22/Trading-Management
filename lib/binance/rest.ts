const SPOT_BASE_URL = "https://api.binance.com";

export interface Ticker24hr {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}

interface RawTicker24hr {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export async function fetchTicker24hr(symbols: string[]): Promise<Ticker24hr[]> {
  const url = `${SPOT_BASE_URL}/api/v3/ticker/24hr?symbols=${encodeURIComponent(
    JSON.stringify(symbols)
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ticker24hr failed: ${res.status}`);
  const data: RawTicker24hr[] = await res.json();
  return data.map((d) => ({
    symbol: d.symbol,
    lastPrice: Number(d.lastPrice),
    priceChangePercent: Number(d.priceChangePercent),
    highPrice: Number(d.highPrice),
    lowPrice: Number(d.lowPrice),
    volume: Number(d.volume),
    quoteVolume: Number(d.quoteVolume),
  }));
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

type RawKline = [number, string, string, string, string, string, number, ...unknown[]];

export async function fetchKlines(
  symbol: string,
  interval: string,
  limit = 200
): Promise<Kline[]> {
  const url = `${SPOT_BASE_URL}/api/v3/klines?symbol=${encodeURIComponent(
    symbol
  )}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines failed: ${res.status}`);
  const data: RawKline[] = await res.json();
  return data.map((row) => ({
    openTime: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: row[6],
  }));
}

const FUTURES_BASE_URL = "https://fapi.binance.com";

export interface FundingRate {
  symbol: string;
  lastFundingRate: number;
  markPrice: number;
  indexPrice: number;
}

export async function fetchFundingRate(symbol: string): Promise<FundingRate> {
  const url = `${FUTURES_BASE_URL}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance premiumIndex failed: ${res.status}`);
  const data = await res.json();
  return {
    symbol: data.symbol,
    lastFundingRate: Number(data.lastFundingRate),
    markPrice: Number(data.markPrice),
    indexPrice: Number(data.indexPrice),
  };
}

export interface LongShortRatio {
  longAccount: number;
  shortAccount: number;
}

export async function fetchLongShortRatio(symbol: string): Promise<LongShortRatio> {
  const url = `${FUTURES_BASE_URL}/futures/data/topLongShortAccountRatio?symbol=${encodeURIComponent(
    symbol
  )}&period=15m&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance longShortRatio failed: ${res.status}`);
  const data = await res.json();
  const latest = data[0];
  return { longAccount: Number(latest.longAccount), shortAccount: Number(latest.shortAccount) };
}

export interface OpenInterest {
  symbol: string;
  openInterest: number;
}

export async function fetchOpenInterest(symbol: string): Promise<OpenInterest> {
  const url = `${FUTURES_BASE_URL}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance openInterest failed: ${res.status}`);
  const data = await res.json();
  return { symbol: data.symbol, openInterest: Number(data.openInterest) };
}
