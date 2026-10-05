import { useEffect, useMemo, useState } from "react";
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
  const signals = useMemo(() => getSignalEvents(normalized).slice(-20).reverse(), [normalized]);
  const prices = getStockPrices(normalized);
  const latestPricePoint = prices[prices.length - 1];
  const latestPrice = latestPricePoint?.adjusted_close || latestPricePoint?.close || row?.latestPrice || 0;
  const priceSource = latestPricePoint
    ? `monthly stock price · ${latestPricePoint.month}`
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Stocks</h2>
        <p className="mt-1 text-sm text-slate-500">What does the model currently say about this stock?</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-medium text-slate-600">
            Search by symbol or company name
            <input
              role="combobox"
              aria-expanded={search.trim().length > 0 && matches.length > 0}
              aria-controls="stock-search-options"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) { event.preventDefault(); setSymbol(matches[0].symbol); setSearch(matches[0].symbol); } }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="PFC"
            />
            {search.trim().length > 0 && matches.length > 0 && <div id="stock-search-options" role="listbox" className="mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white shadow-sm">{matches.map((stock) => <button key={stock.symbol} type="button" role="option" aria-selected={normalized === stock.symbol} onClick={() => { setSymbol(stock.symbol); setSearch(stock.symbol); }} className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="font-medium text-slate-900">{stock.symbol}</span><span className="min-w-0 flex-1 truncate text-slate-500">{stock.name}</span>{stock.source === "nifty500" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">N500</span>}</button>)}</div>}
          </label>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Price: <span className="font-semibold text-slate-900">{latestPrice > 0 ? formatCurrency(latestPrice) : "Unavailable"}</span>
            {priceSource && <span className="ml-2 text-xs text-slate-500">{priceSource}</span>}
          </div>
        </div>
      </Card>

      {holdingsLoading && <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">Loading saved holdings to calculate your portfolio relevance…</p>}
      {!holdingsLoading && holdingsError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Saved holdings are unavailable. Personal trade sizing is hidden until the account data loads.</p>}

      {discoveryRow && !row && (
        <Card title={`${normalized} Discovery`} subtitle="Nifty 500 coverage check; not a recommendation">
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
          <Card title={`${normalized} Action`} subtitle="Personalized using saved holdings">
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
