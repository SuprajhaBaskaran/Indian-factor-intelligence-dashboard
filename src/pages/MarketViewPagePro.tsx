import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Gauge,
  Globe2,
  Landmark,
  Newspaper,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Badge, Card, ProgressBar, StatCard } from "@/components/UI";
import {
  formatNumber,
  formatPercent,
  getAllocationDecisions,
  getLatestAllocation,
  getLatestRegime,
  getMacroData,
  getMarketIndex,
  getNewsArticles,
  getNewsDailyFeatures,
  getNewsFeatures,
  getSectorIndex,
} from "@/lib/data";
import type { NewsArticle } from "@/types";

type BadgeColor = "slate" | "blue" | "green" | "red" | "amber" | "purple";

type MarketDriver = {
  label: string;
  value: string;
  detail: string;
  color: BadgeColor;
  icon: ReactNode;
};

type NewsTheme = {
  label: string;
  count: number;
  color: BadgeColor;
  description: string;
};

type RankedArticle = NewsArticle & { relevance?: number };
type SectorReturnRow = {
  month: string;
  index_name: string;
  return: number | null;
};

const themeKeywords: { label: string; color: BadgeColor; keywords: string[]; description: string }[] = [
  {
    label: "RBI and rates",
    color: "blue",
    keywords: ["rbi", "repo", "rate", "yield", "bond", "inflation"],
    description: "Interest-rate expectations, liquidity, and inflation pressure.",
  },
  {
    label: "Crude and currency",
    color: "amber",
    keywords: ["crude", "oil", "rupee", "usd", "dollar", "currency"],
    description: "Imported inflation pressure and foreign-flow sensitivity.",
  },
  {
    label: "Earnings season",
    color: "purple",
    keywords: ["earnings", "results", "q2", "profit", "revenue", "tcs"],
    description: "Company results that can reset sector leadership.",
  },
  {
    label: "Market momentum",
    color: "green",
    keywords: ["nifty", "sensex", "correction", "rally", "support", "resistance"],
    description: "Price action, trend strength, and key index levels.",
  },
];

function cleanSource(source: string): string {
  return source
    .replace(/^www\./, "")
    .replace("economictimes.indiatimes.com", "Economic Times")
    .replace("news.google.com", "Google News")
    .replace(/\.com$/i, "")
    .replace(/\.in$/i, "");
}

function pctClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-slate-500";
  return value >= 0 ? "text-emerald-600" : "text-red-600";
}

function getReturn(rows: { close: number | null }[], monthsBack: number): number | null {
  if (rows.length <= monthsBack) return null;
  const latest = rows[rows.length - 1]?.close;
  const previous = rows[rows.length - 1 - monthsBack]?.close;
  if (!latest || !previous) return null;
  return latest / previous - 1;
}

function getVixLevel(vix: number | null | undefined): { label: string; color: BadgeColor; detail: string } {
  if (vix === null || vix === undefined) {
    return { label: "Not available", color: "slate", detail: "Volatility feed is missing." };
  }
  if (vix < 12) return { label: "Calm", color: "green", detail: "Option markets are pricing low fear." };
  if (vix < 18) return { label: "Normal", color: "blue", detail: "Volatility is manageable, but position size still matters." };
  if (vix < 25) return { label: "Elevated", color: "amber", detail: "Price swings can widen; avoid chasing weak entries." };
  return { label: "Stress", color: "red", detail: "Risk is high; capital protection matters first." };
}

function getSentiment(score: number | null | undefined): { label: string; color: BadgeColor; detail: string } {
  if (score === null || score === undefined) {
    return { label: "Not enough news", color: "slate", detail: "News signal is too thin to classify." };
  }
  if (score > 0.15) return { label: "Constructive", color: "green", detail: "Recent headlines lean supportive." };
  if (score < -0.15) return { label: "Cautious", color: "amber", detail: "Recent headlines lean risk-aware." };
  return { label: "Mixed", color: "slate", detail: "News flow is balanced, not one-sided." };
}

