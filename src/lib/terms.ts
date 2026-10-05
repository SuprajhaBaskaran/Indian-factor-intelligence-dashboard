/**
 * Global term explanation system.
 *
 * Provides plain-English definitions for technical terms used throughout
 * the application. Users can click/hover/tap an info icon beside unfamiliar
 * terms to see a simple explanation.
 *
 * Definitions are intentionally non-technical. They explain what the term
 * means for the user's portfolio, not the mathematical formula behind it.
 */

export interface TermDefinition {
  term: string;
  definition: string;
  category: "action" | "factor" | "risk" | "performance" | "model";
}

export const TERM_DEFINITIONS: Record<string, TermDefinition> = {
  // ── Actions ────────────────────────────────────────────────────────────
  "stagger buys": {
    term: "Stagger Buys",
    definition: "Instead of investing all planned money at once, the system recommends spreading purchases over multiple opportunities because current execution conditions suggest caution.",
    category: "action",
  },
  "rebalance": {
    term: "Rebalance",
    definition: "Adjusting your portfolio to match the model's current target. This may involve selling some stocks and buying others to bring your allocation in line with what the model currently favours.",
    category: "action",
  },
  "minimum trade size": {
    term: "Minimum Trade Size",
    definition: "The smallest suggested trade value shown in a plan. Smaller changes are left out to avoid listing impractically small trades.",
    category: "action",
  },
  "buy": {
    term: "Buy",
    definition: "The model recommends purchasing this stock because it contributes to the currently favoured factor exposure.",
    category: "action",
  },
  "add": {
    term: "Add",
    definition: "You already own this stock, and the model recommends increasing your position because it strengthens the currently favoured factor exposure.",
    category: "action",
  },
  "reduce": {
    term: "Reduce",
    definition: "You own more of this stock than the model currently wants. The model recommends selling part of your position to bring your allocation closer to the target.",
    category: "action",
  },
  "sell": {
    term: "Sell",
    definition: "The model recommends completely exiting this position because it no longer contributes to the currently favoured factor exposure.",
    category: "action",
  },
  "hold": {
    term: "Hold",
    definition: "The model recommends keeping your current position unchanged. Your allocation is already close to the target.",
    category: "action",
  },
  "wait": {
    term: "Wait",
    definition: "The model recommends not making new investments at this time. Current market or risk conditions suggest waiting for a better opportunity.",
    category: "action",
  },

  // ── Factors ────────────────────────────────────────────────────────────
  "quality": {
    term: "Quality",
    definition: "A factor that favours companies with strong balance sheets, consistent earnings, and sustainable business models. Quality stocks tend to be more resilient during market downturns.",
    category: "factor",
  },
  "low volatility": {
    term: "Low Volatility",
    definition: "A factor that favours stocks whose prices tend to move up and down less than the market average. These stocks can help reduce overall portfolio risk.",
    category: "factor",
  },
  "momentum": {
    term: "Momentum",
    definition: "A factor that favours stocks that have been performing well recently. The idea is that stocks with strong recent performance may continue to perform well in the near term.",
    category: "factor",
  },
  "value": {
    term: "Value",
    definition: "A factor that favours stocks that appear inexpensive relative to their earnings or assets. Value stocks may offer better long-term returns if the market recognises their true worth.",
    category: "factor",
  },
  "factor": {
    term: "Factor",
    definition: "A characteristic of a group of stocks that can explain their returns. The model uses four factors: Momentum, Value, Quality, and Low Volatility.",
    category: "factor",
  },

  // ── Risk ───────────────────────────────────────────────────────────────
  "risk overlay": {
    term: "Risk Overlay",
    definition: "A daily check of market conditions that may limit new buys in the monthly plan. It does not place orders or connect to a brokerage.",
    category: "risk",
  },
  "eod": {
    term: "End of Day (EOD)",
    definition: "Market information recorded after a trading session closes. The displayed date is the latest loaded data date, which may lag the current market day.",
    category: "risk",
  },
  "drawdown": {
    term: "Drawdown",
    definition: "How much your portfolio has fallen from its previous peak value. A 20% drawdown means your portfolio is 20% below its highest recent value.",
    category: "risk",
  },
  "volatility": {
    term: "Volatility",
    definition: "How much stock prices tend to move up and down. Higher volatility means larger price swings, which can mean both greater opportunity and greater risk.",
    category: "risk",
  },
  "regime": {
    term: "Regime",
    definition: "The current market environment or condition. The model identifies five regimes: Bull (favourable), Bear (unfavourable), Sideways (neutral), Recovery (improving), and High Volatility (cautious).",
    category: "risk",
  },
  "transition risk": {
    term: "Transition Risk",
    definition: "The risk that the market may shift from its current condition to a different one. Higher transition risk means the model is less confident that current conditions will persist.",
    category: "risk",
  },

  // ── Performance ────────────────────────────────────────────────────────
  "cagr": {
    term: "CAGR",
    definition: "Compound Annual Growth Rate. The average yearly growth rate of your investment over a period, accounting for compounding. A 15% CAGR means your investment grew by an average of 15% per year.",
    category: "performance",
  },
  "sharpe": {
    term: "Sharpe",
    definition: "A measure of how much return you are taking per unit of risk. A higher Sharpe ratio means you are being better compensated for the risk you are taking.",
    category: "performance",
  },
  "turnover": {
    term: "Turnover",
    definition: "How much of your portfolio changes each month. Higher turnover means more buying and selling, which can increase transaction costs.",
    category: "performance",
  },
  "target weight": {
    term: "Target Weight",
    definition: "The percentage of your portfolio the model wants you to hold in a particular stock. For example, a 5% target weight means the model wants 5% of your portfolio in that stock.",
    category: "performance",
  },
  "latest signal": {
    term: "Latest Signal",
    definition: "The most recent monthly model instruction recorded for this stock, such as Buy, Add, Hold, Reduce, or Sell. It is a decision-support signal, not an executed order.",
    category: "model",
  },
  "price history": {
    term: "Price History",
    definition: "The stored historical price series available for this stock. In this dashboard it is used for charts, model context, and reference prices; it is not a live market feed.",
    category: "model",
  },
  "reference price": {
    term: "Reference Price",
    definition: "The latest available stored price used by the dashboard for calculations. It helps size plans, but actual market prices can move before you trade.",
    category: "model",
  },
  "model basket": {
    term: "Model Basket",
    definition: "The group of stocks selected by the current monthly model after factor scoring, regime weighting, and portfolio constraints.",
    category: "model",
  },
  "ai candidate": {
    term: "AI Candidate",
    definition: "A stock surfaced by the broader Nifty 500 candidate scan. It can be useful for discovery, but it is not the same as a fully validated Nifty 200 portfolio target.",
    category: "model",
  },
  "buy zone": {
    term: "Buy Zone",
    definition: "A practical price area around the model's reference price. It is shown to discourage chasing a stock after it has already moved too far.",
    category: "action",
  },
  "free cash": {
    term: "Free Cash",
    definition: "Cash available in your portfolio that can be used for new purchases if the model gate and daily risk overlay allow fresh deployment.",
    category: "action",
  },
  "unrealized pnl": {
    term: "Unrealized P&L",
    definition: "The estimated profit or loss on holdings you still own, based on entered average price and the latest available stored price.",
    category: "performance",
  },
  "model weight": {
    term: "Model Weight",
    definition: "The share of the model portfolio assigned to a stock or factor. It is a target for comparison, not an order or a promise of return.",
    category: "performance",
  },
  "benchmark": {
    term: "Benchmark",
    definition: "A reference portfolio or index used to compare historical results. A research comparison does not change which model outputs the product displays.",
    category: "performance",
  },
  "signal": {
    term: "Signal",
    definition: "A recorded model indication for a stock and month, such as Buy, Add, Reduce, or Sell. It is informational and does not place an order.",
    category: "model",
  },

  // ── Model ──────────────────────────────────────────────────────────────
  "model": {
    term: "Model",
    definition: "The system that analyses market data and recommends a portfolio. It uses regime detection, factor scoring, and portfolio construction to determine which stocks to favour.",
    category: "model",
  },
  "optimizer": {
    term: "Optimizer",
    definition: "The part of the model that decides how much to allocate to each factor. It balances expected returns against risk and trading costs.",
    category: "model",
  },
  "covariance": {
    term: "Covariance",
    definition: "How two factors move together. If two factors tend to rise and fall at the same time, holding both does not diversify your risk as much as holding two factors that move independently.",
    category: "model",
  },
};

/**
 * Get a term definition by key. Returns null if the term is not found.
 */
export function getTermDefinition(key: string): TermDefinition | null {
  return TERM_DEFINITIONS[key.toLowerCase()] || null;
}

/**
 * Get all term definitions in a category.
 */
export function getTermsByCategory(category: TermDefinition["category"]): TermDefinition[] {
  return Object.values(TERM_DEFINITIONS).filter((t) => t.category === category);
}
