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
  const url = `${SPOT_BASE_URL}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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
