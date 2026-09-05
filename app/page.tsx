import { TickerStrip } from "@/components/markets/ticker-strip";
import { MarketsList } from "@/components/markets/markets-list";
import { ChartPanel } from "@/components/markets/chart-panel";
import { OrderBookPanel } from "@/components/markets/order-book-panel";
import { RecentTradesPanel } from "@/components/markets/recent-trades-panel";
import { FearGreedPanel } from "@/components/markets/stat-panels/fear-greed-panel";
import { SentimentPanel } from "@/components/markets/stat-panels/sentiment-panel";
import { LeadersPanel } from "@/components/markets/stat-panels/leaders-panel";
import { SessionPanel } from "@/components/markets/stat-panels/session-panel";
import { GlobalPanel } from "@/components/markets/stat-panels/global-panel";

export default function Home() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <TickerStrip />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_280px]">
        <aside className="order-2 lg:order-1">
          <MarketsList />
        </aside>
        <section className="order-1 lg:order-2">
          <ChartPanel />
        </section>
        <aside className="order-3 flex flex-col gap-4">
          <OrderBookPanel />
          <RecentTradesPanel />
        </aside>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FearGreedPanel />
        <SentimentPanel />
        <LeadersPanel />
        <SessionPanel />
        <GlobalPanel />
      </div>
    </main>
  );
}
