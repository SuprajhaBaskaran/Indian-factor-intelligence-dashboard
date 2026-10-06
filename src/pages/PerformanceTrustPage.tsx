const evaluationMetrics = [
  { metric: "CAGR", value: "≈20.22%" },
  { metric: "Annualized volatility", value: "≈15.95%" },
  { metric: "Sharpe Ratio", value: "≈1.07 with 6.5% RF assumption" },
  { metric: "Sortino Ratio", value: "≈2.08" },
  { metric: "Newey-West t-statistic", value: "≈4.46" },
  { metric: "Average turnover", value: "≈25.31%" },
  { metric: "Directional forecast hit rate", value: "≈65.85%" },
  { metric: "Information coefficient", value: "≈+0.081" },
];

export function PerformanceTrustPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Trust</h2>
        <p className="mt-1 text-sm text-slate-500">Evaluation Metrics &amp; Validation</p>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                <th className="w-1/2 border-r border-slate-300 px-6 py-5 text-base font-bold text-slate-950">
                  Metric
                </th>
                <th className="px-6 py-5 text-base font-bold text-slate-950">
                  Latest reported Value
                </th>
              </tr>
            </thead>
            <tbody>
              {evaluationMetrics.map((row) => (
                <tr key={row.metric} className="border-b border-slate-200 last:border-b-0">
                  <td className="border-r border-slate-300 px-6 py-5 text-base text-slate-950">
                    {row.metric}
                  </td>
                  <td className="px-6 py-5 text-base font-medium text-slate-950">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
