import { Card, StatCard } from "@/components/UI";
import {
  getLatestUniverseResolution,
  getPointInTimeSurvivorship,
  getUniverseCoverage,
} from "@/lib/data";

export function UniverseCoverage({ compact = false }: { compact?: boolean }) {
  const coverage = getUniverseCoverage();
  const latest = getLatestUniverseResolution();
  const history = getPointInTimeSurvivorship();
  const indexSize = coverage?.index_size ?? 200;
  const currentMembers = latest?.matched_count ?? coverage?.modeling_universe_size;
  const currentUnresolved = latest?.unresolved_count ?? coverage?.excluded_count;
  const historyWith = history?.historical_months_with_snapshot_coverage;
  const historyWithout = history?.historical_months_without_snapshot_coverage;
  const historicalIdentifiers = coverage?.historical_price_history_symbol_count;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2" aria-label="Universe coverage">
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-600">
          {currentMembers == null ? "Current membership unavailable" : `${currentMembers} of ${indexSize} current members resolved`}
        </span>
      </div>
    );
  }

  return (
    <Card title="Current and historical universe coverage" subtitle="Membership, historical price coverage, and daily refresh rows are reported separately.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Latest Nifty 200 members resolved"
          value={currentMembers == null ? "Unavailable" : `${currentMembers} / ${indexSize}`}
          subvalue={latest?.snapshot_date ? `Snapshot ${latest.snapshot_date}` : coverage?.current_membership_snapshot_date ? `Snapshot ${coverage.current_membership_snapshot_date}` : "Membership snapshot unavailable"}
          color={currentUnresolved === 0 ? "green" : "amber"}
        />
        <StatCard
          label="Unresolved latest members"
          value={currentUnresolved == null ? "Unavailable" : String(currentUnresolved)}
          subvalue={latest?.unresolved_symbols?.length ? latest.unresolved_symbols.join(", ") : "No unresolved names in latest snapshot"}
          color={currentUnresolved === 0 ? "green" : "amber"}
        />
        <StatCard
          label="Historical months with snapshots"
          value={historyWith == null ? "Unavailable" : String(historyWith)}
          subvalue={historyWithout == null ? "Snapshot gaps unavailable" : `${historyWithout} months without a snapshot`}
          color={historyWithout === 0 ? "green" : "amber"}
        />
        <StatCard
          label="Historical price identifiers"
          value={historicalIdentifiers == null ? "Unavailable" : String(historicalIdentifiers)}
          subvalue="Distinct identifiers across the archived price history; not the current index size"
          color="slate"
        />
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        {coverage?.note || "Model candidates are limited to the exact membership set resolved for each signal month. Missing membership is not filled from today's constituent list."}
      </p>
    </Card>
  );
}
