import { create } from "zustand";
import { DEFAULT_SYMBOL } from "@/lib/symbols";

interface SymbolStore {
  selectedSymbol: string;
  selectSymbol: (symbol: string) => void;
}

export const useSymbolStore = create<SymbolStore>((set) => ({
  selectedSymbol: DEFAULT_SYMBOL,
  selectSymbol: (symbol) => set({ selectedSymbol: symbol }),
}));
