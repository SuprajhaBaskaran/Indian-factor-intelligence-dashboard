import { Card, Table } from "@/components/UI";
import { Badge } from "@/components/UI";
import { BacktestReliability } from "@/components/BacktestReliability";
import { formatPercent, formatNumber, getBacktestSummary, getPerformanceReport, getCostScenarios } from "@/lib/data";

export function AdminModelPage() {
  const summaries = getBacktestSummary();
  const performance = getPerformanceReport();
  const costScenarios = getCostScenarios();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Trust / Validation</h2>
        <p className="mt-1 text-sm text-slate-500">Review available research metrics, validation evidence, and stated limitations.</p>
      </div>

      <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <div className="flex items-center gap-2"><Badge color="amber">Historical research</Badge><span className="font-semibold">These outputs are not a published model-run record.</span></div>
        <p className="mt-1">Numbers below are displayed as supplied in the available backtest artifacts. This page does not assert that the model is validated or production-ready.</p>
      </div>

      <Card title="Performance results" subtitle="Historical strategy metrics from the available backtest summary">
        <Table
          columns={[
            { key: "strategy", label: "Strategy" },
            { key: "cagr", label: "CAGR", align: "right" },
            { key: "sharpe", label: "Sharpe", align: "right" },
            { key: "drawdown", label: "Max DD", align: "right" },
            { key: "turnover", label: "Turnover", align: "right" },
          ]}
          data={summaries.map((s) => ({
            strategy: s.strategy_name,
            cagr: formatPercent(s.cagr, 2),
            sharpe: formatNumber(s.sharpe, 2),
            drawdown: formatPercent(s.max_drawdown, 2),
            turnover: formatPercent(s.avg_turnover, 2),
          }))}
        />
      </Card>

      <section className="space-y-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Validation</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Reliability and assumptions</h3><p className="mt-1 text-sm text-slate-500">Uncertainty, assumptions, and constraints attached to available research results.</p></div>
        <BacktestReliability />
      </section>

      {performance && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Risk Metrics" subtitle="Extended risk statistics">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">CVaR (95%)</span>
                <span>{formatPercent(performance.return_path?.cvar_95_monthly || 0, 1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Longest Drawdown</span>
                <span>{performance.return_path?.longest_drawdown_months || 0} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ulcer Index</span>
                <span>{formatNumber(performance.return_path?.ulcer_index || 0, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Skew</span>
                <span>{formatNumber(performance.return_path?.skew || 0, 2)}</span>
              </div>
            </div>
          </Card>

          <Card title="Benchmark Comparison" subtitle="vs Nifty 200">
            {performance.vs_benchmark && !("beta" in performance.vs_benchmark) ? <p className="text-sm text-slate-500">Benchmark metrics unavailable: {performance.vs_benchmark.reason}</p> : <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Beta</span>
                <span>{formatNumber(performance.vs_benchmark?.beta || 0, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Alpha</span>
                <span>{formatPercent(performance.vs_benchmark?.alpha_annual || 0, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Information Ratio</span>
                <span>{formatNumber(performance.vs_benchmark?.information_ratio || 0, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tracking Error</span>
                <span>{formatPercent(performance.vs_benchmark?.tracking_error_annual || 0, 2)}</span>
              </div>
            </div>}
          </Card>
        </div>
      )}

      {costScenarios?.scenarios && (
        <Card title="Cost Sensitivity" subtitle="CAGR at different transaction cost levels">
          <Table
            columns={[
              { key: "label", label: "Cost" },
              { key: "cagr", label: "CAGR", align: "right" },
              { key: "sharpe", label: "Sharpe", align: "right" },
              { key: "drawdown", label: "Max DD", align: "right" },
            ]}
            data={costScenarios.scenarios.map((s) => ({
              label: s.label,
              cagr: formatPercent(s.cagr, 2),
              sharpe: formatNumber(s.sharpe, 2),
              drawdown: formatPercent(s.max_drawdown, 2),
            }))}
          />
        </Card>
      )}
    </div>
  );
}
