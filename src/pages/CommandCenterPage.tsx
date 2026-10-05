import { useEffect, useState } from "react";
import type { UserProfile } from "@/lib/auth";
import { getUserJourney, readUserExperience } from "@/lib/userExperience";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, ShieldAlert, WalletCards } from "lucide-react";
import { Badge, ProgressBar, StatCard } from "@/components/UI";
import { TermTooltip } from "@/components/TermTooltip";
import { formatPercent, getOverviewData, getMarketIndex, getMacroData } from "@/lib/data";
import { formatCurrency, getDecisionSnapshot, buildTradePlan, getLatestPrice } from "@/lib/product";
import { useUserData } from "@/lib/userData";

function getMarketStanceLabel(regime: string | undefined): { label: string; color: string; icon: React.ReactNode } {
  if (!regime || regime === "Unscored") return { label: "UNKNOWN", color: "slate", icon: <Minus className="h-4 w-4" /> };
  if (regime === "Bull / Expansion") return { label: "FAVOURABLE", color: "green", icon: <TrendingUp className="h-4 w-4" /> };
  if (regime === "Bear / Stress") return { label: "UNFAVOURABLE", color: "red", icon: <TrendingDown className="h-4 w-4" /> };
  if (regime === "High Volatility / Risk-Off") return { label: "CAUTIOUS", color: "amber", icon: <AlertTriangle className="h-4 w-4" /> };
  if (regime === "Recovery") return { label: "IMPROVING", color: "blue", icon: <TrendingUp className="h-4 w-4" /> };
  return { label: "NEUTRAL", color: "slate", icon: <Minus className="h-4 w-4" /> };
}

function getActionLabel(decision: string | undefined, riskStatus: string): { label: string; color: string; description: string } {
  if (decision === "REBALANCE" && riskStatus === "Normal") return { label: "REVIEW PLAN", color: "green", description: "The model has approved a monthly rebalance and daily risk conditions are normal. Review the suggested changes in My Plan." };
  if (decision === "REBALANCE" && riskStatus === "Caution") return { label: "STAGGER NEW BUYS", color: "amber", description: "The model has approved a rebalance but daily risk is elevated. New buys should be staggered." };
  if (decision === "REBALANCE" && (riskStatus === "Danger" || riskStatus === "Extreme")) return { label: "WAIT", color: "red", description: "The model has approved a rebalance but daily risk is high. New buys are paused; only risk-reducing trades are allowed." };
  if (decision === "DEFENSIVE") return { label: "REDUCE RISK", color: "amber", description: "The model recommends a defensive posture. Reduce unwanted positions first." };
  if (decision === "RETAIN") return { label: "HOLD", color: "slate", description: "The model recommends retaining the current allocation. No automatic rebalance is needed." };
  return { label: "HOLD", color: "slate", description: "No action required at this time." };
}

