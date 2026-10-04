import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge, Card, Table } from "@/components/UI";
import { formatNumber, getExperimentManifest, getStockLevelSummary } from "@/lib/data";
import { getDecisionSnapshot } from "@/lib/product";

export function PerformanceTrustPage() {
  const { decision, risk, latestMonth, latestEod } = getDecisionSnapshot();
  const manifest = getExperimentManifest();
  const stockSummary = getStockLevelSummary() as { months?: number; omitted_periods?: string[]; path_complete?: boolean; period_statistics_scope?: string; return_definition?: string } | null;
  const caveats = manifest?.caveats || [];
  const actionable = decision?.decision === "REBALANCE" || decision?.decision === "DEFENSIVE";
  const recentMetricScope = stockSummary?.period_statistics_scope || "Evaluated periods only";

  return <div className="space-y-6">
    <div><h2 className="text-xl font-bold text-slate-900">Trust</h2><p className="mt-1 text-sm text-slate-500">Current model status and research limitations, drawn from the published run report.</p></div>
    <Card title="Current Model Status" subtitle="The model provides planning outputs; the application does not place brokerage orders">
      <div className={`rounded-lg p-4 text-sm leading-6 ${risk.status === "Caution" || risk.status === "Danger" || risk.status === "Extreme" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
        <div className="mb-2 flex flex-wrap gap-2"><Badge color={actionable ? "amber" : "slate"}>{decision?.decision || "RETAIN"}</Badge><Badge color={risk.status === "Normal" ? "green" : "amber"}>{risk.executionMode === "Full Execute" ? "Standard plan" : risk.executionMode}</Badge><Badge color="blue">Model month {latestMonth}</Badge><Badge color="slate">Latest EOD data {latestEod}</Badge></div>
        <p className="font-semibold">{actionable ? "The latest monthly output indicates a rebalance, subject to the daily risk overlay." : "The latest monthly output does not call for a rebalance."}</p>
        <p className="mt-1">Review and approve any action in My Plan. Daily risk controls can stagger or pause new buys.</p>
      </div>
    </Card>
    <Card title="Backtest coverage" subtitle="Incomplete historical paths limit full-period conclusions">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-800">Historical path</p><p className="mt-1 font-semibold text-amber-950">{stockSummary?.path_complete === false ? "Incomplete" : "Status unavailable"}</p></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Unresolved omitted periods</p><p className="mt-1 font-semibold text-slate-900">{stockSummary?.omitted_periods?.length ?? "Unavailable"}</p></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Available statistics</p><p className="mt-1 font-semibold text-slate-900">{recentMetricScope}</p></div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">Full-period CAGR, total return, drawdown and related metrics are withheld where the return path is incomplete. Any reported period statistics describe evaluated periods only. {stockSummary?.return_definition || "The published return definition is unavailable."}</p>
      {stockSummary?.omitted_periods?.length ? <p className="mt-2 text-xs text-slate-500">Omitted periods: {stockSummary.omitted_periods.join(", ")}</p> : null}
    </Card>
    <Card title="Research limitations" subtitle="Limitations from the current run manifest">
      {caveats.length ? <Table columns={[{ key: "severity", label: "Level" }, { key: "statement", label: "Limitation" }, { key: "why_not_fixed", label: "Context" }]} data={caveats.map((c) => ({ severity: c.severity, statement: c.statement, why_not_fixed: c.why_not_fixed }))} /> : <p className="text-sm text-slate-500">Research caveat manifest is unavailable.</p>}
    </Card>
    <Card title="Research measures" subtitle="Evaluated-period values are not full-period estimates">
      <p className="text-sm leading-6 text-slate-600">{stockSummary?.months ?? "—"} periods evaluated. Full-period metrics are not presented here because the historical path is incomplete. The detailed validation results and definitions are in Research.</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><span>Latest model month: {latestMonth}</span><span>Latest data: {latestEod}</span><span>Available metric records: {formatNumber(stockSummary?.months ?? NaN, 0)}</span></div>
    </Card>
    <Card title="Current product claim"><div className="rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><p className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} />Decision support</p><p className="mt-2">The system publishes monthly portfolio-model outputs with a daily EOD risk overlay. This is a planning tool, not autonomous brokerage execution.</p></div></Card>
    {caveats.length === 0 && <div className="flex gap-2 text-xs text-slate-500"><AlertTriangle size={14}/>Run caveat data is not currently available.</div>}
  </div>;
}
