import type { GlobalStats } from "@/app/api/global-stats/route";

export async function fetchGlobalStats(): Promise<GlobalStats> {
  const res = await fetch("/api/global-stats");
  if (!res.ok) throw new Error(`Global stats request failed: ${res.status}`);
  return res.json();
}
