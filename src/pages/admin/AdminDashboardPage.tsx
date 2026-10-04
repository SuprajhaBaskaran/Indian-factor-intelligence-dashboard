import { Card, Badge, StatCard } from "@/components/UI";
import { getEodRefreshStatus, getExperimentManifest, getLatestRegime, getLatestAllocation } from "@/lib/data";
import { formatPercent } from "@/lib/data";

export function AdminDashboardPage() {
  const eod = getEodRefreshStatus();
  const manifest = getExperimentManifest();
  const regime = getLatestRegime();
  const allocation = getLatestAllocation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Admin Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">System status, model status, and operational overview.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="EOD Status"
          value={eod.status}
          subvalue={eod.resolved_date || "—"}
          color={eod.status === "ok" ? "green" : eod.status === "no_data" ? "amber" : "red"}
        />
        <StatCard
          label="Model Version"
          value={manifest?.run?.fingerprint?.slice(0, 8) || "Unavailable"}
          subvalue={regime?.model_version || "Model version unavailable"}
          color="blue"
        />
        <StatCard
          label="Latest Regime"
          value={regime?.regime_label || "—"}
          subvalue={regime?.month || "—"}
          color="slate"
        />
        <StatCard
          label="Data Freshness"
          value={manifest?.data_freshness?.status || "Unavailable"}
          subvalue={manifest?.data_freshness?.eod?.latest_date || "Freshness date unavailable"}
          color={manifest?.data_freshness?.status === "current" ? "green" : "amber"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pipeline manifest" subtitle="Available pipeline snapshot; distinct from published model-run records">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Fingerprint</span>
              <span className="font-mono text-xs">{manifest?.run?.fingerprint?.slice(0, 16) || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Started</span>
              <span>{manifest?.run?.started_at || "Unavailable"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Runtime</span>
              <span>{manifest?.run?.runtime_seconds == null ? "Unavailable" : `${manifest.run.runtime_seconds.toFixed(1)}s`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">News Mode</span>
              <span>{manifest?.news_mode || "Unavailable"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Caveats</span>
              <span>
                {manifest?.caveat_summary ? `${manifest.caveat_summary.high} high / ${manifest.caveat_summary.medium} med / ${manifest.caveat_summary.low} low` : "Unavailable"}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Factor Allocation" subtitle="Latest model weights">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Momentum</span>
              <span>{allocation?.momentum_weight == null ? "Unavailable" : formatPercent(allocation.momentum_weight, 1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Value</span>
              <span>{allocation?.value_weight == null ? "Unavailable" : formatPercent(allocation.value_weight, 1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Quality</span>
              <span>{allocation?.quality_weight == null ? "Unavailable" : formatPercent(allocation.quality_weight, 1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Low Volatility</span>
              <span>{allocation?.low_volatility_weight == null ? "Unavailable" : formatPercent(allocation.low_volatility_weight, 1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Turnover</span>
              <span>{allocation?.turnover == null ? "Unavailable" : formatPercent(allocation.turnover, 1)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Warnings" subtitle="Active warnings from the latest run">
        {manifest?.caveats && manifest.caveats.length > 0 ? (
          <div className="space-y-2">
            {manifest.caveats.map((caveat) => (
              <div key={caveat.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                <Badge color={caveat.severity === "high" ? "red" : caveat.severity === "medium" ? "amber" : "slate"}>
                  {caveat.severity}
                </Badge>
                <div>
                  <p className="font-medium text-slate-900">{caveat.statement}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{caveat.why_not_fixed}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{manifest ? "No active warnings in the available run record." : "Run warning status is unavailable because no manifest was loaded."}</p>
        )}
      </Card>
    </div>
  );
}
