import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Layers, Search, TrendingUp } from "lucide-react";
import { Badge, Card, SignalBadge, Table } from "@/components/UI";
import { TermTooltip } from "@/components/TermTooltip";
import { formatPercent, getNifty500DataAudit, getSignalEvents, getStockPrices, getStockSymbols, getStocks } from "@/lib/data";
import { buildTradePlan, formatCurrency } from "@/lib/product";
import { useUserData } from "@/lib/userData";

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
  const nifty500Rows = useMemo(() => nifty500Audit?.rows || [], [nifty500Audit]);
  const [symbol, setSymbol] = useState(symbols.includes("PFC") ? "PFC" : symbols[0] || "");
  const [search, setSearch] = useState(symbol);
  const normalized = symbol.trim().toUpperCase();
  const stockSearchRows = useMemo(() => {
    const bySymbol = new Map<string, { symbol: string; name: string; sector: string; source: "model" | "nifty500" }>();
    stockNames
      .filter((stock) => symbols.includes(stock.symbol))
      .forEach((stock) => bySymbol.set(stock.symbol, { ...stock, source: "model" }));
    nifty500Rows.forEach((row) => {
      if (!bySymbol.has(row.symbol)) {
        bySymbol.set(row.symbol, {
          symbol: row.symbol,
          name: row.companyName,
          sector: row.industry,
          source: "nifty500",
        });
      }
    });
    return Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [nifty500Rows, stockNames, symbols]);
  const matches = stockSearchRows
    .filter((stock) => `${stock.symbol} ${stock.name}`.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 8);
  const discoveryRow = nifty500Rows.find((item) => item.symbol === normalized);
  const preview = buildTradePlan(holdings, cash);
  const row = preview.rows.find((item) => item.symbol === normalized);
  const selectedSearchStock = stockSearchRows.find((item) => item.symbol === normalized);
  const signals = useMemo(() => getSignalEvents(normalized).slice(-20).reverse(), [normalized]);
  const prices = getStockPrices(normalized);
  const latestPricePoint = prices[prices.length - 1];
  const latestPrice = latestPricePoint?.adjusted_close || latestPricePoint?.close || row?.latestPrice || discoveryRow?.latestClose || 0;
  const priceSource = latestPricePoint
    ? `monthly stock price · ${latestPricePoint.month}`
    : discoveryRow?.latestClose
      ? `Nifty 500 audit price · ${discoveryRow.lastPriceMonth}`
    : "";
  const hasPortfolioContext = holdings.length > 0 || cash > 0;
  const currentModelWeight = row?.targetWeight || signals[0]?.new_weight || 0;
  const latestSignal = signals[0]?.signal_type || (currentModelWeight > 0 ? "IN MODEL" : "WATCH");
  const actionText = row
    ? row.finalTradeQuantity > 0
      ? `Buy ${row.finalTradeQuantity}`
      : row.finalTradeQuantity < 0
        ? `Sell ${Math.abs(row.finalTradeQuantity)}`
        : hasPortfolioContext
          ? "No trade now"
          : "Add cash or holdings first"
    : "No active plan row";
  const actionExplanation = row
    ? !hasPortfolioContext
      ? "You have no saved holdings or plan cash yet, so this page can show the model view but cannot calculate your personal quantity."
      : row.reason
    : "This stock is not in the current model target set. Use the signal history only as research context.";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stocks</h2>
          <p className="mt-1 text-sm text-slate-500">Search, inspect, and understand whether a stock belongs in the current model or only in discovery.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge color="blue">Nifty 200 model</Badge>
          <Badge color="amber">Nifty 500 discovery</Badge>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card title="Find Stock" subtitle="Search like a watchlist">
            <label className="block text-xs font-medium text-slate-600">
              Symbol or company
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  role="combobox"
                  aria-expanded={search.trim().length > 0 && matches.length > 0}
                  aria-controls="stock-search-options"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) { event.preventDefault(); setSymbol(matches[0].symbol); setSearch(matches[0].symbol); } }}
                  className="w-full rounded-lg border border-slate-300 py-3 pl-9 pr-3 text-sm font-semibold uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="PFC, TCS, ACC..."
                />
              </div>
            </label>
            <div id="stock-search-options" role="listbox" className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">
              {(search.trim().length > 0 ? matches : stockSearchRows.slice(0, 12)).map((stock) => (
                <button
                  key={stock.symbol}
                  type="button"
                  role="option"
                  aria-selected={normalized === stock.symbol}
                  onClick={() => { setSymbol(stock.symbol); setSearch(stock.symbol); }}
                  className={`w-full rounded-lg border p-3 text-left transition ${
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
                    <Badge color={stock.source === "model" ? "blue" : "amber"} size="xs">
                      {stock.source === "model" ? "Model" : "N500"}
                    </Badge>
                  </div>
                  <p className="mt-2 truncate text-xs text-slate-500">{stock.sector || "Sector unavailable"}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card title="What This Page Answers" subtitle="Use before opening a broker app">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <InfoLine icon={<Search className="h-4 w-4" />} text="Is this stock known to the system?" />
              <InfoLine icon={<Layers className="h-4 w-4" />} text="Is it in the live model universe or only discovery?" />
              <InfoLine icon={<TrendingUp className="h-4 w-4" />} text="Do I have a personal action or just research context?" />
            </div>
          </Card>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl font-bold text-slate-950">{normalized || "Select a stock"}</h3>
                    {row && <Badge color="blue">Live model</Badge>}
                    {!row && discoveryRow && <Badge color="amber">Nifty 500 discovery</Badge>}
                    {!row && !discoveryRow && <Badge color="slate">Not loaded</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedSearchStock?.name || discoveryRow?.companyName || "Company name unavailable"}
                    {(selectedSearchStock?.sector || discoveryRow?.industry || row?.sector) && (
                      <span> · {selectedSearchStock?.sector || discoveryRow?.industry || row?.sector}</span>
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference price</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{latestPrice > 0 ? formatCurrency(latestPrice) : "Unavailable"}</p>
                  {priceSource && <p className="mt-1 text-xs text-slate-500">{priceSource}</p>}
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-4">
              <QuoteMetric label="Universe" value={row ? "Model" : discoveryRow ? "Discovery" : "Unknown"} />
              <QuoteMetric label="Model weight" value={formatPercent(currentModelWeight, 2)} />
              <QuoteMetric label="Latest signal" value={latestSignal} />
              <QuoteMetric label="Portfolio action" value={actionText} />
            </div>
          </section>

          {holdingsLoading && <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">Loading saved holdings to calculate your portfolio relevance…</p>}
          {!holdingsLoading && holdingsError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Saved holdings are unavailable. Personal trade sizing is hidden until the account data loads.</p>}

          {discoveryRow && !row && (
        <Card title="Discovery Status" subtitle="Nifty 500 coverage check; not a recommendation">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="amber">Nifty 500 discovery</Badge>
                <Badge color={discoveryRow.hasMonthlyPrice ? "green" : "red"}>
                  {discoveryRow.hasMonthlyPrice ? "Price data found" : "Price data missing"}
                </Badge>
                <Badge color={discoveryRow.hasFactorBasketHistory ? "green" : "slate"}>
                  {discoveryRow.hasFactorBasketHistory ? "Factor history found" : "No factor history"}
                </Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {discoveryRow.companyName} is in the current Nifty 500 file under {discoveryRow.industry}. It is available for discovery/watchlist context, but it is not in the current recommendation universe.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The model stays on Nifty 200 until Nifty 500 historical membership, prices, fundamentals, and backtests are complete.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Price coverage" value={discoveryRow.priceCoverageBand} />
              <Metric label="Price months" value={`${discoveryRow.priceMonthCount}`} />
              <Metric label="Last price month" value={discoveryRow.lastPriceMonth || "Missing"} />
              <Metric label="Latest close" value={discoveryRow.latestClose ? formatCurrency(discoveryRow.latestClose) : "Missing"} />
            </div>
          </div>
        </Card>
      )}

          {row && !holdingsLoading && !holdingsError ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card title="Personal Action" subtitle="Personalized using saved holdings and cash">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {row.action === "PAUSED" || row.action === "IGNORED" ? (
                  <Badge color={row.action === "PAUSED" ? "amber" : "slate"}>{row.action}</Badge>
                ) : (
                  <SignalBadge signal={row.action} />
                )}
                <Badge color="slate">{row.sector}</Badge>
              </div>
              {!hasPortfolioContext && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                  No saved portfolio yet. Enter cash in My Plan or add holdings, then this card will calculate your exact quantity and trade value.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Metric label="You have" value={`${row.currentQuantity} shares`} />
                <Metric label="Model weight" value={formatPercent(currentModelWeight, 2)} />
                <Metric label="Personal action" value={actionText} />
                <Metric label="Trade value" value={hasPortfolioContext && latestPrice > 0 ? formatCurrency(row.tradeValue) : "Needs plan input"} />
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{actionExplanation}</p>
                <p className="mt-2 text-xs text-slate-500">Factor source: {row.factorReason}</p>
                <p className="mt-1 text-xs text-slate-500">
                  <TermTooltip term="target weight">Target weight</TermTooltip>: {formatPercent(row.targetWeight, 2)}
                </p>
              </div>
            </div>
          </Card>

          <Card title="Signal History" subtitle="Latest monthly model actions">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <Readout label="Latest model signal" value={latestSignal} detail="What changed in the model target list." />
              <Readout label="Old wt -> new wt" value="Previous -> current target" detail="These are model portfolio weights, not your holding size." />
              <Readout label="How to use it" value="Context, not a trade ticket" detail="Your personal action comes from My Plan after cash/holdings are saved." />
            </div>
            <Table
              maxHeight="420px"
              columns={[
                { key: "month", label: "Month" },
                { key: "signal", label: "Signal", align: "center" },
                { key: "price", label: "Price", align: "right" },
                { key: "old", label: "Previous model wt", align: "right" },
                { key: "new", label: "New model wt", align: "right" },
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
            />
          </Card>
        </div>
      ) : (
        !discoveryRow && <Card title="Stock data unavailable">
          <p className="text-sm leading-6 text-slate-600">{symbols.includes(normalized) ? "No current model-plan row or analysis history is available for this stock in the loaded data." : "This stock is not present in the loaded stock data. Search the available symbols or check the spelling."}</p>
        </Card>
      )}
        </main>
      </div>
    </div>
  );
}

function InfoLine({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
      <span className="mt-0.5 text-slate-500">{icon}</span>
      <span>{text}</span>
    </div>
  );
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
