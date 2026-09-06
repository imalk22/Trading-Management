import { create } from "zustand";

export const DEFAULT_ACCOUNT_BALANCE = 10000;
export const DEFAULT_RISK_PERCENT = 1;
export const ACCOUNT_SETTINGS_STORAGE_KEY = "trade-analyzer-account-settings";

interface PersistedAccountSettings {
  accountBalance: number;
  riskPercent: number;
}

interface AccountSettingsState extends PersistedAccountSettings {
  setAccountBalance: (value: number) => void;
  setRiskPercent: (value: number) => void;
}

function persistAccountSettings(settings: PersistedAccountSettings): void {
  try {
    window.localStorage.setItem(ACCOUNT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage may be unavailable (private browsing, disabled) - settings just won't persist
  }
}

export const useAccountSettingsStore = create<AccountSettingsState>((set, get) => ({
  accountBalance: DEFAULT_ACCOUNT_BALANCE,
  riskPercent: DEFAULT_RISK_PERCENT,
  setAccountBalance: (value) => {
    set({ accountBalance: value });
    persistAccountSettings({ accountBalance: value, riskPercent: get().riskPercent });
  },
  setRiskPercent: (value) => {
    set({ riskPercent: value });
    persistAccountSettings({ accountBalance: get().accountBalance, riskPercent: value });
  },
}));

export function loadPersistedAccountSettings(): PersistedAccountSettings | null {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.accountBalance === "number" && typeof parsed.riskPercent === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function hydrateAccountSettingsFromStorage(): void {
  const loaded = loadPersistedAccountSettings();
  if (loaded) {
    useAccountSettingsStore.setState(loaded);
  }
}
