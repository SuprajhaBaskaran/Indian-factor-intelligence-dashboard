import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { Badge, Card, StatCard } from "@/components/UI";
import { TermTooltip } from "@/components/TermTooltip";
import { formatPercent, getMarketIndex, getMacroData, getSectorIndex, getNewsArticles, getLatestRegime, getLatestAllocation } from "@/lib/data";

export { MarketViewPage } from "./MarketViewPagePro";

function getMarketTrend(marketIndex: { month: string; close: number | null; return: number | null }[]): { direction: string; label: string; color: string } {
  if (marketIndex.length < 2) return { direction: "unknown", label: "Unknown", color: "slate" };
  const latest = marketIndex[marketIndex.length - 1];
  const prev = marketIndex[marketIndex.length - 2];
  if (!latest?.close || !prev?.close) return { direction: "unknown", label: "Unknown", color: "slate" };
  const change = (latest.close - prev.close) / prev.close;
  if (change > 0.02) return { direction: "up", label: "Rising", color: "green" };
  if (change < -0.02) return { direction: "down", label: "Falling", color: "red" };
  return { direction: "flat", label: "Sideways", color: "slate" };
}

function getVolatilityLevel(vix: number | null | undefined): { label: string; color: string; description: string } {
  if (vix === null || vix === undefined) return { label: "Unknown", color: "slate", description: "VIX data not available" };
  if (vix < 15) return { label: "Low", color: "green", description: "Volatility is low. Markets are calm." };
  if (vix < 25) return { label: "Moderate", color: "amber", description: "Volatility is elevated. Caution is warranted." };
  return { label: "High", color: "red", description: "Volatility is high. Risk appetite is weak." };
}

interface SectorIndexRow {
  month: string;
  index_name: string;
  close: number | null;
  return?: number | null;
}

function getTopSectors(sectorIndex: SectorIndexRow[], n = 5): { name: string; return: number | null }[] {
  if (sectorIndex.length === 0) return [];
  const latestMonth = sectorIndex[sectorIndex.length - 1]?.month;
  const latestSectors = sectorIndex.filter((s) => s.month === latestMonth);
  return latestSectors
    .sort((a, b) => (b.return || 0) - (a.return || 0))
    .slice(0, n)
    .map((s) => ({ name: s.index_name, return: s.return ?? null }));
}

