import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim().length > 0)) rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((key, index) => [key.trim(), (cells[index] || "").trim()])));
}

const normalizeSymbol = (symbol) => String(symbol || "").trim().toUpperCase().replace(/[\s-]+/g, "");
const normalizeIsin = (isin) => String(isin || "").trim().toUpperCase().replace(/\s+/g, "");

const nifty500Path = path.join(root, "data_input", "ind_nifty500list.csv");
if (!fs.existsSync(nifty500Path)) {
  throw new Error("Missing data_input/ind_nifty500list.csv. Download the official Nifty 500 constituent CSV first.");
}

const nifty500Rows = parseCsv(fs.readFileSync(nifty500Path, "utf8"))
  .map((row) => ({
    companyName: row["Company Name"],
    industry: row.Industry,
    symbol: normalizeSymbol(row.Symbol),
    rawSymbol: row.Symbol,
    series: row.Series,
    isin: normalizeIsin(row["ISIN Code"]),
  }))
  .filter((row) => row.symbol && row.series === "EQ");

const stockPrices = readJson("public/data/stock_prices.json");
const stocks = readJson("public/data/stocks.json");
const targets = readJson("public/data/portfolio_targets.json");
const factorBaskets = readJson("public/data/factor_baskets.json");
const dataInventory = readJson("public/data/data_inventory.json");
const universeCoverage = readJson("public/data/universe_coverage.json");

const priceBySymbol = new Map();
for (const row of stockPrices) {
  const symbol = normalizeSymbol(row.symbol);
  if (!symbol) continue;
  const stats = priceBySymbol.get(symbol) || {
    months: new Set(),
    firstMonth: row.month,
    lastMonth: row.month,
    latestClose: 0,
  };
  stats.months.add(row.month);
  if (row.month < stats.firstMonth) stats.firstMonth = row.month;
  if (row.month > stats.lastMonth) {
    stats.lastMonth = row.month;
    stats.latestClose = Number(row.adjusted_close || row.close || 0);
  } else if (row.month === stats.lastMonth) {
    stats.latestClose = Number(row.adjusted_close || row.close || stats.latestClose || 0);
  }
  priceBySymbol.set(symbol, stats);
}

const stockMetaSymbols = new Set(stocks.map((row) => normalizeSymbol(row.symbol)));
const targetSymbols = new Set(targets.map((row) => normalizeSymbol(row.symbol)));
const basketSymbols = new Set(factorBaskets.map((row) => normalizeSymbol(row.symbol)));
const currentModelSymbols = new Set(
  targets
    .filter((row) => row.month === universeCoverage.current_model_month)
    .map((row) => normalizeSymbol(row.symbol))
);

const fundamentalsInventory = dataInventory.find((item) => item.file_name === "yahoo_fundamentals_latest.csv");
const currentNifty200Inventory = dataInventory.find((item) => item.file_name === "ind_nifty200list.csv");
const currentNifty200Size = Number(currentNifty200Inventory?.rows || universeCoverage.index_size || 200);
const currentNifty200Symbols = new Set(currentModelSymbols);

const rows = nifty500Rows.map((row) => {
  const symbolPrice = priceBySymbol.get(row.symbol);
  const isinPrice = priceBySymbol.get(row.isin);
  const price = symbolPrice || isinPrice;
  return {
    ...row,
    inCurrentSelectedModelBasket: currentNifty200Symbols.has(row.symbol),
    hasStockMetadata: stockMetaSymbols.has(row.symbol),
    hasAnyModelTarget: targetSymbols.has(row.symbol),
    hasFactorBasketHistory: basketSymbols.has(row.symbol),
    hasMonthlyPrice: Boolean(price),
    priceIdentifier: symbolPrice ? "symbol" : isinPrice ? "isin" : null,
    priceMonthCount: price ? price.months.size : 0,
    firstPriceMonth: price?.firstMonth || null,
    lastPriceMonth: price?.lastMonth || null,
    latestClose: price?.latestClose || null,
    priceCoverageBand: !price
      ? "missing"
      : price.months.size >= 100
        ? "strong"
        : price.months.size >= 36
          ? "usable"
          : "thin",
  };
});

const count = (predicate) => rows.filter(predicate).length;
const missing = (predicate, limit = 80) => rows.filter(predicate).map((row) => row.symbol).slice(0, limit);

const sectorCounts = rows.reduce((acc, row) => {
  acc[row.industry] = (acc[row.industry] || 0) + 1;
  return acc;
}, {});

const summary = {
  candidateIndex: "Nifty 500",
  auditDate: new Date().toISOString(),
  sourceFile: "data_input/ind_nifty500list.csv",
  officialConstituentRows: nifty500Rows.length,
  currentSystemIndex: universeCoverage.index_name || "Nifty 200",
  currentSystemIndexSize: currentNifty200Size,
  currentModelMonth: universeCoverage.current_model_month,
  currentSelectedModelBasketSymbols: currentNifty200Symbols.size,
  overlapWithCurrentSelectedModelBasket: count((row) => row.inCurrentSelectedModelBasket),
  incrementalSymbolsVsCurrentSelectedModelBasket: count((row) => !row.inCurrentSelectedModelBasket),
  stockMetadataCoverage: count((row) => row.hasStockMetadata),
  monthlyPriceCoverage: count((row) => row.hasMonthlyPrice),
  symbolKeyedMonthlyPriceCoverage: count((row) => row.priceIdentifier === "symbol"),
  isinKeyedMonthlyPriceCoverage: count((row) => row.priceIdentifier === "isin"),
  strongPriceCoverage: count((row) => row.priceCoverageBand === "strong"),
  usableOrStrongPriceCoverage: count((row) => row.priceCoverageBand === "usable" || row.priceCoverageBand === "strong"),
  factorBasketHistoryCoverage: count((row) => row.hasFactorBasketHistory),
  modelTargetHistoryCoverage: count((row) => row.hasAnyModelTarget),
  fundamentalsRowsAvailable: Number(fundamentalsInventory?.rows || 0),
  historicalPointInTimeUniverse: {
    currentStatus: "not available for Nifty 500",
    existingPointInTimeUniverse: universeCoverage.index_name || "Nifty 200",
    warning: "Do not backtest Nifty 500 with today's constituents until historical Nifty 500 membership snapshots are collected.",
  },
  readiness: {
    currentDiscovery: count((row) => row.hasMonthlyPrice) >= 450 ? "ready" : "partial",
    modelBacktest: "blocked",
    reason: "Current Nifty 500 constituents can be audited now, but unbiased model expansion needs historical Nifty 500 membership plus fundamentals/factor coverage for the incremental symbols.",
  },
  nextSteps: [
    "Collect historical Nifty 500 membership snapshots, not only today's constituent CSV.",
    "Backfill monthly prices for missing incremental symbols.",
    "Backfill fundamentals/sector metadata for all current Nifty 500 symbols.",
    "Only then enable Nifty 500 as a model universe; until then it can be a discovery/watchlist universe.",
  ],
};

const report = {
  summary,
  sectorCounts,
  missingSamples: {
    noMonthlyPrice: missing((row) => !row.hasMonthlyPrice),
    noStockMetadata: missing((row) => !row.hasStockMetadata),
    noFactorBasketHistory: missing((row) => !row.hasFactorBasketHistory),
    noModelTargetHistory: missing((row) => !row.hasAnyModelTarget),
    incrementalSymbolsNoMonthlyPrice: missing((row) => !row.inCurrentSelectedModelBasket && !row.hasMonthlyPrice),
  },
  rows,
};

const outPath = path.join(root, "public", "data", "nifty500_data_audit.json");
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));
