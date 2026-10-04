import { useEffect, useMemo, useState } from "react";
import { Card, SignalBadge, Table } from "@/components/UI";
import { formatPercent, getPortfolioTargets, getStocks } from "@/lib/data";
import { buildTradePlan, formatCurrency, getLatestPrice } from "@/lib/product";
import { useUserData } from "@/lib/userData";
import { useAuth } from "@/lib/auth";
import { readUserExperience, getUserJourney } from "@/lib/userExperience";
import type { PageId } from "@/components/Layout";

export function FinalPortfolioPage({ onNavigate }: { onNavigate?: (page: PageId) => void }) {
  const { user } = useAuth();
  const userData = useUserData();
  const journey = getUserJourney(user ? readUserExperience(user.id) : null);
  const [holdings, setHoldings] = useState<{symbol:string;quantity:number;avgPrice?:number}[]>([]);
  const [cash, setCash] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    Promise.all([userData.getHoldings(), userData.getCash()]).then(([savedHoldings, savedCash]) => {
      if (!cancelled) { setHoldings(savedHoldings); setCash(savedCash); setLoading(false); }
    }).catch((err: unknown) => {
      if (!cancelled) { setError(err instanceof Error ? err.message : "Could not load portfolio."); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userData]);
  const preview = buildTradePlan(holdings, cash);
  const targets = getPortfolioTargets();
  const stocks = getStocks();

  const investedValue = preview.portfolioValue - cash;
  const totalCostBasis = Array.from(holdings).reduce((sum, h) => sum + h.quantity * (h.avgPrice || 0), 0);
  const totalPnl = investedValue - totalCostBasis;
  const totalPnlPct = totalCostBasis > 0 ? totalPnl / totalCostBasis : 0;
  const missingPrices = holdings.filter((holding) => getLatestPrice(holding.symbol) <= 0);
  const portfolioValueAvailable = missingPrices.length === 0;

  const holdingsRows = useMemo(() => {
    const targetMap = new Map(targets.map((t) => [t.symbol, t]));
    return holdings
      .map((h) => {
        const latestPrice = getLatestPrice(h.symbol);
        const avgPrice = h.avgPrice || 0;
        const currentValue = latestPrice > 0 ? h.quantity * latestPrice : null;
        const investedValue = h.quantity * avgPrice;
        const pnl = investedValue > 0 && currentValue !== null ? currentValue - investedValue : null;
        const pnlPct = investedValue > 0 && pnl !== null ? pnl / investedValue : null;
        const target = targetMap.get(h.symbol);
        const targetWeight = target?.target_weight || 0;
        const currentWeight = preview.portfolioValue > 0 && currentValue !== null ? currentValue / preview.portfolioValue : null;
        const stock = stocks.find((s) => s.symbol === h.symbol);
        const sector = stock?.sector || "Unknown";

        let action = "HOLD";
        if (currentWeight === null) action = "—";
        else if (target && targetWeight > currentWeight + 0.005) action = "BUY";
        else if (target && targetWeight < currentWeight - 0.005) action = "REDUCE";
        else if (!target && currentWeight > 0) action = "SELL";

        return {
          symbol: h.symbol,
          quantity: h.quantity,
          avgPrice,
          latestPrice,
          currentValue,
          investedValue,
          pnl,
          pnlPct,
          currentWeight,
          targetWeight,
          action,
          sector,
        };
      })
      .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));
  }, [holdings, targets, preview.portfolioValue, stocks]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Portfolio</h2>
        <p className="mt-1 text-sm text-slate-500">Your holdings, values, and model comparison.</p>
      </div>
      {loading && <p role="status" className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading your portfolio…</p>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {!loading && !error && missingPrices.length > 0 && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Current value and return are unavailable for {missingPrices.length} holding{missingPrices.length === 1 ? "" : "s"} because no usable price is present. A partial total is not shown.</div>}

      {/* ── PORTFOLIO SUMMARY ────────────────────────────────────────────── */}
      {!loading && !error && holdings.length === 0 && cash === 0 && <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-600"><p className="font-semibold text-slate-900">Your portfolio is empty</p><p className="mt-1">{journey === "new-investor" ? "When you are ready to invest, My Plan can turn an amount into a model-based plan." : "Add or import your current holdings in My Plan to compare them with the model."}</p>{onNavigate && <button type="button" onClick={() => onNavigate("trade-plan")} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Go to My Plan</button>}</div>}
      {!loading && !error && (holdings.length > 0 || cash > 0) && <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Invested</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{portfolioValueAvailable ? formatCurrency(investedValue) : "Unavailable"}</p>
          <p className="mt-1 text-xs text-slate-500">{holdings.length} stocks</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Current Value</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{portfolioValueAvailable ? formatCurrency(preview.portfolioValue) : "Unavailable"}</p>
          <p className="mt-1 text-xs text-slate-500">Holdings + Cash</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">P&L</p>
          <p className={`mt-1 text-2xl font-bold ${totalPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {portfolioValueAvailable ? `${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)}` : "Unavailable"}
          </p>
          <p className={`mt-1 text-xs ${totalPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {portfolioValueAvailable ? `${formatPercent(totalPnlPct, 2)} overall` : "Current prices incomplete"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Available Cash</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(cash)}</p>
          <p className="mt-1 text-xs text-slate-500">Free to invest</p>
        </div>
      </div>

      {/* ── HOLDINGS TABLE ───────────────────────────────────────────────── */}
      <Card title="Holdings" subtitle="Your current positions with model comparison">
        {loading ? <p role="status" className="py-6 text-center text-sm text-slate-500">Loading saved holdings…</p> : error ? <p className="py-6 text-center text-sm text-slate-600">Holdings are unavailable until the account query succeeds.</p> : holdingsRows.length > 0 ? (
          <Table
            maxHeight="600px"
            columns={[
              { key: "symbol", label: "Stock" },
              { key: "quantity", label: "Qty", align: "right" },
              { key: "avgPrice", label: "Avg Price", align: "right" },
              { key: "latestPrice", label: "LTP", align: "right" },
              { key: "currentValue", label: "Value", align: "right" },
              { key: "pnl", label: "P&L", align: "right" },
              { key: "action", label: "Action", align: "center" },
            ]}
            data={holdingsRows.map((row) => ({
              symbol: (
                <div>
                  <span className="font-semibold text-slate-900">{row.symbol}</span>
                  <p className="text-xs text-slate-400">{row.sector}</p>
                </div>
              ),
              quantity: row.quantity,
              avgPrice: row.avgPrice > 0 ? formatCurrency(row.avgPrice) : "—",
              latestPrice: row.latestPrice > 0 ? formatCurrency(row.latestPrice) : "Unavailable",
              currentValue: row.currentValue === null ? "Unavailable" : formatCurrency(row.currentValue),
              pnl: (
                <span className={row.pnl === null ? "text-slate-500" : row.pnl >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {row.pnl === null ? "Unavailable" : `${row.pnl >= 0 ? "+" : ""}${formatCurrency(row.pnl)}`}
                </span>
              ),
              action: <SignalBadge signal={row.action} />,
            }))}
          />
        ) : (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
            <p className="font-semibold">No holdings yet</p>
            <p className="mt-1">Go to the My Plan page to add your holdings and generate a personalized trade plan.</p>
          </div>
        )}
      </Card>

      {/* ── MODEL VS YOUR PORTFOLIO ──────────────────────────────────────── */}
      {holdingsRows.length > 0 && portfolioValueAvailable && (
        <Card title="Model vs Your Portfolio" subtitle="How your holdings compare to the model target">
          <div className="space-y-3">
            {holdingsRows.slice(0, 10).map((row) => {
              const diff = row.currentWeight === null ? null : row.targetWeight - row.currentWeight;
              return (
                <div key={row.symbol} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.symbol}</p>
                    <p className="text-xs text-slate-500">
                      Current: {row.currentWeight === null ? "Unavailable" : formatPercent(row.currentWeight, 1)} → Target: {formatPercent(row.targetWeight, 1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${diff === null ? "text-slate-500" : diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-slate-600"}`}>
                      {diff === null ? "Unavailable" : `${diff > 0 ? "+" : ""}${formatPercent(diff, 1)}`}
                    </p>
                    <SignalBadge signal={row.action} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      </>}
    </div>
  );
}
