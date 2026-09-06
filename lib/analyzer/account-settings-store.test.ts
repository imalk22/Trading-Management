import { describe, it, expect, beforeEach } from "vitest";
import {
  useAccountSettingsStore,
  hydrateAccountSettingsFromStorage,
  loadPersistedAccountSettings,
  ACCOUNT_SETTINGS_STORAGE_KEY,
  DEFAULT_ACCOUNT_BALANCE,
  DEFAULT_RISK_PERCENT,
} from "./account-settings-store";

describe("account settings store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAccountSettingsStore.setState({
      accountBalance: DEFAULT_ACCOUNT_BALANCE,
      riskPercent: DEFAULT_RISK_PERCENT,
    });
  });

  it("initializes with default account balance and risk percent", () => {
    expect(useAccountSettingsStore.getState().accountBalance).toBe(DEFAULT_ACCOUNT_BALANCE);
    expect(useAccountSettingsStore.getState().riskPercent).toBe(DEFAULT_RISK_PERCENT);
  });

  it("setAccountBalance updates the store and persists to localStorage", () => {
    useAccountSettingsStore.getState().setAccountBalance(5000);
    expect(useAccountSettingsStore.getState().accountBalance).toBe(5000);
    const stored = JSON.parse(window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY)!);
    expect(stored.accountBalance).toBe(5000);
  });

  it("setRiskPercent updates the store and persists to localStorage", () => {
    useAccountSettingsStore.getState().setRiskPercent(2.5);
    expect(useAccountSettingsStore.getState().riskPercent).toBe(2.5);
    const stored = JSON.parse(window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY)!);
    expect(stored.riskPercent).toBe(2.5);
  });

  it("hydrateAccountSettingsFromStorage loads previously persisted values into the store", () => {
    window.localStorage.setItem(
      ACCOUNT_SETTINGS_STORAGE_KEY,
      JSON.stringify({ accountBalance: 7500, riskPercent: 3 })
    );
    hydrateAccountSettingsFromStorage();
    expect(useAccountSettingsStore.getState().accountBalance).toBe(7500);
    expect(useAccountSettingsStore.getState().riskPercent).toBe(3);
  });

  it("hydrateAccountSettingsFromStorage leaves the store unchanged when nothing is stored", () => {
    hydrateAccountSettingsFromStorage();
    expect(useAccountSettingsStore.getState().accountBalance).toBe(DEFAULT_ACCOUNT_BALANCE);
    expect(useAccountSettingsStore.getState().riskPercent).toBe(DEFAULT_RISK_PERCENT);
  });

  it("loadPersistedAccountSettings returns null for malformed JSON", () => {
    window.localStorage.setItem(ACCOUNT_SETTINGS_STORAGE_KEY, "not valid json");
    expect(loadPersistedAccountSettings()).toBeNull();
  });
});
