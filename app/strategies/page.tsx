import { STRATEGIES, type StrategyCategory } from "@/lib/strategies/data";
import { StrategyCard } from "@/components/strategies/strategy-card";

export default function StrategiesPage() {
  const categories = Array.from(new Set(STRATEGIES.map((s) => s.category))) as StrategyCategory[];

  return (
    <main className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Strategies</h1>
        <p className="text-sm text-muted-foreground">
          Learn how common trading strategies work, with an animated example of each one playing
          out. Every example uses the same simplified 2:1 reward-to-risk ratio for its
          take-profit and stop-loss levels, so that part isn&apos;t unique to any one strategy.
        </p>
      </div>
      {categories.map((category) => (
        <section key={category} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{category}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {STRATEGIES.filter((s) => s.category === category).map((strategy) => (
              <StrategyCard key={strategy.id} strategy={strategy} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
