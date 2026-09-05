"use client";

import { useEffect, useState } from "react";

export function nextBackoffDelayMs(attempt: number): number {
  const base = 500;
  const max = 15_000;
  return Math.min(base * 2 ** attempt, max);
}

export interface ReconnectingStreamOptions {
  url: string;
  onMessage: (data: unknown) => void;
  WebSocketImpl?: typeof WebSocket;
  scheduleReconnect?: (attempt: number, reconnect: () => void) => void;
}

export function createReconnectingStream(options: ReconnectingStreamOptions) {
  const WebSocketImpl = options.WebSocketImpl ?? WebSocket;
  let attempt = 0;
  let socket: WebSocket | null = null;
  let closedByCaller = false;

  function connect() {
    socket = new WebSocketImpl(options.url);
    socket.onmessage = (event: MessageEvent) => {
      options.onMessage(JSON.parse(event.data as string));
    };
    socket.onopen = () => {
      attempt = 0;
    };
    socket.onclose = () => {
      if (closedByCaller) return;
      attempt += 1;
      if (options.scheduleReconnect) {
        options.scheduleReconnect(attempt, connect);
      } else {
        setTimeout(connect, nextBackoffDelayMs(attempt - 1));
      }
    };
  }

  connect();

  return {
    close() {
      closedByCaller = true;
      socket?.close();
    },
  };
}

function useBinanceStream<T>(streamPath: string, parse: (msg: any) => T): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const stream = createReconnectingStream({
      url: `wss://stream.binance.com:9443/ws/${streamPath}`,
      onMessage: (msg) => setData(parse(msg)),
    });
    return () => stream.close();
  }, [streamPath]);

  return data;
}

export interface LiveTicker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
}

export function useBinanceTicker(symbol: string): LiveTicker | null {
  return useBinanceStream<LiveTicker>(`${symbol.toLowerCase()}@ticker`, (msg) => ({
    symbol: msg.s,
    lastPrice: Number(msg.c),
    priceChangePercent: Number(msg.P),
  }));
}

export interface LiveKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal: boolean;
}

export function useBinanceKline(symbol: string, interval: string): LiveKline | null {
  return useBinanceStream<LiveKline>(`${symbol.toLowerCase()}@kline_${interval}`, (msg) => ({
    openTime: msg.k.t,
    open: Number(msg.k.o),
    high: Number(msg.k.h),
    low: Number(msg.k.l),
    close: Number(msg.k.c),
    volume: Number(msg.k.v),
    isFinal: msg.k.x,
  }));
}

export interface DepthLevel {
  price: number;
  quantity: number;
}

export interface LiveDepth {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export function useBinanceDepth(symbol: string, levels = 15): LiveDepth | null {
  return useBinanceStream<LiveDepth>(`${symbol.toLowerCase()}@depth${levels}@1000ms`, (msg) => ({
    bids: msg.bids.map(([price, quantity]: [string, string]) => ({
      price: Number(price),
      quantity: Number(quantity),
    })),
    asks: msg.asks.map(([price, quantity]: [string, string]) => ({
      price: Number(price),
      quantity: Number(quantity),
    })),
  }));
}

export interface LiveTrade {
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean;
}

export function useBinanceTrades(symbol: string, maxTrades = 20): LiveTrade[] {
  const [trades, setTrades] = useState<LiveTrade[]>([]);

  useEffect(() => {
    setTrades([]);
    const stream = createReconnectingStream({
      url: `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`,
      onMessage: (msg: any) => {
        setTrades((prev) =>
          [
            { price: Number(msg.p), quantity: Number(msg.q), time: msg.T, isBuyerMaker: msg.m },
            ...prev,
          ].slice(0, maxTrades)
        );
      },
    });
    return () => stream.close();
  }, [symbol, maxTrades]);

  return trades;
}
