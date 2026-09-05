const SPOT_BASE_URL = "https://api.binance.com";
const FUTURES_BASE_URL = "https://fapi.binance.com";

async function fetchBinanceJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${label} failed: ${res.status}`);
  return res.json();
}

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
  const data = await fetchBinanceJson<RawTicker24hr[]>(url, "ticker24hr");
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
  const url = `${SPOT_BASE_URL}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(
    interval
  )}&limit=${limit}`;
  const data = await fetchBinanceJson<RawKline[]>(url, "klines");
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

export interface FundingRate {
  symbol: string;
  lastFundingRate: number;
  markPrice: number;
  indexPrice: number;
}

interface RawFundingRate {
  symbol: string;
  lastFundingRate: string;
  markPrice: string;
  indexPrice: string;
}

export async function fetchFundingRate(symbol: string): Promise<FundingRate> {
  const url = `${FUTURES_BASE_URL}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`;
  const data = await fetchBinanceJson<RawFundingRate>(url, "premiumIndex");
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

interface RawLongShortRatioEntry {
  longAccount: string;
  shortAccount: string;
}

export async function fetchLongShortRatio(symbol: string): Promise<LongShortRatio> {
  const url = `${FUTURES_BASE_URL}/futures/data/topLongShortAccountRatio?symbol=${encodeURIComponent(
    symbol
  )}&period=15m&limit=1`;
  const data = await fetchBinanceJson<RawLongShortRatioEntry[]>(url, "longShortRatio");
  const latest = data[0];
  if (!latest) throw new Error("Binance longShortRatio failed: empty response");
  return { longAccount: Number(latest.longAccount), shortAccount: Number(latest.shortAccount) };
}

export interface OpenInterest {
  symbol: string;
  openInterest: number;
}

interface RawOpenInterest {
  symbol: string;
  openInterest: string;
}

export async function fetchOpenInterest(symbol: string): Promise<OpenInterest> {
  const url = `${FUTURES_BASE_URL}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`;
  const data = await fetchBinanceJson<RawOpenInterest>(url, "openInterest");
  return { symbol: data.symbol, openInterest: Number(data.openInterest) };
}

export interface OpenInterestChange {
  changePercent: number;
}

interface RawOpenInterestHistEntry {
  sumOpenInterest: string;
}

export async function fetchOpenInterestChange(symbol: string): Promise<OpenInterestChange> {
  const url = `${FUTURES_BASE_URL}/futures/data/openInterestHist?symbol=${encodeURIComponent(
    symbol
  )}&period=5m&limit=13`;
  const data = await fetchBinanceJson<RawOpenInterestHistEntry[]>(url, "openInterestHist");
  const oldest = Number(data[0].sumOpenInterest);
  const newest = Number(data[data.length - 1].sumOpenInterest);
  return { changePercent: ((newest - oldest) / oldest) * 100 };
}
