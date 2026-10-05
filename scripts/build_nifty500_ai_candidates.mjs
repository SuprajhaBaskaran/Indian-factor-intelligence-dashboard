import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"));
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(DATA, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}

function cleanSymbol(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/-(EQ|BE|BZ|SM)$/i, "")
    .replace(/-/g, "");
}

function pct(current, previous) {
  if (!current || !previous || previous <= 0) return null;
  return current / previous - 1;
}

function mean(values) {
  const xs = values.filter((value) => Number.isFinite(value));
  return xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : null;
}

function stdev(values) {
  const avg = mean(values);
  if (avg == null) return null;
  const xs = values.filter((value) => Number.isFinite(value));
  if (xs.length < 2) return null;
  return Math.sqrt(xs.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (xs.length - 1));
}

function maxDrawdown(values) {
  let peak = -Infinity;
  let worst = 0;
  for (const value of values) {
    if (!Number.isFinite(value) || value <= 0) continue;
    peak = Math.max(peak, value);
    if (peak > 0) worst = Math.min(worst, value / peak - 1);
  }
  return worst;
}

function zscore(rows, key) {
  const values = rows.map((row) => row[key]).filter((value) => Number.isFinite(value));
  const avg = mean(values) ?? 0;
  const sd = stdev(values) || 1;
  for (const row of rows) row[`${key}Z`] = Number.isFinite(row[key]) ? (row[key] - avg) / sd : 0;
}

const prices = readJson("stock_prices");
const audit = readJson("nifty500_data_audit");
const targets = readJson("portfolio_targets");

const latestModelMonth = [...new Set(targets.map((row) => String(row.month).slice(0, 7)))].sort().at(-1);
const latestTargets = targets
  .filter((row) => String(row.month).slice(0, 7) === latestModelMonth)
  .sort((a, b) => Number(b.target_weight || 0) - Number(a.target_weight || 0));

const bySymbol = new Map();
for (const row of prices) {
  const symbol = cleanSymbol(row.symbol);
  const close = Number(row.adjusted_close || row.close || 0);
  if (!symbol || !Number.isFinite(close) || close <= 0) continue;
  if (!bySymbol.has(symbol)) bySymbol.set(symbol, []);
  bySymbol.get(symbol).push({ month: String(row.month).slice(0, 7), close });
}
for (const rows of bySymbol.values()) {
  rows.sort((a, b) => a.month.localeCompare(b.month));
  const dedup = new Map();
  rows.forEach((row) => dedup.set(row.month, row));
  rows.splice(0, rows.length, ...Array.from(dedup.values()));
}

const candidates = [];
for (const auditRow of audit.rows || []) {
  const symbol = cleanSymbol(auditRow.symbol);
  const series = bySymbol.get(symbol) || [];
  if (series.length < 13) continue;
  const closes = series.map((row) => row.close);
  const latest = closes.at(-1);
  const returns = closes.slice(1).map((close, index) => pct(close, closes[index])).filter((value) => value != null);
  const ret1m = pct(latest, closes.at(-2));
  const ret3m = pct(latest, closes.at(-4));
  const ret6m = pct(latest, closes.at(-7));
  const ret12m = pct(latest, closes.at(-13));
  const vol12m = stdev(returns.slice(-12));
  const drawdown12m = maxDrawdown(closes.slice(-13));
  const sampleWeight = Math.min(1, Math.max(0.25, series.length / 36));

  candidates.push({
    symbol,
    name: auditRow.companyName,
    sector: auditRow.industry,
    latestClose: latest,
    latestMonth: series.at(-1)?.month ?? null,
    priceMonths: series.length,
    ret1m,
    ret3m,
    ret6m,
    ret12m,
    shrunkRet3m: (ret3m ?? 0) * sampleWeight,
    shrunkRet6m: (ret6m ?? 0) * sampleWeight,
    shrunkRet12m: (ret12m ?? 0) * sampleWeight,
    vol12m,
    drawdown12m,
    confidence: Number(Math.min(1, sampleWeight * (auditRow.priceCoverageBand === "strong" ? 1 : 0.85)).toFixed(3)),
  });
}

["shrunkRet3m", "shrunkRet6m", "shrunkRet12m", "vol12m", "drawdown12m"].forEach((key) => zscore(candidates, key));

for (const row of candidates) {
  row.score = Number((
    0.15 * row.shrunkRet3mZ +
    0.25 * row.shrunkRet6mZ +
    0.35 * row.shrunkRet12mZ +
    0.15 * -row.vol12mZ +
    0.10 * -row.drawdown12mZ
  ).toFixed(6));
}

candidates.sort((a, b) => b.score - a.score);
candidates.forEach((row, index) => {
  row.rank = index + 1;
  row.recommendation =
    row.rank <= 30 ? "AI candidate" :
    row.rank <= 100 ? "Watchlist" :
    row.score >= 0 ? "Neutral" :
    "Avoid for now";
  row.reason =
    row.recommendation === "AI candidate"
      ? "Ranked highly by the Nifty 500 price-risk ensemble using real monthly closes."
      : row.recommendation === "Watchlist"
        ? "Positive enough to monitor, but not in the top candidate sleeve."
        : row.recommendation === "Neutral"
          ? "Mixed price-risk evidence."
          : "Weak relative price-risk evidence in the current Nifty 500 scan.";
});

const payload = {
  generatedAt: new Date().toISOString(),
  universes: {
    nifty200: {
      label: "Nifty 200 validated model",
      status: "validated_portfolio_recommendation",
      modelMonth: latestModelMonth,
      count: latestTargets.length,
      method: "Value, Quality, Momentum, Low Volatility factor sleeves with regime weights and constrained portfolio construction.",
      rows: latestTargets.map((row, index) => ({
        rank: index + 1,
        symbol: row.symbol,
        targetWeight: row.target_weight,
        sector: row.sector,
        factors: row.factor_sources,
        score: row.combined_score,
        recommendation: "Model basket",
      })),
    },
    nifty500: {
      label: "Nifty 500 AI candidates",
      status: "price_risk_candidate_recommendation",
      modelMonth: candidates[0]?.latestMonth ?? null,
      count: candidates.length,
      topCandidateCount: candidates.filter((row) => row.recommendation === "AI candidate").length,
      method: "Real monthly NSE prices. Weighted ensemble: 12m momentum 35%, 6m momentum 25%, 3m momentum 15%, low volatility 15%, drawdown control 10%. Momentum is Bayesian-shrunk for shorter histories.",
      validationNote: "This is a Nifty 500 stock-ranking recommendation layer. It is not yet the fully backtested portfolio model until point-in-time Nifty 500 membership and fundamentals are collected.",
      rows: candidates,
    },
  },
};

writeJson("recommendation_universes", payload);
console.log(`Wrote recommendation_universes.json: ${latestTargets.length} Nifty 200 targets, ${candidates.length} Nifty 500 candidates.`);
