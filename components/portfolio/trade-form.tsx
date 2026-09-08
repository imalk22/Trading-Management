"use client";

import { useState, type FormEvent } from "react";
import { CURATED_SYMBOLS, DEFAULT_SYMBOL } from "@/lib/symbols";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TradeDirection } from "@/lib/portfolio/types";

export interface NewTradeInput {
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  units: number;
  notes: string;
}

export interface TradeFormProps {
  onSubmit: (trade: NewTradeInput) => void;
}

const FIELD_CLASS = "rounded-lg border border-border bg-muted px-3 py-1.5 text-sm outline-none";

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function TradeForm({ onSubmit }: TradeFormProps) {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [direction, setDirection] = useState<TradeDirection>("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [units, setUnits] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedEntry = Number(entryPrice);
    const parsedUnits = Number(units);
    if (!Number.isFinite(parsedEntry) || parsedEntry <= 0 || !Number.isFinite(parsedUnits) || parsedUnits <= 0) return;

    onSubmit({
      symbol,
      direction,
      entryPrice: parsedEntry,
      stopLossPrice: parseOptionalNumber(stopLossPrice),
      takeProfitPrice: parseOptionalNumber(takeProfitPrice),
      units: parsedUnits,
      notes,
    });

    setEntryPrice("");
    setStopLossPrice("");
    setTakeProfitPrice("");
    setUnits("");
    setNotes("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a Trade</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <label className="flex flex-col gap-1 text-sm">
            Symbol
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={FIELD_CLASS}>
              {CURATED_SYMBOLS.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-sm">
            Direction
            <div role="group" aria-label="Direction" className="flex gap-2">
              <Button
                type="button"
                variant={direction === "long" ? "default" : "outline"}
                size="sm"
                aria-pressed={direction === "long"}
                onClick={() => setDirection("long")}
              >
                Long
              </Button>
              <Button
                type="button"
                variant={direction === "short" ? "default" : "outline"}
                size="sm"
                aria-pressed={direction === "short"}
                onClick={() => setDirection("short")}
              >
                Short
              </Button>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Entry Price
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Stop Loss (optional)
            <input
              type="number"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Take Profit (optional)
            <input
              type="number"
              value={takeProfitPrice}
              onChange={(e) => setTakeProfitPrice(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Units
            <input
              type="number"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Notes
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <div className="flex items-end sm:col-span-3 lg:col-span-7">
            <Button type="submit">Log Trade</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
