import { useState, type ReactNode } from "react";
import { Card } from "@/components/UI";
import { RegimePage } from "./RegimePage";
import { FactorPage } from "./FactorPage";
import { AllocationPage } from "./AllocationPage";
import { NewsPage } from "./NewsPage";
import { BacktestPage } from "./BacktestPage";
import { ModelIntegrityPage } from "./ModelIntegrityPage";
import { ModelReportPage } from "./ModelReportPage";
import { SignalsPage } from "./SignalsPage";
import { SimulationPage } from "./SimulationPage";
import { FlaskConical, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/UI";
import { getNifty500DataAudit } from "@/lib/data";

type ResearchSection =
  | "overview"
  | "regime"
  | "factors"
  | "allocation"
  | "news"
  | "backtest"
  | "integrity"
  | "model-report"
  | "universe-audit"
  | "signals"
  | "simulation";

const SECTIONS: { id: ResearchSection; label: string; description: string }[] = [
  { id: "overview", label: "Overview", description: "Summary of all research sections" },
  { id: "regime", label: "Regime Analysis", description: "GMM clusters, walk-forward probabilities, transition matrix, ANOVA separation" },
  { id: "factors", label: "Factor Analysis", description: "Factor scores, baskets, returns, diagnostics, redundancy" },
  { id: "allocation", label: "Allocation Diagnostics", description: "Factor weights, optimizer inputs, decision gate, constraints" },
  { id: "news", label: "News & Narrative", description: "RSS ingestion, entity tagging, relevance-weighted sentiment, stress scores" },
  { id: "backtest", label: "Backtest Diagnostics", description: "Stock-level backtest, cost ladder, confidence intervals, rolling windows" },
  { id: "integrity", label: "Model Integrity", description: "Experiment manifest, run fingerprint, assumptions, caveats, determinism" },
  { id: "model-report", label: "Model Report", description: "Universe coverage, excluded symbols, data inventory" },
  { id: "universe-audit", label: "Universe Audit", description: "Nifty 500 expansion readiness, missing data, and next steps" },
  { id: "signals", label: "Signal History", description: "Stock-level signal events, weight changes, factor sources" },
  { id: "simulation", label: "Simulation", description: "Historical simulation and replay" },
];

const SECTION_GROUPS: { label: string; icon: ReactNode; ids: ResearchSection[] }[] = [
  { label: "Current model", icon: <SlidersHorizontal className="h-4 w-4" />, ids: ["regime", "factors", "allocation", "news", "signals"] },
  { label: "Validation", icon: <ShieldCheck className="h-4 w-4" />, ids: ["backtest", "simulation"] },
  { label: "Research & governance", icon: <FlaskConical className="h-4 w-4" />, ids: ["integrity", "model-report", "universe-audit"] },
];

export function AdvancedResearchPage() {
  const [section, setSection] = useState<ResearchSection>("overview");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Research</h2>
        <p className="mt-1 text-sm text-slate-500">
          Technical details for users who want to understand the model internals.
        </p>
      </div>

      <section aria-label="Research areas" className="grid gap-4 xl:grid-cols-3">
        {SECTION_GROUPS.map((group) => (
          <div key={group.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.icon}{group.label}</h3>
            <div className="flex flex-wrap gap-2">
              {group.ids.map((id) => {
                const item = SECTIONS.find((candidate) => candidate.id === id)!;
                return <button key={id} onClick={() => setSection(id)} aria-pressed={section === id} title={item.description}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${section === id ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{item.label}</button>;
              })}
            </div>
          </div>
        ))}
      </section>
      <button onClick={() => setSection("overview")} aria-pressed={section === "overview"}
        className={`rounded-lg px-3 py-2 text-xs font-semibold ${section === "overview" ? "bg-slate-800 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Research overview</button>

      {section === "backtest" && <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Backtest outputs are historical research results. They are not evidence of a currently published or validated model run.</div>}
      {section === "simulation" && <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Simulation replays the available historical snapshots; review Model Integrity and the stated data limitations before interpreting results.</div>}

      {/* ── SECTION CONTENT ──────────────────────────────────────────────── */}
      {section === "overview" && (
        <div className="space-y-4">
          <Card title="Research Sections" subtitle="Choose a section to explore the technical details">
            <div className="grid gap-3 sm:grid-cols-2">
              {SECTIONS.filter((s) => s.id !== "overview").map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{s.description}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card title="How to Read This Page" subtitle="Progressive disclosure of technical details">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>
                This page contains the full technical detail of the model. The main user pages (Home, My Plan, My Portfolio) show only what you need to make decisions. This page is for when you want to understand <span className="font-semibold">why</span> the model makes its recommendations.
              </p>
              <p>
                Each section preserves the full research implementation — GMM regime detection, factor scoring, portfolio construction, backtesting, and model integrity. Nothing is hidden; it is simply organized behind progressive disclosure.
              </p>
            </div>
          </Card>
        </div>
      )}

      {section === "regime" && <RegimePage />}
      {section === "factors" && <FactorPage />}
      {section === "allocation" && <AllocationPage />}
      {section === "news" && <NewsPage />}
      {section === "backtest" && <BacktestPage />}
      {section === "integrity" && <ModelIntegrityPage />}
      {section === "model-report" && <ModelReportPage />}
      {section === "universe-audit" && <UniverseAudit />}
      {section === "signals" && <SignalsPage />}
      {section === "simulation" && <SimulationPage />}
    </div>
  );
}

function UniverseAudit() {
  const audit = getNifty500DataAudit();
  if (!audit) {
    return (
      <Card title="Universe Audit" subtitle="Expansion readiness">
        <p className="text-sm leading-6 text-slate-600">No Nifty 500 audit report has been published yet.</p>
      </Card>
    );
  }

  const summary = audit.summary;
  const coveragePct = summary.officialConstituentRows > 0
    ? Math.round((summary.monthlyPriceCoverage / summary.officialConstituentRows) * 100)
    : 0;
  const usablePct = summary.officialConstituentRows > 0
    ? Math.round((summary.usableOrStrongPriceCoverage / summary.officialConstituentRows) * 100)
    : 0;
  const topSectors = Object.entries(audit.sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <Card
        title="Nifty 500 Expansion Audit"
        subtitle={`Generated ${new Date(summary.auditDate).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
        action={<Badge color="amber">Discovery only</Badge>}
      >
        <div className="grid gap-3 md:grid-cols-4">
          <AuditMetric label="Constituents" value={`${summary.officialConstituentRows}`} detail="Current EQ rows" />
          <AuditMetric label="Monthly prices" value={`${summary.monthlyPriceCoverage}/${summary.officialConstituentRows}`} detail={`${coveragePct}% coverage`} />
          <AuditMetric label="Usable prices" value={`${summary.usableOrStrongPriceCoverage}`} detail={`${usablePct}% usable/strong`} />
          <AuditMetric label="Fundamentals" value={`${summary.fundamentalsRowsAvailable}`} detail="Current rows available" />
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-950">Do not promote to live recommendation universe yet.</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">{summary.readiness.reason}</p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card title="Readiness" subtitle="What can be used now">
          <div className="space-y-3">
            <ReadinessRow label="Current discovery/watchlist" value={summary.readiness.currentDiscovery} />
            <ReadinessRow label="Model backtest" value={summary.readiness.modelBacktest} />
            <ReadinessRow label="Point-in-time membership" value={summary.historicalPointInTimeUniverse.currentStatus} />
          </div>
        </Card>

        <Card title="Sector Breadth" subtitle="Top industries in current Nifty 500 file">
          <div className="grid gap-2 sm:grid-cols-2">
            {topSectors.map(([sector, count]) => (
              <div key={sector} className="rounded-lg bg-slate-50 p-3">
                <p className="truncate text-xs font-semibold text-slate-500">{sector}</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{count}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Next Steps" subtitle="Required before Nifty 500 can become the recommendation universe">
        <div className="grid gap-3 md:grid-cols-2">
          {summary.nextSteps.map((step, index) => (
            <div key={step} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">Step {index + 1}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AuditMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function ReadinessRow({ label, value }: { label: string; value: string }) {
  const normalized = value.toLowerCase();
  const color = normalized.includes("blocked") || normalized.includes("not available")
    ? "red"
    : normalized.includes("partial")
      ? "amber"
      : "green";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <Badge color={color}>{value}</Badge>
    </div>
  );
}
