import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, PencilLine, Plus, Search, ShieldCheck, Trash2, Upload, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Badge, Card, SignalBadge, Table } from "@/components/UI";
import { TermTooltip } from "@/components/TermTooltip";
import { markFreshMoneyIncluded, readUserExperience } from "@/lib/userExperience";
import {
  assessDailyRisk,
  buildCashDeploymentPlan,
  buildDeterministicExplanation,
  buildTradePlan,
  downloadTextFile,
  formatCurrency,
  getLatestPrice,
  parseHoldingsCsv,
  parseHoldingsText,
  tradePlanToCsv,
  type UserHolding,
} from "@/lib/product";
import { useUserData, type UserHolding as PersistedHolding } from "@/lib/userData";
import { getDecisionSnapshot } from "@/lib/product";
import { getNifty500DataAudit, getPortfolioTargets, getRecommendationUniverses, getStockSymbols, getStocks } from "@/lib/data";

type TradeMode = "fresh" | "rebalance";
type HoldingEntryMode = "import" | "manual" | "paste";
type HoldingSymbolOption = { symbol: string; name: string; sector: string };

function getHoldingInputIssues(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .flatMap(({ line, lineNumber }) => {
      const [symbolRaw, qtyRaw] = line.split(/[,\t ]+/);
      if (!symbolRaw && !qtyRaw) return [];
      const issues: string[] = [];
      if (!symbolRaw) issues.push(`Holding ${lineNumber}: add a stock symbol or remove this row.`);
      if (!qtyRaw || !Number.isFinite(Number(qtyRaw))) {
        issues.push(`Holding ${lineNumber}: enter how many shares you own.`);
      }
      return issues;
    });
}

function holdingsToText(rows: UserHolding[]): string {
  return rows.map((row) => `${row.symbol},${row.quantity}${row.avgPrice ? `,${row.avgPrice}` : ""}`).join("\n");
}

function createBlankHoldingRows(rows: UserHolding[]): UserHolding[] {
  return rows.length ? rows : [{ symbol: "", quantity: 0, avgPrice: undefined }];
}

function parseHoldingEditorRows(text: string): UserHolding[] {
  const lines = text.split(/\r?\n/);
  const rows = lines
    .map((line) => {
      const touched = line.trim().length > 0;
      const [symbolRaw = "", qtyRaw = "", avgRaw = ""] = line.trim().split(/[,\t ]+/);
      return {
        symbol: symbolRaw.trim().toUpperCase(),
        quantity: qtyRaw ? Number(qtyRaw) || 0 : 0,
        avgPrice: avgRaw ? Number(avgRaw) || undefined : undefined,
        touched,
      };
    })
    .filter((row) => row.touched || row.symbol || row.quantity || row.avgPrice)
    .map((row) => ({
      symbol: row.symbol,
      quantity: row.quantity,
      avgPrice: row.avgPrice,
    }));
  return createBlankHoldingRows(rows);
}

function formatPriceRange(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "—";
  return `${formatCurrency(price * 0.985)} - ${formatCurrency(price * 1.015)}`;
}

function formatShareCount(quantity: number): string {
  return `${quantity} share${quantity === 1 ? "" : "s"}`;
}

function getFreshPlanTone(action: string): { title: string; detail: string; color: "green" | "amber" | "slate" } {
  if (action === "Deploy") {
    return {
      title: "Ready to deploy carefully",
      detail: "The monthly model and daily risk check allow fresh buys. Use the buy zone, not a fixed price.",
      color: "green",
    };
  }
  if (action === "Stagger") {
    return {
      title: "Buy in smaller steps",
      detail: "Risk is a little elevated, so the assistant suggests deploying only part of the amount now.",
      color: "amber",
    };
  }
  return {
    title: "Wait for a cleaner setup",
    detail: "The model or risk overlay is not asking you to add fresh exposure right now.",
    color: "slate",
  };
}

