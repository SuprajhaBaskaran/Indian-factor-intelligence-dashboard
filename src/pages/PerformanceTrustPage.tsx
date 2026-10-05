import { Activity, BarChart3, Database, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge, Card } from "@/components/UI";
import {
  DYNAMIC_STRATEGY,
  formatNumber,
  formatPercent,
  getBacktestSummary,
  getExperimentManifest,
  getNifty500DataAudit,
  getPerformanceReport,
  getStockLevelSummary,
} from "@/lib/data";
import { getDecisionSnapshot } from "@/lib/product";

type StockSummary = {
  months?: number;
  omitted_periods?: string[];
  path_complete?: boolean;
  period_statistics_scope?: string;
  return_definition?: string;
};

export function PerformanceTrustPage() {
  const { risk, latestMonth, latestEod } = getDecisionSnapshot();
  const manifest = getExperimentManifest();
  const performance = getPerformanceReport();
  const audit = getNifty500DataAudit();
  const stockSummary = getStockLevelSummary() as StockSummary | null;
  const summary = getBacktestSummary().find((row) => row.strategy_name === DYNAMIC_STRATEGY);
  const caveats = manifest?.caveats || [];
  const coverageTotal = audit?.summary.officialConstituentRows ?? 0;
  const coverageLoaded = audit?.summary.monthlyPriceCoverage ?? 0;
  const coveragePct = coverageTotal > 0 ? coverageLoaded / coverageTotal : null;
  const rolling = performance?.rolling_36m;
  const benchmark = performance?.vs_benchmark?.available ? performance.vs_benchmark : null;
  const selection = performance?.selection_bias && "observed_sharpe" in performance.selection_bias ? performance.selection_bias : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Trust</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Evidence for a teacher, reviewer, or new investor: real data coverage, visible model logic, performance checks, anti-cheating controls, and safety rules before any user acts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge color="blue">Model month {latestMonth}</Badge>
          <Badge color={risk.status === "Normal" ? "green" : "amber"}>Risk {risk.status}</Badge>
          <Badge color="slate">Latest close {latestEod}</Badge>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ProofMetric
          label="Tradable stock coverage"
          value={coverageTotal ? `${coverageLoaded}/${coverageTotal}` : "Unavailable"}
          detail={coveragePct == null ? "Nifty 500 audit not loaded" : `${formatPercent(coveragePct, 0)} of user-facing tradable stocks have price history`}
          tone="green"
        />
        <ProofMetric
          label="Risk-adjusted return"
          value={performance ? formatNumber(performance.risk_adjusted.sharpe_vs_rf, 2) : formatNumber(summary?.sharpe, 2)}
          detail={performance?.risk_free_assumption.is_measured ? "Sharpe vs measured 10Y G-Sec rate" : "Sharpe from published backtest summary"}
          tone="blue"
        />
        <ProofMetric
          label="Worst drawdown"
          value={formatPercent(summary?.max_drawdown, 1)}
          detail={performance?.return_path.longest_drawdown_months ? `Longest drawdown ${performance.return_path.longest_drawdown_months} months` : "Peak-to-trough historical fall"}
          tone="amber"
        />
        <ProofMetric
          label="Benchmark test"
          value={benchmark ? formatNumber(benchmark.information_ratio, 2) : "Unavailable"}
          detail={benchmark ? `Information ratio vs ${benchmark.benchmark}` : "Benchmark-relative report not loaded"}
          tone="slate"
        />
      </section>

      <Card title="1. Data Trust" subtitle="The system shows what data it can actually use">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <ProofBlock
            icon={<Database className="h-5 w-5" />}
            title="Real market files, not hand-entered demo prices"
            body={`The Stocks page is backed by exported price history. The current user-facing Nifty universe is ${coverageTotal || "not available"} tradable stocks, with ${coverageLoaded || "no"} stocks covered by monthly price rows. Non-tradable dummy exchange placeholders are removed instead of filled with fake data.`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Latest EOD data" value={latestEod} />
            <MiniMetric label="Coverage" value={coveragePct == null ? "Unavailable" : formatPercent(coveragePct, 0)} />
            <MiniMetric label="Run fingerprint" value={manifest?.run?.fingerprint || "See manifest"} />
            <MiniMetric label="Return scope" value={stockSummary?.period_statistics_scope || "Published report"} />
          </div>
        </div>
      </Card>

      <Card title="2. Model Logic" subtitle="A recommendation is a decision path, not a random AI stock tip">
        <div className="grid gap-3 md:grid-cols-3">
          <ProofBlock icon={<Activity className="h-5 w-5" />} title="Factor selection" body="Stocks are selected through model artifacts such as Value, Quality, Momentum, and Low Volatility, then converted into target weights." />
          <ProofBlock icon={<BarChart3 className="h-5 w-5" />} title="Portfolio construction" body="My Plan compares saved holdings and cash against model target weights, then sizes buy, sell, reduce, add, or hold actions." />
          <ProofBlock icon={<ShieldCheck className="h-5 w-5" />} title="Daily risk overlay" body={`The current overlay is ${risk.status}. It can allow, stagger, or pause new buys while still allowing risk-reducing actions.`} />
        </div>
      </Card>

      <Card title="3. Performance Metrics" subtitle="The page reports risk, not only returns">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniMetric label="CAGR" value={formatPercent(summary?.cagr, 1)} />
          <MiniMetric label="Volatility" value={formatPercent(summary?.annual_volatility, 1)} />
          <MiniMetric label="Sharpe" value={performance ? formatNumber(performance.risk_adjusted.sharpe_vs_rf, 2) : formatNumber(summary?.sharpe, 2)} />
          <MiniMetric label="Avg turnover" value={formatPercent(summary?.avg_turnover, 1)} />
          <MiniMetric label="CVaR 95% month" value={formatPercent(performance?.return_path.cvar_95_monthly, 1)} />
          <MiniMetric label="Information ratio" value={benchmark ? formatNumber(benchmark.information_ratio, 2) : "—"} />
          <MiniMetric label="Rolling positive CAGR" value={rolling ? formatPercent(rolling.pct_windows_positive_cagr, 0) : "—"} />
          <MiniMetric label="False-positive risk" value={selection ? formatPercent(selection.probability_of_false_positive, 1) : "—"} />
        </div>
      </Card>

      <Card title="4. Robustness Checks" subtitle="The system states what it knows and what it refuses to infer">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <ProofBlock
            icon={<LockKeyhole className="h-5 w-5" />}
            title="Timing discipline"
            body="The model separates signal month, information cutoff, EOD data date, and execution logic. That reduces look-ahead bias because the UI does not pretend future data was available earlier."
          />
          <ProofBlock
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No fake completeness"
            body={stockSummary?.path_complete === false
              ? `Full-path conclusions are withheld because ${stockSummary.omitted_periods?.length ?? "some"} periods are unresolved. Evaluated-period metrics are still shown with their scope.`
              : "The report states the available path status directly instead of hiding data quality concerns."}
          />
        </div>
        {caveats.length > 0 && (
          <div className="mt-4 grid gap-2">
            {caveats.slice(0, 3).map((caveat) => (
              <div key={caveat.statement} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-900">{caveat.severity}: </span>{caveat.statement}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="5. Newbie Safety Controls" subtitle="The product is designed to slow users down when the evidence is weak">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SafetyStep title="Wait is valid" body="The system can say no buy, so it does not force trades just because the user has cash." />
          <SafetyStep title="User must approve" body="The app creates a plan and draft actions. It does not place brokerage orders." />
          <SafetyStep title="Position sizing" body="Actions depend on cash, holdings, latest price, and minimum trade size." />
          <SafetyStep title="Research vs action" body="Stocks outside the selected model basket can be researched without being presented as buys." />
        </div>
      </Card>

      <Card title="Teacher Demo Script" subtitle="What to say when someone asks why they should trust it">
        <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
          This is a decision-support system, not a stock-tip generator. A user can trust it only to the extent that its data coverage, model timing, risk-adjusted performance, robustness checks, and safety rules are visible. Every buy, sell, hold, or wait instruction should be explainable from these artifacts before a user acts.
        </div>
      </Card>
    </div>
  );
}

function ProofMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "green" | "blue" | "amber" | "slate" }) {
  const color = tone === "green" ? "border-emerald-100 bg-emerald-50 text-emerald-900" : tone === "blue" ? "border-blue-100 bg-blue-50 text-blue-950" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-950" : "border-slate-200 bg-white text-slate-900";
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function ProofBlock({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-900">
        {icon}
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function SafetyStep({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{body}</p>
    </div>
  );
}
