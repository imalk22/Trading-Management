import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia. next-themes calls it unconditionally
// (even with enableSystem={false}) to watch for OS theme changes, so stub it
// out for every test.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}