function getMarketVerdict({
  monthReturn,
  threeMonthReturn,
  vix,
  negativeRatio,
}: {
  monthReturn: number | null;
  threeMonthReturn: number | null;
  vix: number | null | undefined;
  negativeRatio: number | null | undefined;
}): { label: string; color: BadgeColor; title: string; detail: string; action: string } {
  const pressure =
    (monthReturn !== null && monthReturn < -0.03 ? 2 : 0) +
    (threeMonthReturn !== null && threeMonthReturn < -0.05 ? 2 : 0) +
    (vix !== null && vix !== undefined && vix >= 18 ? 1 : 0) +
    (negativeRatio !== null && negativeRatio !== undefined && negativeRatio > 0.3 ? 1 : 0);

  if (pressure >= 4) {
    return {
      label: "Defensive market",
      color: "red",
      title: "Protect capital before looking for fresh upside.",
      detail: "The index trend, volatility, and news flow are not aligned enough for aggressive risk-taking.",
      action: "Use the trade plan, avoid oversized fresh buys, and prefer staggered entries.",
    };
  }
  if (pressure >= 2) {
    return {
      label: "Selective market",
      color: "amber",
      title: "Opportunities exist, but quality of entry matters.",
      detail: "The market is digesting macro and earnings triggers, so broad buying can feel noisy.",
      action: "Focus on model-ranked stocks and keep cash ready for confirmation.",
    };
  }
  return {
    label: "Constructive market",
    color: "green",
    title: "The backdrop is supportive enough to stay engaged.",
    detail: "Trend pressure is contained and the model can take measured factor exposure.",
    action: "Follow the latest plan and review sector leadership before adding risk.",
  };
}

function getLatestByMonth<T extends { month: string }>(rows: T[]): T | null {
  return rows.length > 0 ? [...rows].sort((a, b) => a.month.localeCompare(b.month)).at(-1) ?? null : null;
}

function buildNewsThemes(articles: NewsArticle[]): NewsTheme[] {
  return themeKeywords
    .map((theme) => {
      const count = articles.filter((article) => {
        const text = `${article.title} ${article.summary}`.toLowerCase();
        return theme.keywords.some((keyword) => text.includes(keyword));
      }).length;
      return { label: theme.label, color: theme.color, description: theme.description, count };
    })
    .filter((theme) => theme.count > 0)
    .sort((a, b) => b.count - a.count);
}

function getRelevantNews(articles: NewsArticle[]): NewsArticle[] {
  return [...articles]
    .filter((article) => article.summary && !article.feed_url.includes("cryptocurrency"))
    .sort((a, b) => {
      const relevanceA = (a as RankedArticle).relevance ?? 0;
      const relevanceB = (b as RankedArticle).relevance ?? 0;
      return relevanceB - relevanceA || b.published_at.localeCompare(a.published_at);
    })
    .slice(0, 6);
}

function toSectorReturn(row: { month: string; index_name: string; [key: string]: unknown }): SectorReturnRow {
  return {
    month: row.month,
    index_name: row.index_name,
    return: typeof row.return === "number" ? row.return : null,
  };
}

