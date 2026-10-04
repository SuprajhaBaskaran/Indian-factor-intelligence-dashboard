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
import { OptimizerPage } from "./OptimizerPage";
import { FlaskConical, ShieldCheck, SlidersHorizontal } from "lucide-react";

type ResearchSection =
  | "overview"
  | "regime"
  | "factors"
  | "allocation"
  | "optimizer"
  | "news"
  | "backtest"
  | "integrity"
  | "model-report"
  | "signals"
  | "simulation";

const SECTIONS: { id: ResearchSection; label: string; description: string }[] = [
  { id: "overview", label: "Overview", description: "Summary of all research sections" },
  { id: "regime", label: "Regime Analysis", description: "GMM clusters, walk-forward probabilities, transition matrix, ANOVA separation" },
  { id: "factors", label: "Factor Analysis", description: "Factor scores, baskets, returns, diagnostics, redundancy" },
  { id: "allocation", label: "Allocation Diagnostics", description: "Factor weights, optimizer inputs, decision gate, constraints" },
  { id: "optimizer", label: "Ensemble Optimizer", description: "Bayesian-tuned weighted ensemble, winner baseline, selected parameters" },
  { id: "news", label: "News & Narrative", description: "RSS ingestion, entity tagging, relevance-weighted sentiment, stress scores" },
  { id: "backtest", label: "Backtest Diagnostics", description: "Stock-level backtest, cost ladder, confidence intervals, rolling windows" },
  { id: "integrity", label: "Model Integrity", description: "Experiment manifest, run fingerprint, assumptions, caveats, determinism" },
  { id: "model-report", label: "Model Report", description: "Universe coverage, excluded symbols, data inventory" },
  { id: "signals", label: "Signal History", description: "Stock-level signal events, weight changes, factor sources" },
  { id: "simulation", label: "Simulation", description: "Historical simulation and replay" },
];

const SECTION_GROUPS: { label: string; icon: ReactNode; ids: ResearchSection[] }[] = [
  { label: "Current model", icon: <SlidersHorizontal className="h-4 w-4" />, ids: ["regime", "factors", "optimizer", "allocation", "news", "signals"] },
  { label: "Validation", icon: <ShieldCheck className="h-4 w-4" />, ids: ["backtest", "simulation"] },
  { label: "Research & governance", icon: <FlaskConical className="h-4 w-4" />, ids: ["integrity", "model-report"] },
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
      {section === "optimizer" && <OptimizerPage />}
      {section === "allocation" && <AllocationPage />}
      {section === "news" && <NewsPage />}
      {section === "backtest" && <BacktestPage />}
      {section === "integrity" && <ModelIntegrityPage />}
      {section === "model-report" && <ModelReportPage />}
      {section === "signals" && <SignalsPage />}
      {section === "simulation" && <SimulationPage />}
    </div>
  );
}
