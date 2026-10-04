import { Badge, Card, ProgressBar, StatCard, Table } from "@/components/UI";
import { formatNumber, formatPercent, getEnsembleOptimizer } from "@/lib/data";
import { GitBranch, Medal, SlidersHorizontal, Target } from "lucide-react";

const MODEL_LABELS: Record<string, string> = {
  gmm_regime: "GMM regime",
  hmm_persistence: "HMM-style persistence",
  jump_risk: "Jump-risk detector",
  bayesian_recent: "Bayesian recent reliability",
};

const MODEL_COLORS: Record<string, string> = {
  gmm_regime: "#2563eb",
  hmm_persistence: "#059669",
  jump_risk: "#d97706",
  bayesian_recent: "#7c3aed",
};

function readableModel(key: string) {
  return MODEL_LABELS[key] || key.replaceAll("_", " ");
}

export function OptimizerPage() {
  const report = getEnsembleOptimizer();

  if (!report) {
    return (
      <Card title="Ensemble Optimizer" subtitle="No optimizer artifact is available yet">
        <p className="text-sm leading-6 text-slate-600">
          Run the research pipeline once to publish <span className="font-mono">ensemble_optimizer.json</span>.
          Until then, the allocation page will show the existing allocation artifacts.
        </p>
      </Card>
    );
  }

  const weights = Object.entries(report.selected_model_weights || {});
  const params = report.selected_parameters;
  const metrics = report.selected_metrics || {};
  const winner = report.winner_baseline || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Ensemble Optimizer</h2>
        <p className="mt-1 text-sm text-slate-500">
          Bayesian-tuned weighted ensemble for choosing allocation parameters and model-family weights.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Selection"
          value="Weighted"
          subvalue="Not winner-take-all"
          icon={<GitBranch className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="Candidates Tested"
          value={formatNumber(report.candidate_count, 0)}
          subvalue="Bayesian surrogate search"
          icon={<SlidersHorizontal className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          label="Walk-forward Sharpe"
          value={formatNumber(Number(metrics.sharpe ?? 0), 2)}
          subvalue={`${formatNumber(Number(metrics.sample_months ?? 0), 0)} tested months`}
          icon={<Target className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          label="Best Single Model"
          value={readableModel(String(winner.model || "—"))}
          subvalue="Diagnostic baseline only"
          icon={<Medal className="h-5 w-5" />}
          color="amber"
        />
      </div>

      <Card
        title="Selected Model-family Weights"
        subtitle="The optimizer blends model families instead of discarding all except one"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {weights.map(([key, value]) => (
            <div key={key} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{readableModel(key)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {report.component_definitions?.[key] || "Ensemble component"}
                  </p>
                </div>
                <Badge color="blue">{formatPercent(value)}</Badge>
              </div>
              <ProgressBar value={value} color={MODEL_COLORS[key] || "#2563eb"} height={8} />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Chosen Optimizer Settings" subtitle="These parameters feed the allocation engine">
          <Table
            columns={[
              { key: "name", label: "Parameter" },
              { key: "value", label: "Selected", align: "right" },
              { key: "meaning", label: "Why it matters" },
            ]}
            data={[
              { name: "Expected-return window", value: `${params.er_window} months`, meaning: "How much trailing history is used before a month is traded." },
              { name: "Half-life", value: `${params.er_halflife} months`, meaning: "How quickly older months lose influence." },
              { name: "Turnover penalty", value: formatNumber(params.turnover_penalty, 3), meaning: "Discourages unnecessary monthly reshuffling." },
              { name: "Concentration penalty", value: formatNumber(params.concentration_penalty, 3), meaning: "Discourages overloading one correlated factor." },
              { name: "News multiplier", value: formatNumber(params.news_multiplier, 2), meaning: "Controls how strongly market/economy news stress changes the forecast." },
            ]}
            maxHeight="320px"
          />
        </Card>

        <Card title="Objective Function" subtitle="How the optimizer decides what is better">
          <div className="space-y-4 text-sm leading-6 text-slate-600">
            <p>{report.objective.score}</p>
            <p>{report.objective.why_weighted_ensemble}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Max drawdown</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatPercent(Number(metrics.max_drawdown ?? 0))}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hit rate</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatPercent(Number(metrics.hit_rate ?? 0))}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg turnover</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatPercent(Number(metrics.avg_turnover ?? 0))}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cum. return</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatPercent(Number(metrics.cumulative_return ?? 0))}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Leaderboard" subtitle="Top evaluated ensemble candidates">
        <Table
          columns={[
            { key: "rank", label: "Rank", align: "right" },
            { key: "score", label: "Score", align: "right" },
            { key: "sharpe", label: "Sharpe", align: "right" },
            { key: "drawdown", label: "Max DD", align: "right" },
            { key: "hit", label: "Hit Rate", align: "right" },
            { key: "weights", label: "Model weights" },
          ]}
          data={(report.leaderboard || []).map((row) => ({
            rank: row.rank,
            score: formatNumber(row.score, 3),
            sharpe: formatNumber(row.sharpe, 2),
            drawdown: formatPercent(row.max_drawdown),
            hit: formatPercent(row.hit_rate),
            weights: Object.entries(row.model_weights)
              .map(([key, value]) => `${readableModel(key)} ${formatPercent(value, 0)}`)
              .join(", "),
          }))}
          maxHeight="360px"
        />
      </Card>
    </div>
  );
}