export function CommandCenterPage({
  onNavigate,
  user,
}: {
  onNavigate: (page: "my-plan" | "trust") => void;
  user: UserProfile;
}) {
  const userData = useUserData();
  const [holdings, setHoldings] = useState<{symbol:string;quantity:number;avgPrice?:number}[]>([]);
  const [cash, setCash] = useState(0);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([userData.getHoldings(), userData.getCash()]).then(([h, c]) => {
      if (!cancelled) { setHoldings(h); setCash(c); setPortfolioLoading(false); }
    }).catch(() => { if (!cancelled) { setPortfolioError(true); setPortfolioLoading(false); } });
    return () => { cancelled = true; };
  }, [userData]);
  const overview = getOverviewData();
  const { decision, allocation, risk, latestMonth, latestEod } = getDecisionSnapshot();
  const preview = buildTradePlan(holdings, cash);
  const portfolioPricesComplete = holdings.every((holding) => getLatestPrice(holding.symbol) > 0);
  const isRetainDecision = (decision?.decision || "RETAIN") === "RETAIN";
  const experience = readUserExperience(user.id);
  const journey = getUserJourney(experience);
  const firstName = user.name?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const homeSubtitle = journey === "new-investor"
    ? "Start with an amount that feels comfortable, then review the model’s latest monthly plan."
    : journey === "existing-investor-fresh-money"
    ? "Review your saved holdings alongside the additional amount you may want to invest."
    : "See how your saved holdings compare with the model’s latest monthly targets.";

  const regime = overview?.regime_label;
  const marketStance = getMarketStanceLabel(regime);
  const action = getActionLabel(decision?.decision, risk.status);

  const marketIndex = getMarketIndex();
  const latestMarket = marketIndex[marketIndex.length - 1];
  const macroData = getMacroData();
  const latestMacro = macroData[macroData.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{greeting}{firstName ? `, ${firstName}` : ""}</h2>
          <p className="text-sm text-slate-500 mt-1">{homeSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge color={overview ? "blue" : "amber"}>{overview ? `Model month ${latestMonth}` : "Model view unavailable"}</Badge>
          <Badge color={latestEod !== "—" ? "green" : "slate"}>{latestEod !== "—" ? `Latest EOD ${latestEod}` : "EOD date unavailable"}</Badge>
        </div>
      </div>

      {/* ── LATEST MODEL DECISION ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Latest Model Decision</h3>
        {!overview && <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Current market and model summary is unavailable in the loaded data. No recommendation is being shown.</div>}
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {overview && <div className="flex flex-wrap items-center gap-2">
              <Badge color={marketStance.color === "green" ? "green" : marketStance.color === "red" ? "red" : marketStance.color === "amber" ? "amber" : marketStance.color === "blue" ? "blue" : "slate"}>
                <span className="flex items-center gap-1">{marketStance.icon} Market: {marketStance.label}</span>
              </Badge>
              <Badge color={risk.status === "Normal" ? "green" : risk.status === "Caution" ? "amber" : "red"}>
                <TermTooltip term="risk overlay">Risk: {risk.status}</TermTooltip>
              </Badge>
            </div>}
            {overview && <div className={`mt-4 rounded-lg p-5 ${action.color === "green" ? "bg-emerald-50" : action.color === "amber" ? "bg-amber-50" : action.color === "red" ? "bg-red-50" : "bg-slate-50"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly model view</p>
              <p className={`mt-1 text-2xl font-bold ${action.color === "green" ? "text-emerald-900" : action.color === "amber" ? "text-amber-900" : action.color === "red" ? "text-red-900" : "text-slate-900"}`}>
                {action.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{action.description}</p>
            </div>}
          </div>

          {overview && <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why?</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isRetainDecision
                ? "The model is retaining the current allocation. Market conditions have not changed enough to warrant a rebalance."
                : `The model has approved a rebalance. The top factor is ${Object.entries({ Momentum: allocation?.momentum_weight || 0, Value: allocation?.value_weight || 0, Quality: allocation?.quality_weight || 0, "Low Volatility": allocation?.low_volatility_weight || 0 }).sort((a, b) => b[1] - a[1])[0]?.[0] || "Quality"} at ${formatPercent(Math.max(allocation?.momentum_weight || 0, allocation?.value_weight || 0, allocation?.quality_weight || 0, allocation?.low_volatility_weight || 0), 0)}.`}
            </p>
            {decision?.reason && (
              <p className="mt-2 text-xs text-slate-500">Model detail: {decision.reason}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate("my-plan")}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                View My Plan
              </button>
            </div>
          </div>}
        </div>
      </section>

      {/* ── YOUR PORTFOLIO ────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Your Portfolio</h3>
        {portfolioLoading ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading your saved portfolio…</p> : portfolioError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Your saved portfolio is unavailable. Try again later; values are hidden until the data loads.</p> : holdings.length === 0 && cash === 0 ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p className="font-medium text-slate-800">{journey === "new-investor" ? "Your portfolio is empty" : "Add your existing holdings"}</p><p className="mt-1">{journey === "new-investor" ? "Enter an amount in My Plan to see a simple model-based starting plan." : journey === "existing-investor-fresh-money" ? "Add your current holdings and fresh investment amount in My Plan to compare both with model targets." : "Add or import your current holdings in My Plan to compare them with model targets."}</p><button onClick={() => onNavigate("my-plan")} className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">{journey === "new-investor" ? "Start My Plan" : "Review holdings in My Plan"}</button></div> : <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Portfolio Value"
            value={portfolioPricesComplete ? formatCurrency(preview.portfolioValue) : "Unavailable"}
            subvalue={portfolioPricesComplete ? "Holdings + cash" : "Price missing for one or more holdings"}
            icon={<WalletCards className="h-5 w-5" />}
            color="slate"
          />
          <StatCard
            label="Invested"
            value={portfolioPricesComplete ? formatCurrency(preview.portfolioValue - (cash || 0)) : "Unavailable"}
            subvalue={`${preview.stockCountAfter} stocks`}
            icon={<TrendingUp className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            label="Available Cash"
            value={formatCurrency(cash || 0)}
            subvalue="Free to invest"
            icon={<WalletCards className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            label="Risk Status"
            value={risk.status}
            subvalue={risk.executionMode}
            icon={<ShieldAlert className="h-5 w-5" />}
            color={risk.status === "Normal" ? "green" : risk.status === "Caution" ? "amber" : "red"}
          />
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What this means for you</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {risk.status === "Normal"
              ? "Your portfolio can be adjusted to match the model's current recommendations. No restrictions on new buys."
              : risk.status === "Caution"
              ? "You can still adjust your portfolio, but new purchases should be spread over time rather than invested all at once."
              : "New purchases are paused. Only risk-reducing trades (selling or reducing positions) are recommended at this time."}
          </p>
        </div>
        </>}
      </section>

      {/* ── MODEL VIEW ────────────────────────────────────────────────────── */}
      {overview && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Model View</h3>
          <TermTooltip term="factor">
            <span className="text-xs text-slate-400">What the model currently favours</span>
          </TermTooltip>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {[
              ["Momentum", allocation?.momentum_weight || 0],
              ["Value", allocation?.value_weight || 0],
              ["Quality", allocation?.quality_weight || 0],
              ["Low Volatility", allocation?.low_volatility_weight || 0],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <TermTooltip term={label as string}>
                    <span>{label}</span>
                  </TermTooltip>
                  <span>{formatPercent(value as number, 0)}</span>
                </div>
                <ProgressBar value={value as number} />
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Market indicators</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md bg-white p-2">
                <p className="text-slate-500">Nifty 200</p>
                <p className="mt-1 font-semibold text-slate-900">{latestMarket?.close?.toLocaleString() || "—"}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="text-slate-500">India VIX</p>
                <p className="mt-1 font-semibold text-slate-900">{latestMacro?.india_vix?.toFixed(1) || "—"}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="text-slate-500">10Y G-Sec</p>
                <p className="mt-1 font-semibold text-slate-900">{latestMacro?.ten_year_yield?.toFixed(1) || "—"}%</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="text-slate-500">USD/INR</p>
                <p className="mt-1 font-semibold text-slate-900">{latestMacro?.usd_inr?.toFixed(2) || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>}
    </div>
  );
}
