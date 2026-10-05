import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  IndianRupee,
  ListPlus,
  Save,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatPercent, getLatestRegime } from "@/lib/data";
import {
  buildCashDeploymentPlan,
  buildTradePlan,
  downloadTextFile,
  formatCurrency,
  getDecisionSnapshot,
  parseHoldingsCsv,
  parseHoldingsText,
  tradePlanToCsv,
  type UserHolding,
} from "@/lib/product";
import { useUserData, type UserHolding as PersistedHolding } from "@/lib/userData";
import { markFreshMoneyIncluded, readUserExperience } from "@/lib/userExperience";

type PlanMode = "fresh" | "holdings";

function holdingsToText(rows: UserHolding[]) {
  return rows.map((row) => `${row.symbol},${row.quantity}${row.avgPrice ? `,${row.avgPrice}` : ""}`).join("\n");
}

function parseIssues(text: string) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter(({ line }) => line)
    .flatMap(({ line, index }) => {
      const [symbol, quantity] = line.split(/[,\t ]+/);
      if (!symbol) return [`Line ${index}: add a stock symbol.`];
      if (!quantity || !Number.isFinite(Number(quantity))) return [`Line ${index}: quantity must be a number.`];
      return [];
    });
}

function modeLabel(mode: PlanMode) {
  return mode === "fresh" ? "Fresh money plan" : "Existing holdings review";
}

