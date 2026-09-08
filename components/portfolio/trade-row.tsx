"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeTradePnl } from "@/lib/portfolio/calculations";
import { formatPrice, formatPercent } from "@/lib/format";
import type { Trade } from "@/lib/portfolio/types";

export interface TradeRowProps {
  trade: Trade;
  currentPrice?: number;
  onClose?: (id: string, exitPrice: number) => void;
  onDelete: (id: string) => void;
}

export function TradeRow({ trade, currentPrice, onClose, onDelete }: TradeRowProps) {
  const [showCloseInput, setShowCloseInput] = useState(false);
  const [exitPriceInput, setExitPriceInput] = useState("");

  const isOpen = trade.closedAt === null;
  const priceForPnl = isOpen ? currentPrice : trade.exitPrice ?? undefined;
  const pnl = priceForPnl !== undefined ? computeTradePnl(trade, priceForPnl) : null;

  function handleConfirmClose() {
    const parsed = Number(exitPriceInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || !onClose) return;
    onClose(trade.id, parsed);
    setShowCloseInput(false);
    setExitPriceInput("");
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <Badge variant={trade.direction === "long" ? "up" : "down"}>{trade.direction}</Badge>
          <span className="text-sm font-medium">{trade.symbol}</span>
          <span className="text-xs text-muted-foreground">
            Entry: {formatPrice(trade.entryPrice)} × {trade.units}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {pnl ? (
            <span className={`text-sm font-medium ${pnl.pnlAmount >= 0 ? "text-up" : "text-down"}`}>
              {formatPrice(pnl.pnlAmount)} ({formatPercent(pnl.pnlPercent)})
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Live price unavailable</span>
          )}
          {isOpen && onClose && !showCloseInput && (
            <Button size="sm" variant="outline" onClick={() => setShowCloseInput(true)}>
              Close
            </Button>
          )}
          {isOpen && onClose && showCloseInput && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Exit price"
                aria-label="Exit price"
                value={exitPriceInput}
                onChange={(e) => setExitPriceInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmClose()}
                className="w-24 rounded-lg border border-border bg-muted px-2 py-1 text-xs outline-none"
              />
              <Button size="sm" onClick={handleConfirmClose}>
                Confirm
              </Button>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDelete(trade.id)}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
