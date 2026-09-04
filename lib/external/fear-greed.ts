export interface FearGreed {
  value: number;
  classification: string;
}

export async function fetchFearGreed(): Promise<FearGreed> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1");
  if (!res.ok) throw new Error(`Fear & Greed request failed: ${res.status}`);
  const data = await res.json();
  const latest = data.data[0];
  return { value: Number(latest.value), classification: latest.value_classification };
}
