export interface SymbolInfo {
  /** Binance spot symbol, e.g. "BTCUSDT" */
  symbol: string;
  /** Human-readable asset name, e.g. "Bitcoin" */
  name: string;
  /** Matching Binance USDT-margined perpetual symbol for funding rate, or null if none exists */
  futuresSymbol: string | null;
}

export const CURATED_SYMBOLS: readonly SymbolInfo[] = [
  { symbol: "BTCUSDT", name: "Bitcoin", futuresSymbol: "BTCUSDT" },
  { symbol: "ETHUSDT", name: "Ethereum", futuresSymbol: "ETHUSDT" },
  { symbol: "SOLUSDT", name: "Solana", futuresSymbol: "SOLUSDT" },
  { symbol: "XRPUSDT", name: "XRP", futuresSymbol: "XRPUSDT" },
  { symbol: "ADAUSDT", name: "Cardano", futuresSymbol: "ADAUSDT" },
  { symbol: "DOGEUSDT", name: "Dogecoin", futuresSymbol: "DOGEUSDT" },
  { symbol: "AVAXUSDT", name: "Avalanche", futuresSymbol: "AVAXUSDT" },
  { symbol: "BNBUSDT", name: "BNB", futuresSymbol: "BNBUSDT" },
  { symbol: "DOTUSDT", name: "Polkadot", futuresSymbol: "DOTUSDT" },
  { symbol: "PAXGUSDT", name: "Gold", futuresSymbol: null },
];

export const DEFAULT_SYMBOL = CURATED_SYMBOLS[0].symbol;
