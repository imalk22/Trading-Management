export function formatPrice(value: number): string {
  const magnitude = Math.abs(value);
  const fractionDigits = magnitude >= 1 ? 2 : magnitude >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value: number): string {
  const rounded = Number(value.toFixed(2));
  const formatted = Math.abs(rounded).toFixed(2);
  if (rounded > 0) return `+${formatted}%`;
  if (rounded < 0) return `-${formatted}%`;
  return `${formatted}%`;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