// Kept only as a reference for the previous market screen; the route exports MarketViewPagePro above.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyMarketViewPage() {
  const marketIndex = getMarketIndex();
  const macroData = getMacroData();
  const sectorIndex = getSectorIndex();
  const newsArticles = getNewsArticles(10);
  const latestRegime = getLatestRegime();
  const latestAllocation = getLatestAllocation();

  const latestMacro = macroData[macroData.length - 1];
  const trend = getMarketTrend(marketIndex);
  const volLevel = getVolatilityLevel(latestMacro?.india_vix);
  const topSectors = getTopSectors(sectorIndex);

  const nifty200 = marketIndex.filter((m) => m.index_name === "NIFTY 200");
  const latestNifty = nifty200[nifty200.length - 1];
  const marketAsOf = latestNifty?.month || latestMacro?.month || null;
  const nifty3m = nifty200.length >= 4 ? ((latestNifty?.close || 0) / (nifty200[nifty200.length - 4]?.close || 1) - 1) : null;
  const nifty12m = nifty200.length >= 13 ? ((latestNifty?.close || 0) / (nifty200[nifty200.length - 13]?.close || 1) - 1) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Market</h2>
        <p className="mt-1 text-sm text-slate-500">Why the market is in this state and what it means for your portfolio.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge color={marketAsOf ? "slate" : "amber"}>{marketAsOf ? `Market data month · ${marketAsOf}` : "Market data date unavailable"}</Badge>
          {latestMacro && <Badge color="amber">Macro release timestamps unavailable</Badge>}
        </div>
      </div>

      {/* ── MARKET SNAPSHOT ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Nifty 200"
          value={latestNifty?.close?.toLocaleString() || "—"}
          subvalue={nifty3m !== null ? `${formatPercent(nifty3m, 1)} this quarter` : "—"}
          icon={trend.direction === "up" ? <TrendingUp className="h-5 w-5" /> : trend.direction === "down" ? <TrendingDown className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
          color={trend.color === "green" ? "green" : trend.color === "red" ? "red" : "slate"}
        />
        <StatCard
          label="India VIX"
          value={latestMacro?.india_vix?.toFixed(1) || "—"}
          subvalue={volLevel.label}
          icon={<Activity className="h-5 w-5" />}
          color={volLevel.color === "green" ? "green" : volLevel.color === "amber" ? "amber" : volLevel.color === "red" ? "red" : "slate"}
        />
        <StatCard
          label="10Y G-Sec"
          value={latestMacro?.ten_year_yield?.toFixed(2) || "—"}
          subvalue="Risk-free rate"
          icon={<Minus className="h-5 w-5" />}
          color="slate"
        />
        <StatCard
          label="USD/INR"
          value={latestMacro?.usd_inr?.toFixed(2) || "—"}
          subvalue="Rupee strength"
          icon={<Minus className="h-5 w-5" />}
          color="slate"
        />
      </div>

      {/* ── WHAT IS HAPPENING ───────────────────────────────────────────── */}
      <Card title="What is happening in the market?" subtitle="Simple explanation of current conditions">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={trend.color === "green" ? "green" : trend.color === "red" ? "red" : "slate"}>
              {trend.label}
            </Badge>
            <Badge color={volLevel.color === "green" ? "green" : volLevel.color === "amber" ? "amber" : volLevel.color === "red" ? "red" : "slate"}>
              <TermTooltip term="volatility">Volatility: {volLevel.label}</TermTooltip>
            </Badge>
            {latestRegime && <Badge color="blue"><TermTooltip term="regime">{latestRegime.regime_label}</TermTooltip></Badge>}
          </div>
          <p className="text-sm leading-6 text-slate-600">
            {trend.direction === "up" && "Markets are trending upward. "}
            {trend.direction === "down" && "Markets are trending downward. "}
            {trend.direction === "flat" && "Markets are moving sideways. "}
            {volLevel.description}
          </p>
          {nifty12m !== null && (
            <p className="text-sm leading-6 text-slate-600">
              Over the past 12 months, Nifty 200 has returned {formatPercent(nifty12m, 1)}.
            </p>
          )}
        </div>
      </Card>

      {/* ── WHAT IS DRIVING THE MARKET ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Market Drivers" subtitle="Key factors influencing the market">
          <div className="space-y-3">
            {[
              { label: "Market Trend", value: trend.label, detail: nifty3m !== null ? `${formatPercent(nifty3m, 1)} this quarter` : "—" },
              { label: "Volatility", value: volLevel.label, detail: latestMacro?.india_vix?.toFixed(1) || "—" },
              { label: "Inflation", value: latestMacro?.cpi?.toFixed(1) || "—", detail: "CPI" },
              { label: "Interest Rate", value: latestMacro?.repo_rate?.toFixed(2) || "—", detail: "RBI repo rate" },
              { label: "Currency", value: latestMacro?.usd_inr?.toFixed(2) || "—", detail: "USD/INR" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{item.value}</p>
                </div>
                {item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Sector Performance" subtitle="Top performing sectors this month">
          {topSectors.length > 0 ? (
            <div className="space-y-3">
              {topSectors.map((sector) => (
                <div key={sector.name} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{sector.name}</p>
                  <p className={`text-sm font-semibold ${(sector.return || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatPercent(sector.return || 0, 1)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sector data not available.</p>
          )}
        </Card>
      </div>

      {/* ── HOW THIS AFFECTS YOUR PORTFOLIO ─────────────────────────────── */}
      <Card title="How does this affect your portfolio?" subtitle="What the model is doing in response">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            {latestAllocation && (
              <>
                The model is currently allocating{" "}
                <span className="font-semibold">{formatPercent(latestAllocation.quality_weight ?? 0, 0)} to <TermTooltip term="quality">Quality</TermTooltip></span> and{" "}
                <span className="font-semibold">{formatPercent(latestAllocation.low_volatility_weight ?? 0, 0)} to <TermTooltip term="low volatility">Low Volatility</TermTooltip></span>
                {(latestAllocation.momentum_weight ?? 0) > 0.25 && (
                  <>, with a meaningful <span className="font-semibold">{formatPercent(latestAllocation.momentum_weight ?? 0, 0)} to <TermTooltip term="momentum">Momentum</TermTooltip></span></>
                )}
                {(latestAllocation.value_weight ?? 0) > 0.25 && (
                  <>, and <span className="font-semibold">{formatPercent(latestAllocation.value_weight ?? 0, 0)} to <TermTooltip term="value">Value</TermTooltip></span></>
                )}
                .
              </>
            )}
          </p>
          <div className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <p className="font-semibold">What this means for you</p>
            <p className="mt-1">
              {!latestAllocation
                ? "Current model allocation is unavailable in the loaded data."
                : (latestAllocation.quality_weight ?? 0) > 0.3
                ? "The model is favouring quality companies — those with strong balance sheets and consistent earnings. This is typically a defensive posture."
                : (latestAllocation.momentum_weight ?? 0) > 0.3
                ? "The model is favouring momentum — stocks that have been performing well. This suggests the model sees continued strength."
                : "The model has a balanced approach across factors."}
            </p>
          </div>
        </div>
      </Card>

      {/* ── RECENT NEWS ─────────────────────────────────────────────────── */}
      <Card title="Recent Market News" subtitle="Latest financial news from RSS feeds">
        {newsArticles.length > 0 ? (
          <div className="space-y-3">
            {newsArticles.slice(0, 5).map((article) => (
              <div key={article.article_id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{article.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{article.source} · {article.published_date}</p>
                  </div>
                  {article.is_negative && (
                    <Badge color="red">Negative</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No recent news available.</p>
        )}
      </Card>
    </div>
  );
}
