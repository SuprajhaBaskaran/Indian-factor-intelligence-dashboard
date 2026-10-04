import { Card, Badge } from "@/components/UI";
import { getEodRefreshStatus, getExperimentManifest, getLatestRegime } from "@/lib/data";

export function AdminPipelinePage() {
  const eod = getEodRefreshStatus();
  const manifest = getExperimentManifest();
  const regime = getLatestRegime();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Pipeline</h2>
        <p className="mt-1 text-sm text-slate-500">EOD refresh status, data freshness, and pipeline warnings.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card title="EOD Status" subtitle="Latest refresh status">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <Badge color={eod.status === "ok" ? "green" : eod.status === "no_data" ? "amber" : "red"}>{eod.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Resolved Date</span>
              <span>{eod.resolved_date || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Stock Rows</span>
              <span>{eod.stock_rows ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Index Rows</span>
              <span>{eod.index_rows ?? "—"}</span>
            </div>
          </div>
        </Card>

        <Card title="Data Freshness" subtitle="Data currency status">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <Badge color={manifest?.data_freshness?.status === "current" ? "green" : "amber"}>
                {manifest?.data_freshness?.status || "unknown"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Latest EOD</span>
              <span>{manifest?.data_freshness?.eod?.latest_date || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Trading Days Behind</span>
              <span>{manifest?.data_freshness?.eod?.trading_days_behind ?? "—"}</span>
            </div>
          </div>
        </Card>

        <Card title="Model Status" subtitle="Latest model run">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Model Version</span>
              <span>{regime?.model_version || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Regime</span>
              <span>{regime?.regime_label || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Confidence</span>
              <span>{regime?.regime_confidence ? (regime.regime_confidence * 100).toFixed(1) + "%" : "—"}</span>
            </div>
          </div>
        </Card>

        <Card title="Pipeline Warnings" subtitle="Active warnings">
          <div className="space-y-2 text-sm">
            {manifest?.caveats && manifest.caveats.length > 0 ? (
              manifest.caveats.slice(0, 3).map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <Badge color={c.severity === "high" ? "red" : c.severity === "medium" ? "amber" : "slate"}>
                    {c.severity}
                  </Badge>
                  <span className="text-xs">{c.statement}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500">No active warnings.</p>
            )}
          </div>
        </Card>
      </div>

      <Card title="EOD Refresh Details" subtitle="Detailed refresh information">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Run ID</span>
            <span className="font-mono text-xs">{eod.run_id || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Requested Date</span>
            <span>{eod.requested_date || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Started At</span>
            <span>{eod.started_at || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Finished At</span>
            <span>{eod.finished_at || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Message</span>
            <span>{eod.message || "—"}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