export function MarketViewPage() {
  const nifty200 = getMarketIndex("NIFTY 200");
  const vixRows = getMarketIndex("INDIA VIX");
  const macroData = getMacroData();
  const sectorIndex = getSectorIndex();
  const newsArticles = getNewsArticles(40);
  const newsDaily = getNewsDailyFeatures();
  const newsMonthly = getNewsFeatures();
  const latestRegime = getLatestRegime();
  const latestAllocation = getLatestAllocation();
  const latestDecision = getLatestByMonth(getAllocationDecisions());

  const latestNifty = nifty200.at(-1);
  const latestVix = vixRows.at(-1);
  const latestMacro = macroData.at(-1);
  const latestDailyNews = newsDaily.at(-1);
  const latestMonthlyNews = getLatestByMonth(newsMonthly);
  const marketAsOf = latestNifty?.month || latestMacro?.month || "latest model month";

  const oneMonthReturn = latestNifty?.return ?? null;
  const threeMonthReturn = getReturn(nifty200, 3);
  const sixMonthReturn = getReturn(nifty200, 6);
  const twelveMonthReturn = getReturn(nifty200, 12);
  const vixLevel = getVixLevel(latestMacro?.india_vix ?? latestVix?.close);
  const sentiment = getSentiment(latestDailyNews?.sentiment_score ?? latestMonthlyNews?.sentiment_score);
  const verdict = getMarketVerdict({
    monthReturn: oneMonthReturn,
    threeMonthReturn,
    vix: latestMacro?.india_vix ?? latestVix?.close,
    negativeRatio: latestDailyNews?.negative_ratio ?? latestMonthlyNews?.negative_ratio,
  });

  const sectorRows = sectorIndex.map(toSectorReturn);
  const latestSectorMonth = sectorRows.map((row) => row.month).sort().at(-1);
  const sectors = sectorRows
    .filter((row) => row.month === latestSectorMonth)
    .sort((a, b) => (b.return ?? -Infinity) - (a.return ?? -Infinity));
  const positiveSectorCount = sectors.filter((row) => (row.return ?? 0) > 0).length;
  const breadth = sectors.length > 0 ? positiveSectorCount / sectors.length : null;
  const topSectors = sectors.slice(0, 5);
  const weakSectors = [...sectors].reverse().slice(0, 3);
  const curatedNews = getRelevantNews(newsArticles);
  const newsThemes = buildNewsThemes(newsArticles);

  const drivers: MarketDriver[] = [
    {
      label: "Trend",
      value: formatPercent(oneMonthReturn, 1),
      detail: threeMonthReturn !== null ? `${formatPercent(threeMonthReturn, 1)} over 3 months` : "Monthly index move",
      color: oneMonthReturn !== null && oneMonthReturn >= 0 ? "green" : "red",
      icon: oneMonthReturn !== null && oneMonthReturn >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
    },
    {
      label: "Volatility",
      value: vixLevel.label,
      detail: vixLevel.detail,
      color: vixLevel.color,
      icon: <Gauge className="h-4 w-4" />,
    },
    {
      label: "Rates",
      value: latestMacro?.repo_rate !== null && latestMacro?.repo_rate !== undefined ? `${latestMacro.repo_rate.toFixed(2)}% repo` : "-",
      detail: latestMacro?.ten_year_yield !== null && latestMacro?.ten_year_yield !== undefined ? `${latestMacro.ten_year_yield.toFixed(2)}% 10Y yield` : "Yield data unavailable",
      color: "blue",
      icon: <Landmark className="h-4 w-4" />,
    },
    {
      label: "Global pressure",
      value: latestMacro?.usd_inr !== null && latestMacro?.usd_inr !== undefined ? `USD/INR ${latestMacro.usd_inr.toFixed(2)}` : "-",
      detail: latestMacro?.crude_oil !== null && latestMacro?.crude_oil !== undefined ? `Crude ${latestMacro.crude_oil.toFixed(1)}` : "Currency and crude watch",
      color: "amber",
      icon: <Globe2 className="h-4 w-4" />,
    },
  ];

  const allocationRows = latestAllocation
    ? [
        { label: "Momentum", value: latestAllocation.momentum_weight, color: "#2563eb" },
        { label: "Value", value: latestAllocation.value_weight, color: "#059669" },
        { label: "Quality", value: latestAllocation.quality_weight, color: "#7c3aed" },
        { label: "Low Vol", value: latestAllocation.low_volatility_weight, color: "#d97706" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Market</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            A simple market briefing: what changed, what is driving it, and how the model is positioned.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="slate">
            <CalendarDays className="mr-1 h-3.5 w-3.5" />
            Snapshot: {marketAsOf}
          </Badge>
          {latestRegime && <Badge color="blue">Regime: {latestRegime.regime_label}</Badge>}
          <Badge color={verdict.color}>{verdict.label}</Badge>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={verdict.color}>Market read</Badge>
              <Badge color={sentiment.color}>News: {sentiment.label}</Badge>
              <Badge color={vixLevel.color}>VIX: {vixLevel.label}</Badge>
            </div>
            <h3 className="mt-4 text-2xl font-bold tracking-normal text-slate-950">{verdict.title}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{verdict.detail}</p>
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-slate-50 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <p className="text-sm leading-6 text-slate-700">
                <span className="font-semibold text-slate-950">User action:</span> {verdict.action}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Nifty 200 close</p>
              <p className="mt-1 text-xl font-bold text-slate-950">{latestNifty?.close?.toLocaleString("en-IN") ?? "-"}</p>
              <p className={`mt-1 text-xs font-semibold ${pctClass(oneMonthReturn)}`}>{formatPercent(oneMonthReturn, 1)} this month</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Sector breadth</p>
              <p className="mt-1 text-xl font-bold text-slate-950">{breadth !== null ? `${positiveSectorCount}/${sectors.length}` : "-"}</p>
              <p className="mt-1 text-xs text-slate-500">sectors positive this month</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">News coverage</p>
              <p className="mt-1 text-xl font-bold text-slate-950">{latestDailyNews?.article_count ?? latestMonthlyNews?.article_count ?? "-"}</p>
              <p className="mt-1 text-xs text-slate-500">articles in latest signal</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="1M / 3M trend"
          value={<span className={pctClass(oneMonthReturn)}>{formatPercent(oneMonthReturn, 1)}</span>}
          subvalue={`3M ${formatPercent(threeMonthReturn, 1)}`}
          icon={<BarChart3 className="h-5 w-5" />}
          color={oneMonthReturn !== null && oneMonthReturn >= 0 ? "green" : "red"}
        />
        <StatCard
          label="India VIX"
          value={formatNumber(latestMacro?.india_vix ?? latestVix?.close, 1)}
          subvalue={vixLevel.label}
          icon={<Activity className="h-5 w-5" />}
          color={vixLevel.color}
        />
        <StatCard
          label="Rates"
          value={latestMacro?.repo_rate !== null && latestMacro?.repo_rate !== undefined ? `${latestMacro.repo_rate.toFixed(2)}%` : "-"}
          subvalue={latestMacro?.ten_year_yield !== null && latestMacro?.ten_year_yield !== undefined ? `10Y ${latestMacro.ten_year_yield.toFixed(2)}%` : "10Y yield unavailable"}
          icon={<Landmark className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="USD/INR"
          value={formatNumber(latestMacro?.usd_inr, 2)}
          subvalue={latestMacro?.crude_oil !== null && latestMacro?.crude_oil !== undefined ? `Crude ${latestMacro.crude_oil.toFixed(1)}` : "Crude watch"}
          icon={<Globe2 className="h-5 w-5" />}
          color="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card title="What Is Moving The Market" subtitle="The four drivers worth checking before acting">
          <div className="grid gap-3 sm:grid-cols-2">
            {drivers.map((driver) => (
              <div key={driver.label} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600">{driver.icon}</span>
                    <p className="text-xs font-semibold uppercase text-slate-500">{driver.label}</p>
                  </div>
                  <Badge color={driver.color}>{driver.value}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{driver.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Model Positioning" subtitle="How the factor engine is reacting">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {latestDecision && <Badge color="blue">{latestDecision.decision}</Badge>}
              {latestAllocation && <Badge color="slate">{latestAllocation.regime_label}</Badge>}
            </div>
            {allocationRows.length > 0 ? (
              <div className="space-y-3">
                {allocationRows.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{row.label}</span>
                      <span className="text-slate-500">{formatPercent(row.value, 0)}</span>
                    </div>
                    <ProgressBar value={row.value ?? 0} color={row.color} height={7} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Model allocation is unavailable in the loaded data.</p>
            )}
            <p className="rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-900">
              {latestDecision?.reason || "The model converts market regime, factor strength, and risk controls into a monthly allocation."}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card title="Sector Map" subtitle="Leadership and weakness in the latest month">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Leaders</p>
              <div className="space-y-3">
                {topSectors.map((sector) => (
                  <div key={sector.index_name}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-slate-800">{sector.index_name.replace("NIFTY ", "")}</span>
                      <span className={pctClass(sector.return)}>{formatPercent(sector.return, 1)}</span>
                    </div>
                    <ProgressBar value={Math.max(0.01, Math.abs(sector.return ?? 0))} max={0.12} color={(sector.return ?? 0) >= 0 ? "#059669" : "#dc2626"} height={6} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Pressure pockets</p>
              <div className="space-y-3">
                {weakSectors.map((sector) => (
                  <div key={sector.index_name}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-slate-800">{sector.index_name.replace("NIFTY ", "")}</span>
                      <span className={pctClass(sector.return)}>{formatPercent(sector.return, 1)}</span>
                    </div>
                    <ProgressBar value={Math.max(0.01, Math.abs(sector.return ?? 0))} max={0.12} color={(sector.return ?? 0) >= 0 ? "#059669" : "#dc2626"} height={6} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {breadth !== null && (
            <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              Breadth is {formatPercent(breadth, 0)}: {positiveSectorCount} out of {sectors.length} sectors are positive in the latest month.
            </p>
          )}
        </Card>

        <Card title="Timeframe Check" subtitle="Short-term noise versus longer-term trend">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "1 month", value: oneMonthReturn },
              { label: "6 months", value: sixMonthReturn },
              { label: "12 months", value: twelveMonthReturn },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className={`mt-2 text-2xl font-bold ${pctClass(item.value)}`}>{formatPercent(item.value, 1)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <WalletCards className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <p className="text-sm leading-6 text-slate-600">
                For users, the important question is not just whether the market is up or down. It is whether the current trend agrees with volatility, sector breadth, and the model's allocation.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Market News Brief" subtitle="Grouped themes first, individual articles second">
        {newsThemes.length > 0 && (
          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {newsThemes.slice(0, 4).map((theme) => (
              <div key={theme.label} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge color={theme.color}>{theme.label}</Badge>
                  <span className="text-xs font-semibold text-slate-500">{theme.count}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{theme.description}</p>
              </div>
            ))}
          </div>
        )}

        {curatedNews.length > 0 ? (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {curatedNews.map((article) => {
              const articleSentiment = article.sentiment <= -0.5 ? "Risk watch" : article.sentiment >= 0.5 ? "Supportive" : "Context";
              const articleColor: BadgeColor = article.sentiment <= -0.5 ? "amber" : article.sentiment >= 0.5 ? "green" : "slate";
              return (
                <a
                  key={article.article_id}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col gap-3 p-4 transition hover:bg-slate-50 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={articleColor}>{articleSentiment}</Badge>
                      <span className="text-xs text-slate-500">{cleanSource(article.source)} - {article.published_date}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">{article.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{article.summary}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700">
                    Read <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
            <Newspaper className="mt-0.5 h-5 w-5 text-slate-400" />
            <p className="text-sm text-slate-500">No relevant market news is available in the loaded feed.</p>
          </div>
        )}
        <div className="mt-4 flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            News labels are used as context, not as buy or sell calls. The trade plan remains model-driven and should be reviewed before acting.
          </p>
        </div>
      </Card>
    </div>
  );
}
