import { useEffect, useState } from "react";
import { Badge, Card, Table } from "@/components/UI";
import { supabase } from "@/lib/supabase";

type ModelRun = {
  id: string; signal_date: string; information_cutoff: string; execution_date: string;
  model_version: string; data_version: string | null; regime_label: string | null;
  regime_confidence: number | null; momentum_weight: number | null; value_weight: number | null;
  quality_weight: number | null; low_volatility_weight: number | null; risk_status: string | null;
  warnings: unknown;
};

export function AdminModelRunsPage() {
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    supabase!.from("model_runs").select("id,signal_date,information_cutoff,execution_date,model_version,data_version,regime_label,regime_confidence,momentum_weight,value_weight,quality_weight,low_volatility_weight,risk_status,warnings").order("signal_date", { ascending: false }).limit(100)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) setError("Model run history is unavailable. Check admin access and database policies.");
        else setRuns((data || []) as ModelRun[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  return <div className="space-y-6">
    <div><h2 className="text-xl font-bold text-slate-900">Model Runs</h2><p className="mt-1 text-sm text-slate-500">Published run dates, information cutoffs, model versions, regime, weights, risk, and warnings.</p></div>
    {loading && <p className="text-sm text-slate-500">Loading model runs…</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!loading && !error && <Card title="Stored model runs" subtitle={`${runs.length} most recent records`}>
      {runs.length ? <Table maxHeight="600px" columns={[{key:"signal",label:"Signal"},{key:"cutoff",label:"Information cutoff"},{key:"execution",label:"Execution"},{key:"version",label:"Model / data"},{key:"regime",label:"Regime"},{key:"confidence",label:"Confidence",align:"right"},{key:"weights",label:"Factor weights"},{key:"risk",label:"Risk"},{key:"warnings",label:"Warnings"}]} data={runs.map(r=>({signal:r.signal_date,cutoff:r.information_cutoff,execution:r.execution_date,version:<span>{r.model_version}<br/><small>{r.data_version || "Data version unavailable"}</small></span>,regime:r.regime_label || "—",confidence:r.regime_confidence == null ? "—" : `${(r.regime_confidence*100).toFixed(1)}%`,weights:`M ${r.momentum_weight ?? "—"} · V ${r.value_weight ?? "—"} · Q ${r.quality_weight ?? "—"} · LV ${r.low_volatility_weight ?? "—"}`,risk:<Badge color={r.risk_status === "Normal" ? "green" : "amber"}>{r.risk_status || "Unknown"}</Badge>,warnings:Array.isArray(r.warnings) ? r.warnings.length : r.warnings ? "See run record" : "None recorded"}))}/> : <p className="text-sm text-slate-600">No model runs have been published to the database yet. Static pipeline snapshots do not count as stored database runs.</p>}
    </Card>}
  </div>;
}