export function TradePlanPage() {
  const userData = useUserData();
  const { user } = useAuth();
  const experience = useMemo(() => user ? readUserExperience(user.id) : null, [user]);
  const initialMode = experience?.hasInvestments ? "holdings" : "fresh";
  const pendingFreshMoney = experience?.freshMoneyPending ? experience.freshMoneyAmount : 0;
  const [mode, setMode] = useState<PlanMode>(initialMode);
  const [holdingsText, setHoldingsText] = useState("");
  const [cashText, setCashText] = useState(String(pendingFreshMoney || 0));
  const [minimumTradeText, setMinimumTradeText] = useState("1000");
  const [basketText, setBasketText] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([userData.getHoldings(), userData.getCash(), userData.getPreferences()])
      .then(([holdings, savedCash, preferences]) => {
        if (!active) return;
        const savedText = holdingsToText(holdings);
        setHoldingsText(savedText);
        const preferredCash = savedCash + pendingFreshMoney || preferences.preferredCapital || 0;
        setCashText(String(preferredCash));
        if (holdings.length > 0) setMode("holdings");
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Saved plan data could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [pendingFreshMoney, userData]);

  const cash = Number(cashText) || 0;
  const minimumTradeValue = Number(minimumTradeText) || 0;
  const holdings = useMemo(() => parseHoldingsText(holdingsText), [holdingsText]);
  const issues = useMemo(() => parseIssues(holdingsText), [holdingsText]);
  const basketSymbols = useMemo(() => basketText.split(/[\s,]+/).map((item) => item.trim().toUpperCase()).filter(Boolean), [basketText]);
  const preview = buildTradePlan(holdings, cash, minimumTradeValue);
  const cashPlan = buildCashDeploymentPlan(cash, basketSymbols, minimumTradeValue);
  const snapshot = getDecisionSnapshot();
  const regime = getLatestRegime();
  const executableRows = preview.rows.filter((row) => row.finalTradeQuantity !== 0);
  const buyRows = preview.rows.filter((row) => row.action === "BUY" || row.action === "ADD");
  const reduceRows = preview.rows.filter((row) => row.action === "SELL" || row.action === "REDUCE");

  const savePlan = async () => {
    setMessage("");
    setError("");
    if (mode === "holdings" && issues.length > 0) {
      setError("Fix the holdings format before saving.");
      return;
    }
    try {
      await Promise.all([userData.saveHoldings(holdings as PersistedHolding[]), userData.saveCash(cash)]);
      await userData.saveTradePlan({
        generatedAt: new Date().toISOString(),
        action: snapshot.decision?.decision || "RETAIN",
        status: "draft",
        signalDate: `${snapshot.latestMonth || new Date().toISOString().slice(0, 7)}-01`,
        items: mode === "fresh"
          ? cashPlan.rows.map((row) => ({
              symbol: row.symbol,
              currentQuantity: 0,
              targetQuantity: row.quantity,
              executableQuantity: row.quantity,
              action: "BUY",
              reason: row.reason,
            }))
          : preview.rows.map((row) => ({
              symbol: row.symbol,
              currentQuantity: row.currentQuantity,
              targetQuantity: row.targetQuantity,
              executableQuantity: row.finalTradeQuantity,
              action: row.action,
              reason: row.reason,
            })),
      });
      if (user?.id && experience?.freshMoneyPending) markFreshMoneyIncluded(user.id);
      setMessage("Saved as a draft plan. No trades were placed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this plan.");
    }
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    setHoldingsText(holdingsToText(parseHoldingsCsv(await file.text())));
    setMode("holdings");
  };

  const exportPlan = () => downloadTextFile("my_plan_trade_actions.csv", tradePlanToCsv(preview.rows));

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
          <div className="bg-slate-950 p-6 text-white md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-200">My Plan</p>
            <h2 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight md:text-3xl">
              Convert the model into a clear next step.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Start with cash or compare your holdings. The page creates a reviewable draft only; it never places orders.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <SummaryPill label="Mode" value={modeLabel(mode)} />
              <SummaryPill label="Model month" value={snapshot.latestMonth} />
              <SummaryPill label="Market regime" value={regime?.regime_label || "Unavailable"} />
            </div>
          </div>
          <div className="bg-slate-50 p-6 md:p-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <MetricCard label={mode === "fresh" ? "Capital entered" : "Portfolio value"} value={mode === "fresh" ? formatCurrency(cash) : formatCurrency(preview.portfolioValue)} />
              <MetricCard label={mode === "fresh" ? "Buy ideas" : "Actionable changes"} value={mode === "fresh" ? String(cashPlan.rows.length) : String(executableRows.length)} tone="blue" />
              <MetricCard label="Risk note" value={cashPlan.action === "Wait" ? "Wait" : snapshot.decision?.decision || "Review"} tone="amber" />
            </div>
          </div>
        </div>
      </section>

      {(loading || message || error) && (
        <div className={`rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
          {loading ? "Loading your saved cash and holdings..." : error || message}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-950">Choose your workflow</p>
            <div className="mt-3 grid gap-2">
              <ModeButton active={mode === "fresh"} icon={<Wallet size={18} />} title="I have fresh money" body="Enter an amount and get a starting basket from the model." onClick={() => setMode("fresh")} />
              <ModeButton active={mode === "holdings"} icon={<BriefcaseBusiness size={18} />} title="I already own stocks" body="Paste or import holdings and see buy, reduce, hold, or exit actions." onClick={() => setMode("holdings")} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">Inputs</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">Draft only</span>
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-600">
              {mode === "fresh" ? "Amount to invest" : "Free cash available"}
              <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 focus-within:border-blue-500">
                <IndianRupee size={15} className="text-slate-400" />
                <input value={cashText} onChange={(event) => setCashText(event.target.value)} className="w-full border-0 px-2 py-2.5 text-sm outline-none" placeholder="50000" />
              </div>
            </label>
            <label className="mt-4 block text-xs font-semibold text-slate-600">
              Minimum trade size
              <input value={minimumTradeText} onChange={(event) => setMinimumTradeText(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            </label>

            {mode === "fresh" ? (
              <label className="mt-4 block text-xs font-semibold text-slate-600">
                Optional stock focus list
                <textarea value={basketText} onChange={(event) => setBasketText(event.target.value)} className="mt-1 h-24 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none focus:border-blue-500" placeholder="Leave blank for model picks, or type: INFY TCS PFC" />
                <span className="mt-2 block text-[11px] leading-5 text-slate-500">Blank uses the model target list. A focus list restricts buy ideas to those symbols.</span>
              </label>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100">
                  <Upload className="mx-auto mb-2 h-5 w-5" />
                  Import holdings CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => importFile(event.target.files?.[0] || null)} />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Paste holdings
                  <textarea value={holdingsText} onChange={(event) => setHoldingsText(event.target.value.toUpperCase())} className="mt-1 h-40 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none focus:border-blue-500" placeholder={"PFC,10,420\nTCS,3,3900\nINFY,8"} />
                </label>
                {issues.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">
                    {issues.slice(0, 3).map((issue) => <p key={issue}>{issue}</p>)}
                  </div>
                )}
              </div>
            )}

            <button onClick={savePlan} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
              <Save size={16} />
              Save My Plan
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <DecisionCard icon={<ShieldCheck size={18} />} label="Main action" value={mode === "fresh" ? cashPlan.action : executableRows.length ? "Review changes" : "Hold / wait"} />
            <DecisionCard icon={<ListPlus size={18} />} label={mode === "fresh" ? "To invest" : "Buys / adds"} value={mode === "fresh" ? formatCurrency(cashPlan.totalUsed) : String(buyRows.length)} />
            <DecisionCard icon={<AlertTriangle size={18} />} label={mode === "fresh" ? "Cash left" : "Reduce / sell"} value={mode === "fresh" ? formatCurrency(cashPlan.cashLeft) : String(reduceRows.length)} />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h3 className="text-base font-semibold text-slate-950">{mode === "fresh" ? "Starting Basket" : "Recommended Changes"}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {mode === "fresh" ? cashPlan.message : "Review these draft actions against your holdings before doing anything in your broker account."}
                </p>
              </div>
              {mode === "holdings" && (
                <button onClick={exportPlan} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Download size={14} />
                  Export
                </button>
              )}
            </div>
            <div className="p-5">
              {mode === "fresh" ? (
                cashPlan.rows.length === 0 ? <EmptyState title="No buy list yet" body="Enter enough capital, or lower the minimum trade size, to generate a reviewable starting basket." /> : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {cashPlan.rows.map((row) => (
                      <article key={row.symbol} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-950">{row.symbol}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{row.reason}</p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Buy {row.quantity}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                          <InfoBox label="Approx amount" value={formatCurrency(row.buyValue)} />
                          <InfoBox label="Latest price" value={formatCurrency(row.latestPrice)} />
                        </div>
                      </article>
                    ))}
                  </div>
                )
              ) : holdings.length === 0 ? (
                <EmptyState title="Add holdings to personalize this" body="Paste symbols and quantities, or import a broker CSV. The model will compare them with target weights." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="pb-3">Stock</th>
                        <th className="pb-3 text-right">Current</th>
                        <th className="pb-3 text-right">Target</th>
                        <th className="pb-3 text-center">Action</th>
                        <th className="pb-3 text-right">Trade value</th>
                        <th className="pb-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 18).map((row) => (
                        <tr key={row.symbol} className="border-t border-slate-100">
                          <td className="py-3 font-semibold text-slate-950">{row.symbol}</td>
                          <td className="py-3 text-right">{row.currentQuantity}</td>
                          <td className="py-3 text-right">{row.targetQuantity}</td>
                          <td className="py-3 text-center"><ActionBadge action={row.action} /></td>
                          <td className="py-3 text-right">{formatCurrency(row.tradeValue)}</td>
                          <td className="py-3 text-xs leading-5 text-slate-600">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-950">What This Means</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoBox label="Model stance" value={snapshot.decision?.decision || "Review"} />
              <InfoBox label="Regime confidence" value={regime?.regime_confidence == null ? "Unavailable" : formatPercent(regime.regime_confidence)} />
              <InfoBox label="Safety" value="Review before acting" />
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
              This tab is a decision support workspace. It organizes model output, your inputs, and risk notes; it is not a broker and does not execute trades.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/10 p-3"><p className="text-[11px] text-slate-300">{label}</p><p className="mt-1 truncate text-sm font-semibold text-white">{value}</p></div>;
}

function MetricCard({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "blue" | "amber" }) {
  const colors = tone === "blue" ? "text-blue-700" : tone === "amber" ? "text-amber-700" : "text-slate-950";
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${colors}`}>{value}</p></div>;
}

function ModeButton({ active, icon, title, body, onClick }: { active: boolean; icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-lg border p-3 text-left transition ${active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
      <div className="flex gap-3">
        <span className={active ? "text-blue-700" : "text-slate-500"}>{icon}</span>
        <span>
          <span className="block text-sm font-semibold text-slate-950">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">{body}</span>
        </span>
      </div>
    </button>
  );
}

function DecisionCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="text-blue-700">{icon}</div><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-950">{value}</p></div>;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><div><p className="text-sm font-semibold text-slate-950">{title}</p><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p></div></div>;
}

function ActionBadge({ action }: { action: string }) {
  const tone = action === "BUY" || action === "ADD" ? "bg-emerald-50 text-emerald-700" : action === "SELL" || action === "REDUCE" ? "bg-red-50 text-red-700" : action === "PAUSED" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{action}</span>;
}
