import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge, Card, SignalBadge, Table } from "@/components/UI";
import { TermTooltip } from "@/components/TermTooltip";
import { formatPercent, getNifty500DataAudit, getRecommendationUniverses, getSignalEvents, getStockPrices, getStockSymbols, getStocks } from "@/lib/data";
import { buildTradePlan, formatCurrency } from "@/lib/product";
import { useUserData } from "@/lib/userData";
import type { StockPricePoint, StockSignalEvent } from "@/types";

type StockSearchRow = {
  symbol: string;
  name: string;
  sector: string;
  source: "recommendation" | "research";
  hasPriceData: boolean;
};

export function StockInspectorPage() {
  const userData = useUserData();
  const [holdings, setHoldings] = useState<{symbol:string;quantity:number;avgPrice?:number}[]>([]);
  const [cash, setCash] = useState(0);
  const [holdingsLoading, setHoldingsLoading] = useState(true);
  const [holdingsError, setHoldingsError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([userData.getHoldings(), userData.getCash()]).then(([h, c]) => {
      if (!cancelled) { setHoldings(h); setCash(c); setHoldingsLoading(false); }
    }).catch(() => { if (!cancelled) { setHoldingsError(true); setHoldingsLoading(false); } });
    return () => { cancelled = true; };
  }, [userData]);
  const symbols = getStockSymbols();
  const stockNames = getStocks();
  const nifty500Audit = getNifty500DataAudit();
  const recommendationUniverses = getRecommendationUniverses();
  const nifty500Rows = useMemo(() => nifty500Audit?.rows || [], [nifty500Audit]);
  const [recommendationMode, setRecommendationMode] = useState<"nifty200" | "nifty500">("nifty500");
  const [symbol, setSymbol] = useState(symbols.includes("PFC") ? "PFC" : symbols[0] || "");
  const [search, setSearch] = useState(symbol);
  const normalized = symbol.trim().toUpperCase();
  const priceCoveredSymbols = useMemo(() => new Set(symbols.map((item) => item.replace(/-/g, "").toUpperCase())), [symbols]);
  const stockSearchRows = useMemo(() => {
    const bySymbol = new Map<string, StockSearchRow>();
    stockNames
      .filter((stock) => symbols.includes(stock.symbol))
      .forEach((stock) => bySymbol.set(stock.symbol, { ...stock, source: "recommendation", hasPriceData: true }));
    nifty500Rows.forEach((row) => {
      if (!bySymbol.has(row.symbol)) {
        bySymbol.set(row.symbol, {
          symbol: row.symbol,
          name: row.companyName,
          sector: row.industry,
          source: "research",
          hasPriceData: row.hasMonthlyPrice || priceCoveredSymbols.has(row.symbol),
        });
      }
    });
    return Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [nifty500Rows, priceCoveredSymbols, stockNames, symbols]);
  const query = search.trim().toLowerCase();
  const searchResults = query
    ? stockSearchRows
      .filter((stock) => `${stock.symbol} ${stock.name} ${stock.sector}`.toLowerCase().includes(query))
      .slice(0, 40)
    : stockSearchRows;
  const discoveryRow = nifty500Rows.find((item) => item.symbol === normalized);
  const preview = buildTradePlan(holdings, cash);
  const row = preview.rows.find((item) => item.symbol === normalized);
  const selectedSearchStock = stockSearchRows.find((item) => item.symbol === normalized);
  const recommendationUniverse = recommendationUniverses?.universes[recommendationMode] || null;
  const recommendationRows = recommendationUniverse?.rows.slice(0, recommendationMode === "nifty200" ? 60 : 100) || [];
  const selectedCandidate = recommendationUniverses?.universes.nifty500.rows.find((item) => item.symbol === normalized);
  const signals = useMemo(() => getSignalEvents(normalized).slice(-20).reverse(), [normalized]);
  const prices = getStockPrices(normalized);
  const latestPricePoint = prices[prices.length - 1];
  const hasVerifiedPriceHistory = prices.some((price) => Number(price.adjusted_close || price.close || 0) > 0);
  const latestPrice = latestPricePoint?.adjusted_close || latestPricePoint?.close || row?.latestPrice || discoveryRow?.latestClose || 0;
  const priceSource = latestPricePoint
    ? `Monthly price history, ${latestPricePoint.month}`
    : discoveryRow?.latestClose
      ? `Research coverage price, ${discoveryRow.lastPriceMonth}`
    : selectedSearchStock
      ? "Price history will appear when the exchange file includes this symbol"
      : "Select a stock from search";
  const stockReadiness = row
    ? "trade-ready"
    : discoveryRow?.hasMonthlyPrice || hasVerifiedPriceHistory
      ? "research-only"
      : discoveryRow
        ? "needs-data"
        : "not-loaded";
  const hasPortfolioContext = holdings.length > 0 || cash > 0;
  const currentModelWeight = row?.targetWeight || signals[0]?.new_weight || 0;
  const latestSignal = row ? signals[0]?.signal_type || (currentModelWeight > 0 ? "IN MODEL" : "HOLD") : stockReadiness === "needs-data" ? "LIMITED" : "NOT SELECTED";
  const actionText = row
    ? row.finalTradeQuantity > 0
      ? `Buy ${row.finalTradeQuantity}`
      : row.finalTradeQuantity < 0
        ? `Sell ${Math.abs(row.finalTradeQuantity)}`
        : hasPortfolioContext
          ? "No trade now"
          : "Add cash or holdings"
    : stockReadiness === "needs-data" ? "Limited coverage" : "No model action";
  const actionTone = row?.finalTradeQuantity && row.finalTradeQuantity !== 0 ? "blue" : row ? "slate" : "amber";
  const actionExplanation = row
    ? !hasPortfolioContext
      ? "You have no saved holdings or plan cash yet, so this page can show the model view but cannot calculate your personal quantity."
      : row.reason
    : stockReadiness === "needs-data"
      ? "This stock is present in the broader exchange list, but the local price file does not include enough history yet for a chart or action."
      : "This stock has real price history for research, but the current monthly model has not selected it for a buy/sell action.";

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stocks</h2>
          <p className="mt-1 text-sm text-slate-500">Search the Nifty 500, view real price history, and see when the model has an actual action.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge color="blue">Model action</Badge>
          <Badge color="green">Price history</Badge>
        </div>
      </div>

      <Card
        title="AI Recommendations"
        subtitle="Choose the recommendation universe. Nifty 200 is the validated portfolio model; Nifty 500 is a broader real-price candidate scan."
      >
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {[
            { id: "nifty200" as const, title: "Nifty 200 model basket", detail: "Validated monthly portfolio targets with factor sleeves and constraints." },
            { id: "nifty500" as const, title: "Nifty 500 AI candidates", detail: "Weighted price-risk ensemble with Bayesian shrinkage for shorter histories." },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRecommendationMode(option.id)}
              className={`rounded-lg border p-3 text-left transition ${
                recommendationMode === option.id
                  ? "border-blue-300 bg-blue-50 text-blue-950"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <p className="text-sm font-bold">{option.title}</p>
              <p className="mt-1 text-xs leading-5">{option.detail}</p>
            </button>
          ))}
        </div>

        {recommendationUniverse ? (
          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{recommendationUniverse.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {recommendationMode === "nifty500"
                  ? `${recommendationUniverse.topCandidateCount || 0} candidates`
                  : `${recommendationUniverse.count} model stocks`}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{recommendationUniverse.method}</p>
              {recommendationUniverse.validationNote && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  {recommendationUniverse.validationNote}
                </p>
              )}
            </div>
            <div className="grid max-h-[440px] gap-2 overflow-auto pr-1 md:grid-cols-2 2xl:grid-cols-3">
              {recommendationRows.map((item) => (
                <button
                  key={`${recommendationMode}-${item.symbol}`}
                  type="button"
                  onClick={() => { setSymbol(item.symbol); setSearch(item.symbol); }}
                  className={`rounded-lg border p-3 text-left transition ${
                    normalized === item.symbol
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950">#{item.rank} {item.symbol}</p>
                      {item.name && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.name}</p>}
                    </div>
                    <Badge color={item.recommendation === "AI candidate" || item.recommendation === "Model basket" ? "green" : item.recommendation === "Watchlist" ? "amber" : "slate"} size="xs">
                      {item.recommendation}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <span className="rounded-md bg-slate-50 px-2 py-1 text-slate-600">
                      {recommendationMode === "nifty200" ? "Weight" : "12m"}
                      <b className="ml-1 text-slate-950">{recommendationMode === "nifty200" ? formatPercent(item.targetWeight || 0, 2) : formatPercent(item.ret12m, 1)}</b>
                    </span>
                    <span className="rounded-md bg-slate-50 px-2 py-1 text-slate-600">
                      {recommendationMode === "nifty200" ? "Score" : "Risk"}
                      <b className="ml-1 text-slate-950">{recommendationMode === "nifty200" ? (item.score ?? 0).toFixed(2) : formatPercent(item.vol12m, 1)}</b>
                    </span>
                    <span className="rounded-md bg-slate-50 px-2 py-1 text-slate-600">
                      Conf
                      <b className="ml-1 text-slate-950">{item.confidence == null ? "High" : formatPercent(item.confidence, 0)}</b>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Recommendation universe data has not loaded yet. Run the model-data export before using this panel.
          </div>
        )}
      </Card>

      <Card title="Search Stocks" subtitle={`${stockSearchRows.length} stocks loaded. Type a symbol, company, or sector; press Enter to open the first match.`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            role="combobox"
            aria-expanded={searchResults.length > 0}
            aria-controls="stock-search-options"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && searchResults[0]) { event.preventDefault(); setSymbol(searchResults[0].symbol); setSearch(searchResults[0].symbol); } }}
            className="w-full rounded-lg border border-slate-300 py-3 pl-9 pr-3 text-sm font-semibold uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Search symbol, company, or sector"
          />
        </div>
        <div id="stock-search-options" role="listbox" className="mt-4 grid max-h-[360px] gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {searchResults.map((stock) => (
            <button
              key={stock.symbol}
              type="button"
              role="option"
              aria-selected={normalized === stock.symbol}
              onClick={() => { setSymbol(stock.symbol); setSearch(stock.symbol); }}
              className={`min-w-0 rounded-lg border p-3 text-left transition ${
                normalized === stock.symbol
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-950">{stock.symbol}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{stock.name}</p>
                </div>
                <Badge color={stock.source === "recommendation" ? "blue" : stock.hasPriceData ? "green" : "slate"} size="xs">
                  {stock.source === "recommendation" ? "Model action" : stock.hasPriceData ? "Price history" : "Limited"}
                </Badge>
              </div>
              <p className="mt-2 truncate text-xs text-slate-500">{stock.sector || "Sector unavailable"}</p>
            </button>
          ))}
        </div>
      </Card>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-4 border-b border-slate-100 p-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl font-bold text-slate-950">{normalized || "Select a stock"}</h3>
                    {row && <Badge color="blue">Model action</Badge>}
                    {!row && stockReadiness === "research-only" && <Badge color="green">Price history</Badge>}
                    {!row && stockReadiness === "needs-data" && <Badge color="slate">Limited</Badge>}
                    {!row && !discoveryRow && <Badge color="slate">Not loaded</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedSearchStock?.name || discoveryRow?.companyName || "Company name unavailable"}
                    {(selectedSearchStock?.sector || discoveryRow?.industry || row?.sector) && (
                      <span> | {selectedSearchStock?.sector || discoveryRow?.industry || row?.sector}</span>
                    )}
                  </p>
                  {!row && discoveryRow && (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                      {stockReadiness === "needs-data"
                        ? "This stock is present in the broader exchange list, but the local price file does not include enough history yet for a chart."
                        : "Real monthly price history is available. The current monthly model has not selected this stock, so there is no buy/sell action right now."}
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 lg:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference price</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{latestPrice > 0 ? formatCurrency(latestPrice) : "Not available"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{priceSource}</p>
                </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <QuoteMetric label="Status" value={row ? "Model basket" : stockReadiness === "needs-data" ? "Limited coverage" : discoveryRow ? "Covered stock" : "Not in dataset"} />
              <QuoteMetric label="Target weight" value={row ? formatPercent(currentModelWeight, 2) : "Not selected"} />
              <QuoteMetric label="Latest signal" value={latestSignal} />
              <QuoteMetric label="Your action" value={actionText} />
            </div>
            {selectedCandidate && !row && (
              <div className="mx-5 mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={selectedCandidate.recommendation === "AI candidate" ? "green" : selectedCandidate.recommendation === "Watchlist" ? "amber" : "slate"}>
                    Nifty 500 #{selectedCandidate.rank} · {selectedCandidate.recommendation}
                  </Badge>
                  <span>Score {(selectedCandidate.score ?? 0).toFixed(2)}</span>
                  <span>Confidence {formatPercent(selectedCandidate.confidence, 0)}</span>
                </div>
                <p className="mt-2">{selectedCandidate.reason}</p>
              </div>
            )}
          </section>

      {hasVerifiedPriceHistory ? (
        <Card title="Price Chart" subtitle="Real monthly prices with model action markers when available">
          <ModelSignalChart symbol={normalized} prices={prices} signals={signals} />
        </Card>
      ) : (
        <Card title="Price Chart" subtitle="Price history">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Price history is not available for {normalized || "this stock"} in the local exchange file.
          </div>
        </Card>
      )}

          {holdingsLoading && <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">Loading saved holdings to calculate your portfolio relevance…</p>}
          {!holdingsLoading && holdingsError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Saved holdings are unavailable. Personal trade sizing is hidden until the account data loads.</p>}

          {discoveryRow && !row && (
        <Card title="Model Coverage" subtitle="Why this stock has no personal action">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={hasVerifiedPriceHistory ? "green" : "slate"}>
                  {hasVerifiedPriceHistory ? "Price history loaded" : "Limited price history"}
                </Badge>
                <Badge color={discoveryRow.hasFactorBasketHistory ? "green" : "slate"}>
                  {discoveryRow.hasFactorBasketHistory ? "Has model history" : "No model history yet"}
                </Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {discoveryRow.companyName} is in the Nifty 500 list under {discoveryRow.industry}.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {hasVerifiedPriceHistory
                  ? "The app can show its price chart now. A personal buy/sell action appears only when the monthly model selects the stock and your cash or holdings are saved."
                  : "The current local exchange file does not include enough price history for this symbol."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Price history" value={hasVerifiedPriceHistory ? "Available" : "Not loaded"} />
              <Metric label="Months available" value={`${prices.length || discoveryRow.priceMonthCount}`} />
              <Metric label="Last price month" value={latestPricePoint?.month || discoveryRow.lastPriceMonth || "Not available"} />
              <Metric label="Latest close" value={latestPrice > 0 ? formatCurrency(latestPrice) : "Not available"} />
            </div>
          </div>
        </Card>
      )}

          {row && !holdingsLoading && !holdingsError ? (
        <Card title="Personal Action" subtitle="Position sizing from saved cash and holdings">
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current instruction</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{actionText}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {row.action === "PAUSED" || row.action === "IGNORED" ? (
                  <Badge color={row.action === "PAUSED" ? "amber" : "slate"}>{row.action}</Badge>
                ) : (
                  <SignalBadge signal={row.action} />
                )}
                <Badge color={actionTone}>{row.sector}</Badge>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="You hold" value={`${row.currentQuantity} shares`} />
              <Metric label="Plan wants" value={`${row.targetQuantity} shares`} />
              <Metric label="Target weight" value={formatPercent(row.targetWeight, 2)} />
              <Metric label="Trade value" value={hasPortfolioContext && latestPrice > 0 ? formatCurrency(row.tradeValue) : "Needs plan input"} />
            </div>
          </div>
          {!hasPortfolioContext && (
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
              No saved portfolio yet. Enter cash in My Plan or add holdings, then this card will calculate your exact quantity and trade value.
            </div>
          )}
          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why this action</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{actionExplanation}</p>
            <p className="mt-2 text-xs text-slate-500">Factor source: {row.factorReason}</p>
            <p className="mt-1 text-xs text-slate-500">
              <TermTooltip term="target weight">Target weight</TermTooltip>: {formatPercent(row.targetWeight, 2)}
            </p>
          </div>
        </Card>
      ) : (
        !discoveryRow && <Card title="Stock data not loaded">
          <p className="text-sm leading-6 text-slate-600">{symbols.includes(normalized) ? "No current recommendation row or signal history is available for this stock in the loaded data." : "This stock is not present in the loaded dataset. Search the list above by symbol, company, or sector."}</p>
        </Card>
      )}

      <Card title="Model Signal History" subtitle="Past monthly model changes for the selected stock">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Readout label="Latest signal" value={latestSignal} detail="The most recent monthly model action for this symbol." />
          <Readout label="Weights" value="Previous -> current" detail="These are strategy target weights, not the number of shares you own." />
          <Readout label="How to use it" value="Context first" detail="Your exact trade comes from Personal Action after cash and holdings are saved." />
        </div>
        <Table
          maxHeight="420px"
          columns={[
            { key: "month", label: "Month" },
            { key: "signal", label: "Signal", align: "center" },
            { key: "price", label: "Price", align: "right" },
            { key: "old", label: "Prev wt", align: "right" },
            { key: "new", label: "New wt", align: "right" },
            { key: "factor", label: "Factor" },
          ]}
          data={signals.map((signal) => ({
            month: signal.month,
            signal: <SignalBadge signal={signal.signal_type} />,
            price: formatCurrency(signal.signal_price),
            old: formatPercent(signal.old_weight, 2),
            new: formatPercent(signal.new_weight, 2),
            factor: signal.primary_factor,
          }))}
          emptyMessage="No monthly model action has been recorded for this symbol. Use the price chart for research; action appears when the model selects it."
        />
      </Card>
    </div>
  );
}

function ModelSignalChart({
  symbol,
  prices,
  signals,
  height = 360,
}: {
  symbol: string;
  prices: StockPricePoint[];
  signals: StockSignalEvent[];
  height?: number;
}) {
  const width = 1000;
  const pad = { top: 34, right: 74, bottom: 48, left: 64 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const priceRows = prices
    .map((price) => ({
      month: price.month.slice(0, 7),
      close: Number(price.adjusted_close || price.close || 0),
    }))
    .filter((price) => Number.isFinite(price.close) && price.close > 0);

  if (!priceRows.length) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm leading-6 text-slate-500">
        Price history is not available for {symbol || "this stock"} in the local exchange file.
      </div>
    );
  }

  const monthIndex = new Map(priceRows.map((price, index) => [price.month, index]));
  const signalRows = signals
    .filter((signal) => monthIndex.has(signal.month.slice(0, 7)))
    .map((signal) => ({ ...signal, monthKey: signal.month.slice(0, 7) }));
  const allValues = [
    ...priceRows.map((price) => price.close),
    ...signalRows.map((signal) => Number(signal.signal_price || 0)).filter((value) => value > 0),
  ];
  const minY = Math.min(...allValues);
  const maxY = Math.max(...allValues);
  const yRange = maxY - minY || 1;
  const yPad = yRange * 0.16;
  const yMin = Math.max(0, minY - yPad);
  const yMax = maxY + yPad;
  const xStep = chartW / Math.max(1, priceRows.length - 1);
  const xForIndex = (index: number) => pad.left + index * xStep;
  const yForValue = (value: number) => pad.top + chartH - ((value - yMin) / (yMax - yMin)) * chartH;
  const points = priceRows.map((price, index) => `${xForIndex(index)},${yForValue(price.close)}`).join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) * index) / 4);
  const xTickSkip = Math.max(1, Math.ceil(priceRows.length / 8));
  const firstMonth = priceRows[0]?.month ?? "";
  const lastMonth = priceRows[priceRows.length - 1]?.month ?? "";

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[760px]" preserveAspectRatio="xMidYMid meet">
        <rect x={0} y={0} width={width} height={height} rx={10} fill="#ffffff" />
        <text x={pad.left} y={21} className="fill-slate-900 text-[15px] font-bold">{symbol} price and model signals</text>
        <text x={width - pad.right} y={21} textAnchor="end" className="fill-slate-500 text-[12px]">{firstMonth} to {lastMonth}</text>
        <g transform={`translate(${pad.left + 230} 11)`}>
          <circle cx={0} cy={0} r={4} fill="#16a34a" />
          <text x={10} y={4} className="fill-slate-500 text-[11px]">Buy/Add</text>
          <circle cx={76} cy={0} r={4} fill="#dc2626" />
          <text x={86} y={4} className="fill-slate-500 text-[11px]">Reduce/Sell</text>
        </g>

        {yTicks.map((value, index) => {
          const y = yForValue(value);
          return (
            <g key={index}>
              <line x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="3,4" />
              <text x={pad.left - 10} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{value.toFixed(0)}</text>
              <text x={pad.left + chartW + 10} y={y + 4} className="fill-slate-400 text-[10px]">{value.toFixed(0)}</text>
            </g>
          );
        })}

        {priceRows.map((price, index) => {
          if (index % xTickSkip !== 0 && index !== priceRows.length - 1) return null;
          const x = xForIndex(index);
          return <text key={price.month} x={x} y={pad.top + chartH + 28} textAnchor="middle" className="fill-slate-400 text-[10px]">{price.month}</text>;
        })}

        <polyline points={points} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {signalRows.map((signal, index) => {
          const priceIndex = monthIndex.get(signal.monthKey) ?? 0;
          const x = xForIndex(priceIndex);
          const signalPrice = Number(signal.signal_price || priceRows[priceIndex]?.close || 0);
          const y = yForValue(signalPrice);
          const color = getSignalColor(signal.signal_type);
          const isSellish = signal.signal_type === "SELL" || signal.signal_type === "REDUCE";
          const size = index === 0 ? 9 : 7;
          const markerPoints = isSellish
            ? `${x},${y + size} ${x - size},${y - size} ${x + size},${y - size}`
            : `${x},${y - size} ${x - size},${y + size} ${x + size},${y + size}`;

          return (
            <g key={`${signal.month}-${signal.signal_type}-${index}`}>
              <line x1={x} y1={pad.top} x2={x} y2={pad.top + chartH} stroke={color} strokeWidth={1} opacity={index === 0 ? 0.18 : 0.08} />
              <polygon points={markerPoints} fill={color} stroke="#fff" strokeWidth={1.8} opacity={index === 0 ? 1 : 0.86} />
              {index === 0 && <circle cx={x} cy={y} r={14} fill="none" stroke={color} strokeWidth={1.6} opacity={0.45} />}
              <title>{`${signal.signal_type} ${signal.symbol} at ${formatCurrency(signalPrice)} on ${signal.month}: ${signal.reason}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function getSignalColor(signal: string) {
  if (signal === "BUY" || signal === "ADD") return "#16a34a";
  if (signal === "SELL" || signal === "REDUCE") return "#dc2626";
  return "#64748b";
}

function QuoteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Readout({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}