function HoldingSymbolInput({
  value,
  options,
  placeholder = "Search stock",
  onChange,
  onSelect,
}: {
  value: string;
  options: HoldingSymbolOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  onSelect: (symbol: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const query = value.trim().toUpperCase();
  const matches = useMemo(() => {
    const ranked = options
      .filter((option) => {
        if (!query) return true;
        return `${option.symbol} ${option.name} ${option.sector}`.toUpperCase().includes(query);
      })
      .sort((a, b) => {
        if (!query) return a.symbol.localeCompare(b.symbol);
        const aStarts = a.symbol.startsWith(query) ? 0 : 1;
        const bStarts = b.symbol.startsWith(query) ? 0 : 1;
        return aStarts - bStarts || a.symbol.localeCompare(b.symbol);
      });
    return ranked.slice(0, 80);
  }, [options, query]);

  const choose = (symbol: string) => {
    onSelect(symbol);
    setOpen(false);
    setHighlighted(0);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value.toUpperCase());
          setOpen(true);
          setHighlighted(0);
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
            setOpen(true);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlighted((current) => Math.min(current + 1, Math.max(0, matches.length - 1)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && matches[highlighted]) {
            event.preventDefault();
            choose(matches[highlighted].symbol);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-2 text-sm font-semibold uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          {matches.length > 0 ? matches.map((option, index) => (
            <button
              key={option.symbol}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option.symbol);
              }}
              className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-xs ${
                index === highlighted ? "bg-blue-50" : "hover:bg-slate-50"
              }`}
            >
              <span className="min-w-0">
                <span className="block font-bold text-slate-950">{option.symbol}</span>
                <span className="block truncate text-slate-500">{option.name}</span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {option.sector || "Stock"}
              </span>
            </button>
          )) : (
            <div className="px-3 py-3 text-xs text-slate-500">No matching stock found</div>
          )}
        </div>
      )}
    </div>
  );
}

export function TradePlanPage() {
  const userData = useUserData();
  const { user } = useAuth();
  const experience = user ? readUserExperience(user.id) : null;
  const hasExistingInvestments = Boolean(experience?.hasInvestments);
  const pendingFreshMoney = experience?.freshMoneyPending ? experience.freshMoneyAmount : 0;
  const [mode, setMode] = useState<TradeMode>(() => hasExistingInvestments ? "rebalance" : "fresh");
  const [holdingsText, setHoldingsText] = useState("");
  const [bulkEntryText, setBulkEntryText] = useState("");
  const [cashText, setCashText] = useState("0");
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [minimumTradeText, setMinimumTradeText] = useState("1000");
  const [filter, setFilter] = useState("ACTIONS");
  const [holdingEntryMode, setHoldingEntryMode] = useState<HoldingEntryMode>("manual");
  const [savedInput, setSavedInput] = useState<{ holdings: string; cash: string } | null>(null);
  const [recommendationGenerated, setRecommendationGenerated] = useState(false);
  const [customStockQuery, setCustomStockQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([userData.getHoldings(), userData.getCash()]).then(([savedHoldings, savedCash]) => {
      if (cancelled) return;
      setHoldingsText(holdingsToText(savedHoldings));
      setCashText(String(savedCash + pendingFreshMoney));
      setSavedInput({ holdings: holdingsToText(savedHoldings), cash: String(savedCash) });
      setDataLoading(false);
      if (!hasExistingInvestments && savedHoldings.length > 0) setMode("rebalance");
      if (savedCash === 0 && pendingFreshMoney === 0) void userData.getPreferences().then((prefs) => {
        if (!cancelled && prefs.preferredCapital && prefs.preferredCapital > 0) setCashText(String(prefs.preferredCapital));
      }).catch(() => undefined);
    }).catch((error: unknown) => {
      if (!cancelled) { setLoadError(error instanceof Error ? error.message : "Could not load saved portfolio."); setDataLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userData, hasExistingInvestments, pendingFreshMoney]);

  useEffect(() => {
    setRecommendationGenerated(false);
  }, [cashText, minimumTradeText, mode]);

  const deferredHoldingsText = useDeferredValue(holdingsText);
  const holdings = useMemo(() => parseHoldingsText(deferredHoldingsText), [deferredHoldingsText]);
  const hasHoldings = holdings.length > 0;
  const manualRows = useMemo(() => parseHoldingEditorRows(holdingsText), [holdingsText]);
  const cash = Number(cashText) || 0;
  const minimumTradeValue = Number(minimumTradeText) || 0;
  const holdingIssues = getHoldingInputIssues(holdingsText);

  const preview = useMemo(() => buildTradePlan(holdings, cash, minimumTradeValue), [holdings, cash, minimumTradeValue]);
  const cashPlan = useMemo(() => buildCashDeploymentPlan(cash, [], minimumTradeValue), [cash, minimumTradeValue]);
  const targets = getPortfolioTargets();
  const stocks = getStocks();
  const recommendationUniverses = getRecommendationUniverses();
  const modelExampleSymbols = useMemo(() => {
    return [...targets]
      .sort((a, b) => b.target_weight - a.target_weight)
      .map((target) => target.symbol)
      .slice(0, 4);
  }, [targets]);
  const modelExampleText = modelExampleSymbols.length > 0
    ? modelExampleSymbols.join(", ")
    : "RELIANCE, TCS, INFY";
  const stockSymbols = getStockSymbols();
  const nifty500Audit = getNifty500DataAudit();
  const holdingSymbolOptions = useMemo(() => {
    const bySymbol = new Map<string, HoldingSymbolOption>();
    stocks.forEach((stock) => {
      bySymbol.set(stock.symbol, { symbol: stock.symbol, name: stock.name, sector: stock.sector });
    });
    nifty500Audit?.rows.forEach((row) => {
      if (!bySymbol.has(row.symbol)) {
        bySymbol.set(row.symbol, {
          symbol: row.symbol,
          name: row.companyName,
          sector: row.industry,
        });
      }
    });
    stockSymbols.forEach((symbol) => {
      const normalized = symbol.replace(/-/g, "").toUpperCase();
      if (!bySymbol.has(normalized)) {
        bySymbol.set(normalized, { symbol: normalized, name: symbol, sector: "Price history available" });
      }
    });
    return Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [nifty500Audit, stockSymbols, stocks]);
  const snapshot = getDecisionSnapshot();
  const dailyRisk = assessDailyRisk();
  const freshTone = getFreshPlanTone(cashPlan.action);
  const recommendationAvailable = snapshot.latestMonth !== "—" && snapshot.decision !== null;
  const explanation = useMemo(() => buildDeterministicExplanation(dailyRisk, preview.rows), [dailyRisk, preview.rows]);
  const executableRows = useMemo(() => preview.rows.filter((row) => row.finalTradeQuantity !== 0), [preview.rows]);
  const deferredCustomStockQuery = useDeferredValue(customStockQuery);
  const liveCustomQuery = customStockQuery.trim().toUpperCase();
  const normalizedCustomQuery = deferredCustomStockQuery.trim().toUpperCase();
  const stockSearchIndex = useMemo(() => stocks.map((stock) => ({
    ...stock,
    searchText: `${stock.symbol} ${stock.name}`.toUpperCase(),
  })), [stocks]);
  const customSuggestions = useMemo(() => {
    if (liveCustomQuery.length < 1) return [];
    return stockSearchIndex
      .filter((stock) => stock.searchText.includes(liveCustomQuery))
      .slice(0, 6);
  }, [liveCustomQuery, stockSearchIndex]);
  const selectedCustomStock = stocks.find((stock) => stock.symbol === normalizedCustomQuery);
  const customTarget = targets.find((target) => target.symbol === normalizedCustomQuery);
  const selectedCandidate = normalizedCustomQuery
    ? recommendationUniverses?.universes.nifty200.rows.find((row) => row.symbol === normalizedCustomQuery) ||
      recommendationUniverses?.universes.nifty500.rows.find((row) => row.symbol === normalizedCustomQuery)
    : null;
  const customPlan = useMemo(
    () => normalizedCustomQuery ? buildCashDeploymentPlan(cash, [normalizedCustomQuery], minimumTradeValue) : null,
    [cash, minimumTradeValue, normalizedCustomQuery],
  );
  const customTradeRow = normalizedCustomQuery ? preview.rows.find((row) => row.symbol === normalizedCustomQuery) : null;
  const customPrice = normalizedCustomQuery ? getLatestPrice(normalizedCustomQuery) : 0;
  const customHeldQuantity = holdings.find((holding) => holding.symbol === normalizedCustomQuery)?.quantity || 0;
  const customVerdict = useMemo(() => normalizedCustomQuery.length === 0
    ? null
    : mode === "rebalance" && customTarget && customTradeRow
      ? {
          tone: customTradeRow.action === "BUY" || customTradeRow.action === "ADD"
            ? "green" as const
            : customTradeRow.action === "SELL" || customTradeRow.action === "REDUCE"
              ? "amber" as const
              : "slate" as const,
          title: "Model view for your portfolio",
          detail: `${normalizedCustomQuery} is in this month’s model basket at ${(customTradeRow.targetWeight * 100).toFixed(2)}%. You have ${formatShareCount(customHeldQuantity)}; model target is ${formatShareCount(customTradeRow.targetQuantity)}. Personal action: ${customTradeRow.action.toLowerCase()}${customTradeRow.tradeValue > 0 ? ` around ${formatCurrency(customTradeRow.tradeValue)}` : ""}.`,
        }
    : mode === "rebalance" && customTarget
      ? {
          tone: "green" as const,
          title: "Model supports this stock",
          detail: `${normalizedCustomQuery} is in this month’s basket. Add free cash above, save your plan, and the assistant can size it against the rest of your portfolio.`,
        }
    : customTarget && customPlan && customPlan.rows.length > 0
      ? {
            tone: "green" as const,
            title: "Model allows this stock",
            detail: `${normalizedCustomQuery} is in the current basket. Suggested quantity: ${formatShareCount(customPlan.rows[0].quantity)} inside ${formatPriceRange(customPrice)}.`,
        }
      : customTarget
        ? {
            tone: "amber" as const,
            title: "Good stock, but amount is too small for a practical buy",
            detail: customPlan?.message || `The stock is in the basket, but the current amount does not create a clean trade after sizing rules.`,
          }
        : {
            tone: "slate" as const,
            title: "Not in this month’s model basket",
            detail: selectedCustomStock
              ? `${normalizedCustomQuery} is known, but the model is not selecting it for this month. Keep it on watch instead of forcing a buy from this plan.`
              : `No exact symbol match yet. Choose one of the suggestions before using this as a personal stock check.`,
          }, [customHeldQuantity, customPlan, customPrice, customTarget, customTradeRow, mode, normalizedCustomQuery, selectedCustomStock]);
  const customReasoningRows = useMemo(() => {
    if (!normalizedCustomQuery || !customVerdict) return [];
    if (!selectedCustomStock && !selectedCandidate && !customTarget) {
      return [
        "The app needs an exact listed symbol before it can compare the stock with the model basket.",
        "Pick a suggestion so the check can use the same symbol format as the market data.",
      ];
    }
    const rows: string[] = [];
    if (customTarget) {
      rows.push(`${normalizedCustomQuery} has a ${(customTarget.target_weight * 100).toFixed(2)}% target weight in this month's model basket.`);
      rows.push("The action still depends on your cash, current quantity, latest price, and minimum trade size.");
    } else {
      rows.push(`${normalizedCustomQuery} has 0% target weight in this month's selected model basket.`);
      rows.push(`The basket currently keeps ${targets.length} stocks after factor ranking, regime weights, liquidity checks, and sizing constraints.`);
    }
    if (selectedCandidate) {
      rows.push(`Candidate scan: rank ${selectedCandidate.rank}, ${selectedCandidate.recommendation.toLowerCase()} view${selectedCandidate.confidence !== undefined ? `, ${(selectedCandidate.confidence * 100).toFixed(0)}% confidence` : ""}.`);
      if (selectedCandidate.reason) rows.push(selectedCandidate.reason);
    } else if (!customTarget) {
      rows.push("It did not appear high enough in the broader candidate scan to become a preferred buy this month.");
    }
    if (selectedCustomStock?.sector) rows.push(`Sector context: ${selectedCustomStock.sector}.`);
    return rows;
  }, [customTarget, customVerdict, normalizedCustomQuery, selectedCandidate, selectedCustomStock, targets.length]);
  const customVerdictBadge = mode === "rebalance" && customTarget && customTradeRow
    ? customTradeRow.action === "HOLD"
      ? "Hold / no trade"
      : customTradeRow.action
    : customVerdict?.tone === "green"
      ? "Can consider"
      : customVerdict?.tone === "amber"
        ? "Review action"
        : "Watchlist";

  const holdingCards = useMemo(() => holdings.map((holding) => {
    const latestPrice = getLatestPrice(holding.symbol);
    const planRow = preview.rows.find((row) => row.symbol === holding.symbol);
    const stock = stocks.find((item) => item.symbol === holding.symbol);
    const avgPrice = holding.avgPrice || 0;
    const invested = avgPrice > 0 ? holding.quantity * avgPrice : 0;
    const currentValue = holding.quantity * latestPrice;
    const pnl = invested > 0 ? currentValue - invested : 0;
    const pnlPct = invested > 0 ? pnl / invested : 0;
    return { ...holding, latestPrice, avgPrice, invested, currentValue, pnl, pnlPct, planRow, stock };
  }), [holdings, preview.rows, stocks]);
  const holdingsMarketValue = holdingCards.reduce((sum, holding) => sum + holding.currentValue, 0);
  const holdingsInvestedValue = holdingCards.reduce((sum, holding) => sum + holding.invested, 0);
  const holdingsPnl = holdingsMarketValue - holdingsInvestedValue;
  const holdingsPnlPct = holdingsInvestedValue > 0 ? holdingsPnl / holdingsInvestedValue : 0;
  const modeledHoldingCount = holdingCards.filter((holding) => holding.planRow && holding.planRow.targetWeight > 0).length;

  const cashPlanRows = useMemo(() => cashPlan.rows.map((row) => ({
    stock: <span className="font-semibold text-slate-900">{row.symbol}</span>,
    action: <Badge color="green">Buy {row.quantity}</Badge>,
    buyZone: formatPriceRange(row.latestPrice),
    amount: formatCurrency(row.buyValue * 1.015),
    reason: row.reason,
  })), [cashPlan.rows]);

  const tableRows = useMemo(() => hasHoldings ? preview.rows
    .filter((row) => {
      if (filter === "ALL") return true;
      if (filter === "ACTIONS") return row.finalTradeQuantity !== 0 || ["BUY", "ADD", "SELL", "REDUCE", "PAUSED"].includes(row.action);
      return row.action === filter;
    })
    .sort((a, b) => {
      const order = { SELL: 0, REDUCE: 1, BUY: 2, ADD: 3, PAUSED: 4, IGNORED: 5, HOLD: 6 };
      return (order[a.action] ?? 9) - (order[b.action] ?? 9) || b.tradeValue - a.tradeValue;
    })
    .map((row) => ({
      stock: <span className="font-semibold text-slate-900">{row.symbol}</span>,
      current: `${row.currentQuantity} shares`,
      target: `${row.targetQuantity} shares`,
      action:
        row.action === "PAUSED" || row.action === "IGNORED" ? (
          <Badge color={row.action === "PAUSED" ? "amber" : "slate"}>{row.action}</Badge>
        ) : (
          <SignalBadge signal={row.action} />
        ),
      amount: formatCurrency(row.tradeValue),
      reason: row.reason,
    })) : [], [filter, hasHoldings, preview.rows]);

  const handleSave = async () => {
    setSaveMessage("");
    try {
      await Promise.all([userData.saveHoldings(holdings as PersistedHolding[]), userData.saveCash(cash)]);
      const snapshot = getDecisionSnapshot();
      const planItems = mode === "fresh"
        ? cashPlan.rows.map((row) => ({
            symbol: row.symbol,
            currentQuantity: 0,
            targetQuantity: row.quantity,
            executableQuantity: row.quantity,
            action: "BUY",
            reason: row.reason,
          }))
        : preview.rows.map((row) => ({
            symbol: row.symbol,
            currentQuantity: row.currentQuantity,
            targetQuantity: row.targetQuantity,
            executableQuantity: row.finalTradeQuantity,
            action: row.action,
            reason: row.reason,
          }));
      await userData.saveTradePlan({
        generatedAt: new Date().toISOString(),
        action: snapshot.decision?.decision || "RETAIN",
        status: "draft",
        signalDate: `${snapshot.latestMonth || new Date().toISOString().slice(0, 7)}-01`,
        items: planItems,
      });
      if (user?.id && pendingFreshMoney > 0) markFreshMoneyIncluded(user.id);
      setSavedInput({ holdings: holdingsToText(holdings), cash: cashText });
      setSaveMessage(mode === "fresh" ? "Your investment amount and draft plan were saved to your account." : "Your holdings, cash, and draft plan were saved to your account.");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Could not save your plan. Please try again.");
    }
  };

  const handleGenerateRecommendation = () => {
    setSaveMessage("");
    setRecommendationGenerated(true);
  };

  const planEdited = savedInput !== null && (savedInput.holdings !== holdingsText || savedInput.cash !== cashText);

  const updateManualRow = (index: number, patch: Partial<UserHolding>) => {
    const next = manualRows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row
    );
    setHoldingsText(holdingsToText(next));
  };

  const addManualRow = () => {
    setHoldingsText(holdingsToText([...manualRows, { symbol: "", quantity: 0, avgPrice: undefined }]));
  };

  const loadBulkHoldings = () => {
    const pasted = parseHoldingsText(bulkEntryText);
    if (pasted.length === 0) return;
    setHoldingsText(holdingsToText(pasted));
  };

  const removeManualRow = (index: number) => {
    const next = manualRows.filter((_, rowIndex) => rowIndex !== index);
    setHoldingsText(holdingsToText(next));
  };

  const handleReset = async () => {
    try {
      await Promise.all([userData.saveHoldings([]), userData.saveCash(0)]);
      setHoldingsText("");
      setBulkEntryText("");
      setCashText("0");
      setSaveMessage("Saved portfolio cleared.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Could not clear saved portfolio."); }
  };

  const handleExport = () => {
    downloadTextFile("personalized_trade_plan.csv", tradePlanToCsv(preview.rows));
  };

  const handleCopy = async () => {
    const text = executableRows
      .map((row) =>
        row.finalTradeQuantity > 0
          ? `${row.symbol}: BUY ${row.finalTradeQuantity} shares`
          : `${row.symbol}: SELL ${Math.abs(row.finalTradeQuantity)} shares`
      )
      .join("\n");
    await navigator.clipboard.writeText(text || "No executable trades today.");
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const imported = parseHoldingsCsv(text);
    setHoldingsText(holdingsToText(imported));
    setMode("rebalance");
  };

  const modeSteps = mode === "fresh"
    ? [
        { label: "Enter capital", value: cash > 0 ? formatCurrency(cash) : "Waiting for amount" },
        { label: "AI reads monthly basket", value: snapshot.latestMonth },
        { label: "Output", value: `${cashPlan.rows.length} buy idea${cashPlan.rows.length === 1 ? "" : "s"}` },
      ]
    : [
        { label: "Import or enter holdings", value: hasHoldings ? `${holdings.length} stock${holdings.length === 1 ? "" : "s"}` : "Waiting for holdings" },
        { label: "AI compares with model", value: snapshot.latestMonth },
        { label: "Output", value: executableRows.length > 0 ? `${executableRows.length} trade${executableRows.length === 1 ? "" : "s"}` : "No trades now" },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Plan</h2>
        <p className="mt-1 text-sm text-slate-500">Turn fresh cash or existing holdings into a monthly positional trade plan.</p>
      </div>
      {dataLoading && <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">Loading your saved holdings and cash…</p>}
      {loadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Saved portfolio unavailable: {loadError}. Review and enter details manually; saved values are not assumed.</div>}
      {!dataLoading && recommendationAvailable ? <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><div className="flex flex-wrap items-center gap-2"><Badge color="blue">Model recommendation</Badge><span>Model month {snapshot.latestMonth}</span><Badge color={planEdited ? "amber" : "slate"}>{planEdited ? "Your edited draft" : "Your saved inputs"}</Badge><span className="text-blue-700">Save My Plan to store the current inputs and draft actions.</span></div></div> : !dataLoading && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Current model recommendation unavailable. Your inputs can still be saved for later review.</div>}
      {saveMessage && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{saveMessage}</div>}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-3">
        {modeSteps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
              {index + 1}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{step.label}</p>
              <p className="truncate text-sm font-semibold text-slate-950">{step.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── MODE SELECTION ───────────────────────────────────────────────── */}
      {mode === "fresh" ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <p className="text-sm font-bold text-slate-950">You are building a fresh plan</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Start with your investment amount. After you actually buy stocks, you can add those holdings here and the page will switch to portfolio review.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMode("rebalance")}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              I now have holdings to add
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Upload className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <p className="text-sm font-bold text-slate-950">Review your holdings</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Import or manually enter stocks you own, then review sell, reduce, hold, add, or buy actions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-6 2xl:grid-cols-[430px_minmax(0,1fr)]">
        {/* ── INPUT PANEL ─────────────────────────────────────────────────── */}
        <Card
          title={mode === "fresh" ? "Tell the assistant your budget" : "Your Holdings"}
          subtitle={mode === "fresh" ? "Nothing is recommended until you generate a plan." : "Stocks you currently own"}
        >
          <div className={mode === "fresh" ? "space-y-4" : "grid grid-cols-2 gap-3"}>
            <label className="text-xs font-medium text-slate-600">
              {mode === "fresh" ? "Amount to invest (₹)" : "Free cash available (₹)"}
              <input
                value={cashText}
                onChange={(event) => setCashText(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-lg font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="50000"
              />
            </label>
            {mode === "fresh" ? (
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">Advanced sizing setting</summary>
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  <TermTooltip term="minimum trade size">Minimum trade size (₹)</TermTooltip>
                  <input
                    value={minimumTradeText}
                    onChange={(event) => setMinimumTradeText(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </details>
            ) : (
              <label className="text-xs font-medium text-slate-600">
                <TermTooltip term="minimum trade size">Minimum trade size (₹)</TermTooltip>
                <input
                  value={minimumTradeText}
                  onChange={(event) => setMinimumTradeText(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            )}
          </div>

          {mode === "fresh" && (
            <div className="mt-5 space-y-4">
              <details className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                <summary className="cursor-pointer font-semibold text-blue-950">How the recommendation is created</summary>
                <p className="mt-2">
                  The assistant reads the monthly factor model, market regime, news stress, and daily risk overlay. It then decides whether to deploy, stagger, or wait.
                </p>
                <div className="mt-3 grid gap-2">
                  {[
                    "The model chooses stocks; you review before acting.",
                    "Every buy has quantity and a buy zone, not one fixed price.",
                    "No order is placed automatically.",
                  ].map((item) => (
                    <div key={item} className="flex gap-2 rounded-lg border border-blue-100 bg-white/80 p-2 text-xs leading-5 text-blue-900">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </details>
              <button
                onClick={handleGenerateRecommendation}
                disabled={cash <= 0}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Generate my recommendation
              </button>
              {recommendationGenerated && (
                <button
                  onClick={handleSave}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Save this draft plan
                </button>
              )}
            </div>
          )}

          {mode === "rebalance" && (
            <div className="mt-5 space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { id: "manual" as const, label: "Manual", helper: "A few holdings", icon: PencilLine },
                    { id: "import" as const, label: "CSV import", helper: "Broker export", icon: Upload },
                    { id: "paste" as const, label: "Paste list", helper: "Fast bulk entry", icon: FileText },
                  ].map((option) => {
                    const Icon = option.icon;
                    const active = holdingEntryMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setHoldingEntryMode(option.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                          active
                            ? "border-blue-300 bg-white text-blue-900 shadow-sm"
                            : "border-transparent bg-transparent text-slate-600 hover:bg-white"
                        }`}
                      >
                        <Icon className={`mt-0.5 h-4 w-4 ${active ? "text-blue-700" : "text-slate-400"}`} />
                        <span>
                          <span className="block text-sm font-bold">{option.label}</span>
                          <span className="mt-0.5 block text-xs">{option.helper}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {holdingEntryMode === "import" && (
                <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 p-5 text-center">
                  <Upload className="mx-auto h-6 w-6 text-blue-700" />
                  <p className="mt-2 text-sm font-bold text-slate-950">Import your broker holdings CSV</p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-600">
                    Works with exports that contain symbol, quantity, and optionally average price. Nothing is traded from this upload.
                  </p>
                  <label className="mt-4 inline-flex cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                    Choose CSV file
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => handleImportFile(event.target.files?.[0] || null)} />
                  </label>
                </div>
              )}

              {holdingEntryMode === "paste" && (
                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Paste holdings</p>
                    <p className="mt-1 text-xs text-slate-500">One row per stock. Try current Nifty 200 model names like {modelExampleText}.</p>
                  </div>
                  <div className="p-4">
                    <textarea
                      value={bulkEntryText}
                      onChange={(event) => setBulkEntryText(event.target.value)}
                      className="h-24 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder={`${modelExampleSymbols[0] || "RELIANCE"},3,2850\n${modelExampleSymbols[1] || "TCS"},2,3900\n${modelExampleSymbols[2] || "INFY"},5,1500`}
                    />
                    <button
                      onClick={loadBulkHoldings}
                      type="button"
                      className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Load pasted holdings
                    </button>
                  </div>
                </div>
              )}

              {holdingCards.length > 0 && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-500">Holdings value</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{formatCurrency(holdingsMarketValue)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-500"><TermTooltip term="unrealized pnl">Unrealized P&L</TermTooltip></p>
                      <p className={`mt-1 text-lg font-bold ${holdingsPnl >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {holdingsPnl >= 0 ? "+" : ""}{formatCurrency(holdingsPnl)}
                      </p>
                      {holdingsInvestedValue > 0 && (
                        <p className={`mt-0.5 text-xs font-semibold ${holdingsPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {(holdingsPnlPct * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-500">In model basket</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{modeledHoldingCount}/{holdingCards.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Current holdings</p>
                    <Badge color="slate">{holdingCards.length} stocks</Badge>
                  </div>
                  <div className="max-h-[300px] space-y-2 overflow-auto pr-1">
                    {holdingCards.map((holding) => (
                      <div key={holding.symbol} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-950">{holding.symbol}</p>
                            <p className="text-xs text-slate-500">
                              {holding.stock?.name || "Company name unavailable"} · {holding.stock?.sector || holding.planRow?.sector || "Sector unavailable"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{holding.quantity} shares @ {holding.avgPrice > 0 ? formatCurrency(holding.avgPrice) : "avg price missing"}</p>
                          </div>
                          <div className="min-w-[110px] text-right">
                            <p className="text-sm font-bold text-slate-950">{formatCurrency(holding.currentValue)}</p>
                            {holding.invested > 0 && (
                              <p className={`text-xs font-semibold ${holding.pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {holding.pnl >= 0 ? "+" : ""}{formatCurrency(holding.pnl)} ({(holding.pnlPct * 100).toFixed(1)}%)
                              </p>
                            )}
                            <div className="mt-2">
                              {holding.planRow ? (
                                <SignalBadge signal={holding.planRow.action} />
                              ) : (
                                <Badge color="slate">Watch</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`rounded-xl border border-slate-200 bg-white ${holdingEntryMode === "manual" ? "" : "hidden"}`}>
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Edit holdings</p>
                  <p className="mt-1 text-xs text-slate-500">Start typing a symbol or company name. Current Nifty 200 model examples: {modelExampleText}.</p>
                </div>
                <div className="overflow-visible">
                  <table className="w-full min-w-[380px] text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Symbol</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Avg Price</th>
                        <th className="px-3 py-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualRows.map((row, index) => (
                        <tr key={`holding-row-${index}`} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <HoldingSymbolInput
                              value={row.symbol}
                              placeholder={`Try ${modelExampleSymbols[index % Math.max(1, modelExampleSymbols.length)] || "RELIANCE"}`}
                              onChange={(value) => updateManualRow(index, { symbol: value })}
                              onSelect={(symbol) => updateManualRow(index, { symbol })}
                              options={holdingSymbolOptions}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.quantity || ""}
                              onChange={(event) => updateManualRow(index, { quantity: Number(event.target.value) || 0 })}
                              className="w-full rounded-md border border-slate-300 px-2 py-2 text-right text-sm font-semibold"
                              placeholder="10"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.avgPrice || ""}
                              onChange={(event) => updateManualRow(index, { avgPrice: Number(event.target.value) || undefined })}
                              className="w-full rounded-md border border-slate-300 px-2 py-2 text-right text-sm font-semibold"
                              placeholder="420"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeManualRow(index)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50"
                              type="button"
                              aria-label={`Remove ${row.symbol || "holding row"}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={addManualRow}
                  type="button"
                  className="m-3 inline-flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Add holding row
                </button>
              </div>

              {holdingIssues.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
                  <p className="font-semibold">A holding needs a little more detail before saving</p>
                  {holdingIssues.slice(0, 4).map((issue) => <p key={issue}>{issue}</p>)}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={holdingIssues.length > 0}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Save My Plan
              </button>
              <button
                onClick={handleReset}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset saved portfolio
              </button>
            </div>
          )}
        </Card>

        {/* ── RESULTS PANEL ───────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          {mode === "fresh" ? (
            <>
              {!recommendationGenerated ? (
                <div className="rounded-xl border border-dashed border-blue-200 bg-white p-6 text-center">
                  <p className="text-sm font-semibold text-slate-900">Enter an amount, then generate your plan.</p>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Your onboarding amount can pre-fill the box, but the recommendation will appear only after you ask for it here.
                  </p>
                </div>
              ) : (
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Decision</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{cashPlan.action}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Amount entered</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(cash)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">To invest</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(cashPlan.totalUsed)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500"><TermTooltip term="free cash">Cash remaining</TermTooltip></p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(cashPlan.cashLeft)}</p>
                  </div>
                </div>
              )}

              {recommendationGenerated && <Card
                title="Your generated buy plan"
                subtitle="Personalized from your amount, the current model basket, and the daily risk overlay."
              >
                <div className={`rounded-xl border p-5 ${
                  freshTone.color === "green"
                    ? "border-emerald-200 bg-emerald-50"
                    : freshTone.color === "amber"
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assistant view</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{freshTone.title}</p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{freshTone.detail}</p>
                    </div>
                    <Badge color={cashPlan.rows.length > 0 ? "green" : "amber"}>
                      {cashPlan.rows.length > 0 ? `${cashPlan.rows.length} buys ready` : "Wait / no buy today"}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{cashPlan.message}</p>
                  {cashPlan.rows.length === 0 && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
                        <p className="text-xs font-semibold text-slate-500">Why no buy?</p>
                        <p className="mt-1 text-sm leading-5 text-slate-700">
                          Today the monthly gate is not approving fresh deployment. The model can still like stocks, but it is saying to keep cash ready instead of forcing a trade.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
                        <p className="text-xs font-semibold text-slate-500">How portfolio assessment starts</p>
                        <p className="mt-1 text-sm leading-5 text-slate-700">
                          With no holdings, Portfolio has nothing to compare yet. Once you save holdings or cash here, the app compares your account against model target weights.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-3">
                    <div className="rounded-lg bg-white/75 p-3">
                      <p className="text-xs font-semibold text-slate-500">Model month</p>
                      <p className="mt-1 text-sm font-bold text-slate-950">{snapshot.latestMonth}</p>
                    </div>
                    <div className="rounded-lg bg-white/75 p-3">
                      <p className="text-xs font-semibold text-slate-500">Risk mode</p>
                      <p className="mt-1 text-sm font-bold text-slate-950">{dailyRisk.executionMode}</p>
                    </div>
                    <div className="rounded-lg bg-white/75 p-3">
                      <p className="text-xs font-semibold text-slate-500">Why</p>
                      <p className="mt-1 break-words text-sm font-bold text-slate-950">{dailyRisk.triggers[0]}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-start gap-2 text-xs font-medium leading-5 text-slate-600">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    Prices move during the day. Use the buy zone as a limit area. If the stock trades above the zone, wait or re-check; do not chase just because the table had a lower reference price.
                  </div>
                </div>
                {cashPlan.rows.length > 0 && (
                  <div className="mt-4 space-y-4">
                    <Table
                      maxHeight="360px"
                      columns={[
                        { key: "stock", label: "Stock" },
                        { key: "action", label: "Qty" },
                        { key: "buyZone", label: <TermTooltip term="buy zone">Buy zone</TermTooltip>, align: "right" },
                        { key: "amount", label: "Max spend", align: "right" },
                        { key: "reason", label: "Why" },
                      ]}
                      data={cashPlanRows}
                    />
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">If price is inside zone</p>
                        <p className="mt-1 text-sm leading-5 text-slate-700">Buy the shown quantity using a limit order near the zone.</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">If price is above zone</p>
                        <p className="mt-1 text-sm leading-5 text-slate-700">Wait. A missed trade is better than chasing a moved price.</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-500">If market looks volatile</p>
                        <p className="mt-1 text-sm leading-5 text-slate-700">Use stagger mode: buy part now and keep cash for the next check.</p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>}

              <Card
                title="Check my own stock idea"
                subtitle="Search a stock outside the generated plan and see whether this month’s model supports it."
              >
                <div className="space-y-4">
                  <label className="block text-xs font-medium text-slate-600">
                    Stock symbol or company name
                    <input
                      value={customStockQuery}
                      onChange={(event) => setCustomStockQuery(event.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm font-semibold uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder={`Try Nifty 200 model stocks: ${modelExampleText}`}
                    />
                  </label>
                  {customSuggestions.length > 0 && liveCustomQuery !== customSuggestions[0]?.symbol && (
                    <div className="flex flex-wrap gap-2">
                      {customSuggestions.map((stock) => (
                        <button
                          key={stock.symbol}
                          type="button"
                          onClick={() => setCustomStockQuery(stock.symbol)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                        >
                          {stock.symbol} <span className="font-normal text-slate-500">{stock.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {customVerdict && (
                    <div className={`rounded-xl border p-4 ${
                      customVerdict.tone === "green"
                        ? "border-emerald-200 bg-emerald-50"
                        : customVerdict.tone === "amber"
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                    }`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-950">{customVerdict.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">{customVerdict.detail}</p>
                          {selectedCustomStock && <p className="mt-2 text-xs text-slate-500">{selectedCustomStock.name} · {selectedCustomStock.sector || "Sector unavailable"}</p>}
                          {customReasoningRows.length > 0 && (
                            <div className="mt-4 rounded-lg border border-white/70 bg-white/70 p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">AI reasoning</p>
                              <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                                {customReasoningRows.map((reason) => (
                                  <li key={reason}>- {reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <Badge color={customVerdict.tone === "green" ? "green" : customVerdict.tone === "amber" ? "amber" : "slate"}>
                          {customVerdictBadge}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : (
            <>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Portfolio value</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(preview.portfolioValue)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Executable trades</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{executableRows.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Paused / ignored</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {preview.rows.filter((row) => ["PAUSED", "IGNORED"].includes(row.action)).length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Cash after plan</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(preview.cashAfter)}</p>
                </div>
              </div>

              {!hasHoldings && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
                  Import or paste holdings to generate your personal trade plan.
                </div>
              )}

              {hasHoldings && preview.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {preview.warnings.slice(0, 2).map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              )}

              <Card
                title="Check my own stock idea"
                subtitle="Ask whether a stock fits your current holdings, model basket, and available cash."
              >
                <div className="space-y-4">
                  <label className="block text-xs font-medium text-slate-600">
                    Stock symbol or company name
                    <div className="relative mt-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={customStockQuery}
                        onChange={(event) => setCustomStockQuery(event.target.value.toUpperCase())}
                        className="w-full rounded-lg border border-slate-300 py-3 pl-9 pr-3 text-sm font-semibold uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder={`Try Nifty 200 model stocks: ${modelExampleText}`}
                      />
                    </div>
                  </label>
                  {customSuggestions.length > 0 && liveCustomQuery !== customSuggestions[0]?.symbol && (
                    <div className="flex flex-wrap gap-2">
                      {customSuggestions.map((stock) => (
                        <button
                          key={stock.symbol}
                          type="button"
                          onClick={() => setCustomStockQuery(stock.symbol)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                        >
                          {stock.symbol} <span className="font-normal text-slate-500">{stock.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {customVerdict ? (
                    <div className={`rounded-xl border p-4 ${
                      customVerdict.tone === "green"
                        ? "border-emerald-200 bg-emerald-50"
                        : customVerdict.tone === "amber"
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                    }`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-950">{customVerdict.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">{customVerdict.detail}</p>
                          {selectedCustomStock && <p className="mt-2 text-xs text-slate-500">{selectedCustomStock.name} · {selectedCustomStock.sector || "Sector unavailable"}</p>}
                          {customReasoningRows.length > 0 && (
                            <div className="mt-4 rounded-lg border border-white/70 bg-white/70 p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">AI reasoning</p>
                              <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                                {customReasoningRows.map((reason) => (
                                  <li key={reason}>- {reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <Badge color={customVerdict.tone === "green" ? "green" : customVerdict.tone === "amber" ? "amber" : "slate"}>
                          {customVerdictBadge}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                      Use this when you are about to search a stock in Zerodha or Groww and want this app to answer: is it in the model, do I already own enough, and should I add, hold, reduce, or just watch?
                    </div>
                  )}
                </div>
              </Card>

              {hasHoldings && <Card title="Monthly Positional View" subtitle="What the assistant understood from your holdings">
                <p className="text-sm leading-6 text-slate-700">{explanation}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-xs font-medium text-red-700">Exit / reduce</p>
                    <p className="mt-1 text-lg font-bold text-red-900">
                      {preview.rows.filter((row) => row.action === "SELL" || row.action === "REDUCE").length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs font-medium text-emerald-700">Buy / add</p>
                    <p className="mt-1 text-lg font-bold text-emerald-900">
                      {preview.rows.filter((row) => row.action === "BUY" || row.action === "ADD").length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-600">Hold / wait</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {preview.rows.filter((row) => row.action === "HOLD" || row.action === "PAUSED" || row.action === "IGNORED").length}
                    </p>
                  </div>
                </div>
              </Card>}

              <Card
                title="Recommended Changes"
                subtitle={hasHoldings ? "Actionable trades first. Switch to all model rows only when you want audit detail." : "Waiting for your holdings"}
                action={
                  <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                    {["ACTIONS", "ALL", "BUY", "ADD", "SELL", "REDUCE", "PAUSED", "IGNORED", "HOLD"].map((item) => <option key={item} value={item}>{item === "ACTIONS" ? "ACTIONABLE" : item}</option>)}
                  </select>
                }
              >
                {hasHoldings && executableRows.length === 0 && filter === "ACTIONS" && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-950">No portfolio trades to place right now.</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      The model is in RETAIN mode, so it is showing target differences for transparency but not asking you to rebalance today.
                    </p>
                  </div>
                )}
                <Table
                  maxHeight="620px"
                  columns={[
                    { key: "stock", label: "Stock" },
                    { key: "current", label: "Current", align: "right" },
                    { key: "target", label: "Target", align: "right" },
                    { key: "action", label: "Action", align: "center" },
                    { key: "amount", label: "Amount", align: "right" },
                    { key: "reason", label: "Reason" },
                  ]}
                  data={tableRows}
                  emptyMessage={filter === "ACTIONS" ? "No actionable trades for the current model gate." : "No records are available for this filter."}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={handleExport} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    Export CSV
                  </button>
                  <button onClick={handleCopy} className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    Copy Trades <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
